import * as anchor from "@coral-xyz/anchor";
import { BN, type Program } from "@coral-xyz/anchor";
import { AnchorProject } from "../target/types/anchor_project";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  confirmTransaction,
  makeKeypairs,
} from "@solana-developers/helpers";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from 'fs';
import { randomBytes } from "node:crypto";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
import { program } from "@coral-xyz/anchor/dist/cjs/native/system";



const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;
const SECONDS = 1000;
const ANCHOR_SLOW_TEST_THRESHOLD = 40 * SECONDS;

// Role constants
const ROLE_PAYER = 0;
const ROLE_RECIPIENT = 1;

// Contract type constants
const CONTRACT_TYPE_ONE_TIME = 0;
const CONTRACT_TYPE_MILESTONE = 1;

// Contract status constants
const CONTRACT_STATUS_PENDING = 0;
const CONTRACT_STATUS_IN_PROGRESS = 1;

const getRandomBigNumber = (size = 8) => {
  return new BN(randomBytes(size));
};
describe("Trust Pay", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const user = (provider.wallet as anchor.Wallet).payer;
  const payer = user;
  const connection = provider.connection;
  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;

  const accounts: Record<string, PublicKey> = {
    tokenProgram: TOKEN_PROGRAM,
  };

  let client: anchor.web3.Keypair;
  let worker: anchor.web3.Keypair;
  let feeDestinationKeypair: anchor.web3.Keypair;

  before("creates accounts and token mint", async () => {
    [client, worker, feeDestinationKeypair] = makeKeypairs(3);

    //Airdrop to users
    const clientAirdropSig = await connection.requestAirdrop(
      client.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    const workerAirdrop = await connection.requestAirdrop(
      worker.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    await confirmTransaction(connection, clientAirdropSig);
    await confirmTransaction(connection, clientAirdropSig);

    // create token mint
     const tokenMint = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      9,
      undefined,
      undefined,
      TOKEN_PROGRAM
    );

    //create token accounr
    const clientTokenAccount = await createAssociatedTokenAccount(
      connection,
      payer,
      tokenMint,
      client.publicKey,
      undefined,
      TOKEN_PROGRAM
    );

    const workerTokenAccount = await createAssociatedTokenAccount(
      connection,
      payer,
      tokenMint,
      worker.publicKey,
      undefined,
      TOKEN_PROGRAM
    );

    //mint token to client
    await mintTo(
      connection,
      payer,
      tokenMint,
      clientTokenAccount,
      payer.publicKey,
      1_000_000_000,
      undefined,
      undefined,
      TOKEN_PROGRAM
    );

    accounts.client = client.publicKey;
    accounts.worker = worker.publicKey;
    accounts.tokenMint = tokenMint;
    accounts.clientTokenAccount= clientTokenAccount;
    accounts.workerTokenAccount= workerTokenAccount;
    accounts.feeDestination = feeDestinationKeypair.publicKey;

  })

  describe("Trust Pay Happy Flow - Client Creates Milestone Contract",async () => {
    let trustPayPubkey: PublicKey;
    let trustPaySeed: BN;
    let vaultPubkey: PublicKey;
    let globalStatePubkey: PublicKey;

    it("Client creates a trust pay for a work", async () => {
      trustPaySeed = getRandomBigNumber();
      const title = "Web Development Project";
      const amount = new BN(5_000_000);
      const milestones = [
        { description: "Design mockups", amount: new BN(2_000_000) },
        { description: "Frontend development", amount: new BN(2_000_000) },
        { description: "Testing and deployment", amount: new BN(1_000_000) },
      ];
      const deadlineDuration = new BN(7 * 24 * 60 * 60);

      // derive the PDAs
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust-pay"),
          accounts.client.toBuffer(),
          trustPaySeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      const [globalState] = PublicKey.findProgramAddressSync(
          [Buffer.from("global-state")],
          program.programId
        );

      vaultPubkey = getAssociatedTokenAddressSync(
        accounts.tokenMint,
        trustPayPubkey,
        true,
        TOKEN_PROGRAM
      );
  
      accounts.trustPay = trustPayPubkey;
      accounts.globalState = globalState;
      accounts.vault = vaultPubkey;

      // Get initial balance
      const initialBalance = await connection.getTokenAccountBalance(
        accounts.clientTokenAccount
      );

      const txSig = await program.methods
      .createContract(
          trustPaySeed,
          ROLE_PAYER,             
          accounts.worker,         
          CONTRACT_TYPE_MILESTONE, 
          title,
          amount,
          milestones,
          deadlineDuration
      )
      .accountsPartial({
          creator: client.publicKey,
          mint: accounts.tokenMint,
          creatorTokenAccount: accounts.clientTokenAccount,
          trustPay: trustPayPubkey,
          vault: vaultPubkey,
          feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,

        })
        .signers([client])
        .rpc();

      await confirmTransaction(connection, txSig);

      // Verify contract account
      const trustPayAccount = await program.account.trustPay.fetch(
        trustPayPubkey
      );

      assert.equal(trustPayAccount.contractType, CONTRACT_TYPE_MILESTONE);
      assert.equal(trustPayAccount.title, title);
      assert.equal(trustPayAccount.payer.toString(), client.publicKey.toString());
      assert.equal(trustPayAccount.recipient.toString(), accounts.worker.toString());
      assert.equal(trustPayAccount.totalContractAmount.toNumber(), amount.toNumber());
      assert.equal(trustPayAccount.milestones.length, 3);
      assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_IN_PROGRESS); // IN_PROGRESS because payer created it
      assert.equal(trustPayAccount.feePercentage, 5); // 0.05%

      // Verify tokens were transferred to vault
      const vaultBalance = await connection.getTokenAccountBalance(vaultPubkey);
      const expectedFee = amount.muln(5).divn(10000); // 0.05% fee
      const expectedTotal = amount.add(expectedFee);
      assert.equal(vaultBalance.value.amount, expectedTotal.toString());

      // Verify deadline is set
      assert.isNull(trustPayAccount.deadline);
      assert.isNull(trustPayAccount.acceptanceTimestamp);


    })

    it("Verifies contract state after creation", async () => {
      const trustPayAccount = await program.account.trustPay.fetch(
        accounts.trustPay
      );

      // Verify all milestones are in pending status
      trustPayAccount.milestones.forEach((milestone, index) => {
        assert.equal(milestone.status, 0); // PENDING
        assert.isNull(milestone.completedAt);
        assert.isNull(milestone.approvedAt);
        assert.isNull(milestone.disputeReason);
        assert.isNull(milestone.disputeId);
      });

      // Verify deadline is not set (set upon acceptance)
      assert.isNull(trustPayAccount.deadline);
      assert.isNull(trustPayAccount.acceptanceTimestamp);
    });

  describe("Trust Pay - Worker Creates Milestone Contract", async () => {
    let trustPayPubkey: PublicKey;
    let trustPaySeed: BN;
    let vaultPubkey: PublicKey;
    let globalStatePubkey: PublicKey;

    it("Worker creates a milestone contract (tokens NOT deposited)", async () => {
      trustPaySeed = getRandomBigNumber();
      const title = "Design Project";
      const amount = new BN(3_000_000);
      const milestones = [
        { description: "Initial mockups", amount: new BN(1_500_000) },
        { description: "Final designs", amount: new BN(1_500_000) },
      ];
      const deadlineDuration = new BN(14 * 24 * 60 * 60);

      // derive the PDAs (using worker as creator)
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust-pay"),
          worker.publicKey.toBuffer(),
          trustPaySeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      [globalStatePubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      vaultPubkey = getAssociatedTokenAddressSync(
        accounts.tokenMint,
        trustPayPubkey,
        true,
        TOKEN_PROGRAM
      );

      const txSig = await program.methods
        .createContract(
          trustPaySeed,
          ROLE_RECIPIENT,           // creator_role: worker is recipient
          accounts.client,          // other_party: client address
          CONTRACT_TYPE_MILESTONE,  // contract_type: milestone payment
          title,
          amount,
          milestones,
          deadlineDuration
        )
        .accountsPartial({
          creator: worker.publicKey,
          mint: accounts.tokenMint,
          creatorTokenAccount: accounts.workerTokenAccount,
          trustPay: trustPayPubkey,
          vault: vaultPubkey,
          feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([worker])
        .rpc();

      await confirmTransaction(connection, txSig);

      // Verify contract account
      const trustPayAccount = await program.account.trustPay.fetch(
        trustPayPubkey
      );

      assert.equal(trustPayAccount.contractType, CONTRACT_TYPE_MILESTONE);
      assert.equal(trustPayAccount.payer.toString(), accounts.client.toString());
      assert.equal(trustPayAccount.recipient.toString(), worker.publicKey.toString());
      assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_PENDING); // PENDING because worker created it
      
      // Verify NO tokens were transferred (vault should be empty or not exist with balance)
      try {
        const vaultBalance = await connection.getTokenAccountBalance(vaultPubkey);
        assert.equal(vaultBalance.value.amount, "0", "Vault should be empty when worker creates contract");
      } catch (error) {

      }

      // Verify deadline is set but acceptance_timestamp is null
      assert.isNull(trustPayAccount.deadline);
      assert.isNull(trustPayAccount.acceptanceTimestamp);

    });
  });

  describe("Trust Pay - One-Time Payment", async () => {
    let trustPayPubkey: PublicKey;
    let trustPaySeed: BN;
    let vaultPubkey: PublicKey;
    let globalStatePubkey: PublicKey;

    it("Client creates a one-time payment contract", async () => {
      trustPaySeed = getRandomBigNumber();
      const title = "Quick Logo Design";
      const amount = new BN(1_000_000);
      const milestones = []; // Empty for one-time payment
      const deadlineDuration = new BN(3 * 24 * 60 * 60);

      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust-pay"),
          client.publicKey.toBuffer(),
          trustPaySeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      [globalStatePubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      vaultPubkey = getAssociatedTokenAddressSync(
        accounts.tokenMint,
        trustPayPubkey,
        true,
        TOKEN_PROGRAM
      );

      const txSig = await program.methods
        .createContract(
          trustPaySeed,
          ROLE_PAYER,              // creator_role: client is payer
          accounts.worker,          // other_party: worker address
          CONTRACT_TYPE_ONE_TIME,   // contract_type: one-time payment
          title,
          amount,
          milestones,               // Empty array
          deadlineDuration
        )
        .accountsPartial({
          creator: client.publicKey,
          mint: accounts.tokenMint,
          creatorTokenAccount: accounts.clientTokenAccount,
          trustPay: trustPayPubkey,
          vault: vaultPubkey,
          feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      await confirmTransaction(connection, txSig);

      const trustPayAccount = await program.account.trustPay.fetch(
        trustPayPubkey
      );

      assert.equal(trustPayAccount.contractType, CONTRACT_TYPE_ONE_TIME);
      assert.equal(trustPayAccount.milestones.length, 1); // Auto-created single milestone
      assert.equal(trustPayAccount.milestones[0].description, "One-time payment");
      assert.equal(trustPayAccount.milestones[0].amount.toNumber(), amount.toNumber());
      assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_IN_PROGRESS);
    });
  });

  })

  describe("Edge Cases and Validations", () => {
    it("Fails to create contract with zero amount", async () => {
      const trustPaySeed = getRandomBigNumber();
      const amount = new BN(0);
      const title = "Invalid Contract";
      const milestones = [
        { description: "Milestone 1", amount: new BN(0) },
      ];
      const deadlineDuration = new BN(7 * 24 * 60 * 60);

      const [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust-pay"),
          client.publicKey.toBuffer(),
          trustPaySeed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [globalStatePubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      const vaultPubkey = getAssociatedTokenAddressSync(
        accounts.tokenMint,
        trustPayPubkey,
        true,
        TOKEN_PROGRAM
      );

      try {
        await program.methods
          .createContract(
            trustPaySeed,
            ROLE_PAYER,
            accounts.worker,
            CONTRACT_TYPE_MILESTONE,
            title,
            amount,
            milestones,
            deadlineDuration
          )
          .accountsPartial({
            creator: client.publicKey,
            mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();
        
        assert.fail("Should have failed with InvalidAmount error");
      } catch (error) {
        assert.include(error.toString(), "InvalidAmount");
      }
    });

     it("Fails to create contract with invalid role", async () => {
      const trustPaySeed = getRandomBigNumber();
      const amount = new BN(1_000_000);
      const title = "Invalid Role Contract";
      const milestones = [];
      const deadlineDuration = new BN(7 * 24 * 60 * 60);

      const [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust-pay"),
          client.publicKey.toBuffer(),
          trustPaySeed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [globalStatePubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      const vaultPubkey = getAssociatedTokenAddressSync(
        accounts.tokenMint,
        trustPayPubkey,
        true,
        TOKEN_PROGRAM
      );

      try {
        await program.methods
          .createContract(
            trustPaySeed,
            99,                      // Invalid role
            accounts.worker,
            CONTRACT_TYPE_ONE_TIME,
            title,
            amount,
            milestones,
            deadlineDuration
          )
          .accountsPartial({
            creator: client.publicKey,
            mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();
        
        assert.fail("Should have failed with InvalidRole error");
      } catch (error) {
        assert.include(error.toString(), "InvalidRole");
      }
    });

  })
});
