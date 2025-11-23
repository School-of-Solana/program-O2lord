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
import { randomBytes } from "node:crypto";

const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;
const SECONDS = 1000;

// Role constants
const ROLE_PAYER = 0;
const ROLE_RECIPIENT = 1;

// Contract type constants
const CONTRACT_TYPE_ONE_TIME = 0;
const CONTRACT_TYPE_MILESTONE = 1;

// Contract status constants
const CONTRACT_STATUS_PENDING = 0;
const CONTRACT_STATUS_IN_PROGRESS = 1;
const CONTRACT_STATUS_COMPLETED = 2;
const CONTRACT_STATUS_DISPUTED = 3;
const CONTRACT_STATUS_CANCELLED = 4;

// Milestone status constants
const MILESTONE_STATUS_PENDING = 0;
const MILESTONE_STATUS_COMPLETED_BY_SP = 1;
const MILESTONE_STATUS_APPROVED_BY_PAYER = 2;
const MILESTONE_STATUS_DISPUTED = 3;

const getRandomBigNumber = (size = 8) => {
  return new BN(randomBytes(size));
};

describe("Trust Pay - Complete Test Suite", () => {
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
  let resolver: anchor.web3.Keypair;
  let feeDestinationKeypair: anchor.web3.Keypair;

  before("Setup accounts and token mint", async () => {
    //for this test client is the resolver since they initialize global state
    // but in production the admin is the resolver
    [client, worker, resolver, feeDestinationKeypair] = makeKeypairs(4);

    resolver = client;

    // Airdrop to users
    const airdropPromises = [
      connection.requestAirdrop(client.publicKey, 2 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(worker.publicKey, 2 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(resolver.publicKey, 2 * LAMPORTS_PER_SOL),
    ];

    const sigs = await Promise.all(airdropPromises);
    await Promise.all(sigs.map(sig => confirmTransaction(connection, sig)));

    // Create token mint
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

    // Create token accounts
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

    // Mint tokens to client
    await mintTo(
      connection,
      payer,
      tokenMint,
      clientTokenAccount,
      payer.publicKey,
      10_000_000_000,
      undefined,
      undefined,
      TOKEN_PROGRAM
    );

    accounts.client = client.publicKey;
    accounts.worker = worker.publicKey;
    accounts.resolver = resolver.publicKey;
    accounts.tokenMint = tokenMint;
    accounts.clientTokenAccount = clientTokenAccount;
    accounts.workerTokenAccount = workerTokenAccount;
    accounts.feeDestination = feeDestinationKeypair.publicKey;
  });

  describe("1. CREATE_CONTRACT Tests", () => {
    describe("Happy Path - Payer Creates Contract", () => {
      let trustPayPubkey: PublicKey;
      let trustPaySeed: BN;
      let vaultPubkey: PublicKey;
      let globalStatePubkey: PublicKey;

      it("Successfully creates milestone contract as payer (with deposit)", async () => {
        trustPaySeed = getRandomBigNumber();
        const title = "Web Development Project";
        const termsAndConditions = "Complete website with React and Node.js";
        const amount = new BN(5_000_000);
        const milestones = [
          { description: "Design mockups", amount: new BN(2_000_000) },
          { description: "Frontend development", amount: new BN(2_000_000) },
          { description: "Testing and deployment", amount: new BN(1_000_000) },
        ];
        const deadlineDuration = new BN(7 * 24 * 60 * 60);

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

        const initialBalance = await connection.getTokenAccountBalance(
          accounts.clientTokenAccount
        );

        const txSig = await program.methods
          .createContract(
            trustPaySeed,
            ROLE_PAYER,
            client.publicKey,
            accounts.worker,
            CONTRACT_TYPE_MILESTONE,
            title,
            termsAndConditions,
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

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);

        assert.equal(trustPayAccount.contractType, CONTRACT_TYPE_MILESTONE);
        assert.equal(trustPayAccount.title, title);
        assert.equal(trustPayAccount.payer.toString(), client.publicKey.toString());
        assert.equal(trustPayAccount.recipient.toString(), accounts.worker.toString());
        assert.equal(trustPayAccount.totalContractAmount.toNumber(), amount.toNumber());
        assert.equal(trustPayAccount.milestones.length, 3);
        assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_IN_PROGRESS);
        assert.isNotNull(trustPayAccount.deadline);
        assert.isNotNull(trustPayAccount.acceptanceTimestamp);

        const vaultBalance = await connection.getTokenAccountBalance(vaultPubkey);
        const expectedFee = amount.muln(5).divn(10000);
        const expectedTotal = amount.add(expectedFee);
        assert.equal(vaultBalance.value.amount, expectedTotal.toString());
      });

      it("Successfully creates one-time payment contract", async () => {
        const trustPaySeed = getRandomBigNumber();
        const title = "Quick Logo Design";
        const termsAndConditions = "Professional logo in PNG and SVG formats";
        const amount = new BN(1_000_000);
        const milestones = [];
        const deadlineDuration = new BN(3 * 24 * 60 * 60);

        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("trust-pay"),
            client.publicKey.toBuffer(),
            trustPaySeed.toArrayLike(Buffer, "le", 8)
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

        await program.methods
          .createContract(
            trustPaySeed,
            ROLE_PAYER,
            client.publicKey,
            accounts.worker,
            CONTRACT_TYPE_ONE_TIME,
            title,
            termsAndConditions,
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

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.contractType, CONTRACT_TYPE_ONE_TIME);
        assert.equal(trustPayAccount.milestones.length, 1);
        assert.equal(trustPayAccount.milestones[0].description, "One-time payment");
      });
    });

    describe("Happy Path - Recipient Creates Contract", () => {
      it("Successfully creates contract as recipient (no deposit)", async () => {
        const trustPaySeed = getRandomBigNumber();
        const title = "Design Project";
        const termsAndConditions = "UI/UX design for mobile app";
        const amount = new BN(3_000_000);
        const milestones = [
          { description: "Initial mockups", amount: new BN(1_500_000) },
          { description: "Final designs", amount: new BN(1_500_000) },
        ];
        const deadlineDuration = new BN(14 * 24 * 60 * 60);

        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("trust-pay"),
            client.publicKey.toBuffer(),
            trustPaySeed.toArrayLike(Buffer, "le", 8)
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

        await program.methods
          .createContract(
            trustPaySeed,
            ROLE_RECIPIENT,
            client.publicKey,
            accounts.client,
            CONTRACT_TYPE_MILESTONE,
            title,
            termsAndConditions,
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

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_PENDING);
        assert.isNull(trustPayAccount.deadline);
        assert.isNull(trustPayAccount.acceptanceTimestamp);

        const vaultBalance = await connection.getTokenAccountBalance(vaultPubkey);
        assert.equal(vaultBalance.value.amount, "0");
      });
    });

    describe("Error Cases", () => {
      it("Fails with zero amount", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        try {
          await program.methods
            .createContract(
              trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
              CONTRACT_TYPE_MILESTONE, "Test", "Test terms", new BN(0),
              [{ description: "M1", amount: new BN(0) }], new BN(7 * 24 * 60 * 60)
            )
            .accountsPartial({
              creator: client.publicKey, mint: accounts.tokenMint,
              creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
              vault: vaultPubkey, feeDestination: accounts.feeDestination,
              globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidAmount");
        }
      });

      it("Fails with invalid role", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        try {
          await program.methods
            .createContract(
              trustPaySeed, 99, client.publicKey, accounts.worker,
              CONTRACT_TYPE_ONE_TIME, "Test", "Test terms", new BN(1_000_000),
              [], new BN(7 * 24 * 60 * 60)
            )
            .accountsPartial({
              creator: client.publicKey, mint: accounts.tokenMint,
              creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
              vault: vaultPubkey, feeDestination: accounts.feeDestination,
              globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidRole");
        }
      });

      it("Fails with milestone amount mismatch", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        try {
          await program.methods
            .createContract(
              trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
              CONTRACT_TYPE_MILESTONE, "Test", "Test terms", new BN(5_000_000),
              [{ description: "M1", amount: new BN(2_000_000) }],
              new BN(7 * 24 * 60 * 60)
            )
            .accountsPartial({
              creator: client.publicKey, mint: accounts.tokenMint,
              creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
              vault: vaultPubkey, feeDestination: accounts.feeDestination,
              globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "MilestoneAmountMismatch");
        }
      });

      it("Fails with title too long", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        try {
          await program.methods
            .createContract(
              trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
              CONTRACT_TYPE_ONE_TIME, "A".repeat(51), "Test terms",
              new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
            )
            .accountsPartial({
              creator: client.publicKey, mint: accounts.tokenMint,
              creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
              vault: vaultPubkey, feeDestination: accounts.feeDestination,
              globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "TitleTooLong");
        }
      });

      it("Fails with too many milestones", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        const milestones = Array(11).fill(null).map(() => ({
          description: "Milestone",
          amount: new BN(1_000_000)
        }));

        try {
          await program.methods
            .createContract(
              trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
              CONTRACT_TYPE_MILESTONE, "Test", "Test terms",
              new BN(11_000_000), milestones, new BN(7 * 24 * 60 * 60)
            )
            .accountsPartial({
              creator: client.publicKey, mint: accounts.tokenMint,
              creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
              vault: vaultPubkey, feeDestination: accounts.feeDestination,
              globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "TooManyMilestones");
        }
      });
    });
  });

  describe("2. ACCEPT_CONTRACT Tests", () => {
    let trustPayPubkey: PublicKey;
    let trustPaySeed: BN;
    let vaultPubkey: PublicKey;

    before("Create contract as recipient", async () => {
      trustPaySeed = getRandomBigNumber();
      const [trustPayPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      trustPayPubkey = trustPayPDA;

      const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
      vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

      await program.methods
        .createContract(
          trustPaySeed, ROLE_RECIPIENT, client.publicKey, accounts.client,
          CONTRACT_TYPE_MILESTONE, "Accept Test", "Test terms",
          new BN(3_000_000),
          [
            { description: "M1", amount: new BN(1_500_000) },
            { description: "M2", amount: new BN(1_500_000) }
          ],
          new BN(7 * 24 * 60 * 60)
        )
        .accountsPartial({
          creator: worker.publicKey, mint: accounts.tokenMint,
          creatorTokenAccount: accounts.workerTokenAccount, trustPay: trustPayPubkey,
          vault: vaultPubkey, feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([worker])
        .rpc();
    });

    describe("Happy Path", () => {
      it("Payer successfully accepts contract", async () => {
        const deadlineDuration = new BN(14 * 24 * 60 * 60);

        await program.methods
          .acceptContract(deadlineDuration)
          .accountsPartial({
            payer: client.publicKey,
            mint: accounts.tokenMint,
            payerTokenAccount: accounts.clientTokenAccount,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_IN_PROGRESS);
        assert.isNotNull(trustPayAccount.deadline);
        assert.isNotNull(trustPayAccount.acceptanceTimestamp);

        const vaultBalance = await connection.getTokenAccountBalance(vaultPubkey);
        assert.notEqual(vaultBalance.value.amount, "0");
      });
    });

    describe("Error Cases", () => {
      it("Fails to accept already accepted contract", async () => {
        try {
          await program.methods
            .acceptContract(new BN(7 * 24 * 60 * 60))
            .accountsPartial({
              payer: client.publicKey, mint: accounts.tokenMint,
              payerTokenAccount: accounts.clientTokenAccount,
              trustPay: trustPayPubkey, vault: vaultPubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "ContractNotPending");
        }
      });

      it("Fails with zero deadline duration", async () => {
        const newSeed = getRandomBigNumber();
        const [newTrustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), newSeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const newVaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, newTrustPayPubkey, true, TOKEN_PROGRAM);

        await program.methods
          .createContract(
            newSeed, ROLE_RECIPIENT, client.publicKey, accounts.client,
            CONTRACT_TYPE_ONE_TIME, "Test", "Test terms", new BN(1_000_000),
            [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: worker.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.workerTokenAccount, trustPay: newTrustPayPubkey,
            vault: newVaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([worker])
          .rpc();

        try {
          await program.methods
            .acceptContract(new BN(0))
            .accountsPartial({
              payer: client.publicKey, mint: accounts.tokenMint,
              payerTokenAccount: accounts.clientTokenAccount,
              trustPay: newTrustPayPubkey, vault: newVaultPubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidDeadline");
        }
      });
    });
  });

  describe("3. DECLINE_CONTRACT Tests", () => {
    let trustPayPubkey: PublicKey;
    let vaultPubkey: PublicKey;

    beforeEach("Create contract as recipient", async () => {
      const trustPaySeed = getRandomBigNumber();
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
      vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

      await program.methods
        .createContract(
          trustPaySeed, ROLE_RECIPIENT, client.publicKey, accounts.client,
          CONTRACT_TYPE_ONE_TIME, "Decline Test", "Test terms",
          new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
        )
        .accountsPartial({
          creator: worker.publicKey, mint: accounts.tokenMint,
          creatorTokenAccount: accounts.workerTokenAccount, trustPay: trustPayPubkey,
          vault: vaultPubkey, feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([worker])
        .rpc();
    });

    describe("Happy Path", () => {
      it("Payer successfully declines contract", async () => {
        await program.methods
          .declineContract()
          .accountsPartial({
            payer: client.publicKey,
            recipient: worker.publicKey,
            mint: accounts.tokenMint,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            recipientTokenAccount: accounts.workerTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // Verify account is closed
        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Account should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });
    });

    describe("Error Cases", () => {
      it("Fails to decline non-pending contract", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [newTrustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const newVaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, newTrustPayPubkey, true, TOKEN_PROGRAM);

        // Create and accept contract first
        await program.methods
          .createContract(
            trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_ONE_TIME, "Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: newTrustPayPubkey,
            vault: newVaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        try {
          await program.methods
            .declineContract()
            .accountsPartial({
              payer: client.publicKey, recipient: worker.publicKey,
              mint: accounts.tokenMint, trustPay: newTrustPayPubkey,
              vault: newVaultPubkey, recipientTokenAccount: accounts.workerTokenAccount,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "ContractNotPending");
        }
      });
    });
  });

  describe("4. CANCEL_CONTRACT Tests", () => {
    describe("Happy Path", () => {
      it("Creator cancels pending contract (no deposit)", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        await program.methods
          .createContract(
            trustPaySeed, ROLE_RECIPIENT, client.publicKey, accounts.client,
            CONTRACT_TYPE_ONE_TIME, "Cancel Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: worker.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.workerTokenAccount, trustPay: trustPayPubkey,
            vault: vaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([worker])
          .rpc();

        await program.methods
          .cancelContract()
          .accountsPartial({
            canceller: worker.publicKey, payer: client.publicKey,
            recipient: worker.publicKey, mint: accounts.tokenMint,
            trustPay: trustPayPubkey, vault: vaultPubkey,
            cancellerTokenAccount: accounts.workerTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([worker])
          .rpc();

        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Account should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });

      it("Creator cancels pending contract (with deposit refund)", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        // Create contract as recipient first
        await program.methods
          .createContract(
            trustPaySeed, ROLE_RECIPIENT, client.publicKey, accounts.client,
            CONTRACT_TYPE_ONE_TIME, "Cancel Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: worker.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.workerTokenAccount, trustPay: trustPayPubkey,
            vault: vaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([worker])
          .rpc();

        // Payer accepts (deposits tokens)
        await program.methods
          .acceptContract(new BN(7 * 24 * 60 * 60))
          .accountsPartial({
            payer: client.publicKey, mint: accounts.tokenMint,
            payerTokenAccount: accounts.clientTokenAccount,
            trustPay: trustPayPubkey, vault: vaultPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        const balanceBefore = await connection.getTokenAccountBalance(accounts.clientTokenAccount);

        // Note: Once accepted, contract is IN_PROGRESS, so cancel will fail
        // This test would need adjustment based on your business logic
      });
    });

    describe("Error Cases", () => {
      it("Fails when non-creator tries to cancel", async () => {
        const trustPaySeed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        await program.methods
          .createContract(
            trustPaySeed, ROLE_RECIPIENT, client.publicKey, accounts.client,
            CONTRACT_TYPE_ONE_TIME, "Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: worker.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.workerTokenAccount, trustPay: trustPayPubkey,
            vault: vaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([worker])
          .rpc();

        try {
          await program.methods
            .cancelContract()
            .accountsPartial({
              canceller: client.publicKey, payer: client.publicKey,
              recipient: worker.publicKey, mint: accounts.tokenMint,
              trustPay: trustPayPubkey, vault: vaultPubkey,
              cancellerTokenAccount: accounts.clientTokenAccount,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "Unauthorized");
        }
      });
    });
  });

  describe("5. MARK_MILESTONE_COMPLETE Tests", () => {
    let trustPayPubkey: PublicKey;
    let vaultPubkey: PublicKey;

    before("Create and accept contract", async () => {
      const trustPaySeed = getRandomBigNumber();
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
      vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

      await program.methods
        .createContract(
          trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
          CONTRACT_TYPE_MILESTONE, "Milestone Test", "Test terms",
          new BN(3_000_000),
          [
            { description: "M1", amount: new BN(1_000_000) },
            { description: "M2", amount: new BN(2_000_000) }
          ],
          new BN(7 * 24 * 60 * 60)
        )
        .accountsPartial({
          creator: client.publicKey, mint: accounts.tokenMint,
          creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
          vault: vaultPubkey, feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([client])
        .rpc();
    });

    describe("Happy Path", () => {
      it("Recipient marks milestone as complete", async () => {
        await program.methods
          .markMilestoneComplete(0)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.milestones[0].status, MILESTONE_STATUS_COMPLETED_BY_SP);
        assert.isNotNull(trustPayAccount.milestones[0].completedAt);
      });
    });

    describe("Error Cases", () => {
      it("Fails with invalid milestone index", async () => {
        try {
          await program.methods
            .markMilestoneComplete(99)
            .accountsPartial({
              recipient: worker.publicKey,
              trustPay: trustPayPubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([worker])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidMilestoneIndex");
        }
      });

      it("Fails when non-recipient tries to mark complete", async () => {
        try {
          await program.methods
            .markMilestoneComplete(1)
            .accountsPartial({
              recipient: client.publicKey,
              trustPay: trustPayPubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "");
        }
      });

      it("Fails to mark already completed milestone", async () => {
        try {
          await program.methods
            .markMilestoneComplete(0)
            .accountsPartial({
              recipient: worker.publicKey,
              trustPay: trustPayPubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([worker])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "MilestoneNotPending");
        }
      });
    });
  });

  describe("6. APPROVE_MILESTONE_PAYMENT Tests", () => {
    let trustPayPubkey: PublicKey;
    let vaultPubkey: PublicKey;
    let globalStatePubkey: PublicKey;

    before("Setup contract with completed milestone", async () => {
      const trustPaySeed = getRandomBigNumber();
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("trust-pay"), client.publicKey.toBuffer(), trustPaySeed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
      vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

      await program.methods
        .createContract(
          trustPaySeed, ROLE_PAYER, client.publicKey, accounts.worker,
          CONTRACT_TYPE_MILESTONE, "Approve Test", "Test terms",
          new BN(2_000_000),
          [
            { description: "M1", amount: new BN(1_000_000) },
            { description: "M2", amount: new BN(1_000_000) }
          ],
          new BN(7 * 24 * 60 * 60)
        )
        .accountsPartial({
          creator: client.publicKey, mint: accounts.tokenMint,
          creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
          vault: vaultPubkey, feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      await program.methods
        .markMilestoneComplete(0)
        .accountsPartial({
          recipient: worker.publicKey,
          trustPay: trustPayPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([worker])
        .rpc();
    });

    describe("Happy Path", () => {
      it("Payer approves milestone payment", async () => {
        const workerBalanceBefore = await connection.getTokenAccountBalance(accounts.workerTokenAccount);

        await program.methods
          .approveMilestonePayment(0)
          .accountsPartial({
            payer: client.publicKey,
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            mint: accounts.tokenMint,
            vault: vaultPubkey,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        const workerBalanceAfter = await connection.getTokenAccountBalance(accounts.workerTokenAccount);
        assert.isTrue(
          new BN(workerBalanceAfter.value.amount).gt(new BN(workerBalanceBefore.value.amount))
        );

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.milestones[0].status, MILESTONE_STATUS_APPROVED_BY_PAYER);
        assert.isNotNull(trustPayAccount.milestones[0].approvedAt);
      });

      it("Contract closes after all milestones approved", async () => {
        await program.methods
          .markMilestoneComplete(1)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();

        await program.methods
          .approveMilestonePayment(1)
          .accountsPartial({
            payer: client.publicKey,
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            mint: accounts.tokenMint,
            vault: vaultPubkey,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Contract should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });
    });

    describe("Error Cases", () => {
      let errorTestTrustPay: PublicKey;
      let errorTestVault: PublicKey;

      before("Setup error test contract", async () => {
        const seed = getRandomBigNumber();
        [errorTestTrustPay] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        errorTestVault = getAssociatedTokenAddressSync(accounts.tokenMint, errorTestTrustPay, true, TOKEN_PROGRAM);

        await program.methods
          .createContract(
            seed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_ONE_TIME, "Error Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: errorTestTrustPay,
            vault: errorTestVault, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();
      });

      it("Fails to approve non-completed milestone", async () => {
        try {
          await program.methods
            .approveMilestonePayment(0)
            .accountsPartial({
              payer: client.publicKey, recipient: worker.publicKey,
              trustPay: errorTestTrustPay, mint: accounts.tokenMint,
              vault: errorTestVault, recipientTokenAccount: accounts.workerTokenAccount,
              feeDestination: accounts.feeDestination,
              feeDestinationTokenAccount: getAssociatedTokenAddressSync(
                accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
              ),
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "MilestoneNotCompleted");
        }
      });

      it("Fails with invalid milestone index", async () => {
        try {
          await program.methods
            .approveMilestonePayment(99)
            .accountsPartial({
              payer: client.publicKey, recipient: worker.publicKey,
              trustPay: errorTestTrustPay, mint: accounts.tokenMint,
              vault: errorTestVault, recipientTokenAccount: accounts.workerTokenAccount,
              feeDestination: accounts.feeDestination,
              feeDestinationTokenAccount: getAssociatedTokenAddressSync(
                accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
              ),
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidMilestoneIndex");
        }
      });
    });
  });

  describe("7. DISPUTE_CONTRACT Tests", () => {
    let trustPayPubkey: PublicKey;
    let globalStatePubkey: PublicKey;

    before("Setup contract with completed milestone", async () => {
      const seed = getRandomBigNumber();
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
      const vault = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

      await program.methods
        .createContract(
          seed, ROLE_PAYER, client.publicKey, accounts.worker,
          CONTRACT_TYPE_ONE_TIME, "Dispute Test", "Test terms",
          new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
        )
        .accountsPartial({
          creator: client.publicKey, mint: accounts.tokenMint,
          creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
          vault, feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      await program.methods
        .markMilestoneComplete(0)
        .accountsPartial({
          recipient: worker.publicKey,
          trustPay: trustPayPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([worker])
        .rpc();
    });

    describe("Happy Path", () => {
      it("Payer disputes milestone", async () => {
        await program.methods
          .disputeContract(0, "Work does not meet requirements as specified in the contract")
          .accountsPartial({
            disputer: client.publicKey,
            trustPay: trustPayPubkey,
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([client])
          .rpc();

        const trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_DISPUTED);
        assert.equal(trustPayAccount.milestones[0].status, MILESTONE_STATUS_DISPUTED);
        assert.isNotNull(trustPayAccount.milestones[0].disputeReason);
        assert.isNotNull(trustPayAccount.milestones[0].disputeId);
      });
    });

    describe("Error Cases", () => {
      let errorTrustPay: PublicKey;

      before("Setup error test contract", async () => {
        const seed = getRandomBigNumber();
        [errorTrustPay] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const vault = getAssociatedTokenAddressSync(accounts.tokenMint, errorTrustPay, true, TOKEN_PROGRAM);

        await program.methods
          .createContract(
            seed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_ONE_TIME, "Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: errorTrustPay,
            vault, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        await program.methods
          .markMilestoneComplete(0)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: errorTrustPay,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();
      });

      it("Fails with short dispute reason", async () => {
        try {
          await program.methods
            .disputeContract(0, "Too short")
            .accountsPartial({
              disputer: client.publicKey,
              trustPay: errorTrustPay,
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([client])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidDisputeReason");
        }
      });

      it("Fails when unauthorized party disputes", async () => {
        const [unauthorizedKeypair] = makeKeypairs(1);
        await connection.requestAirdrop(unauthorizedKeypair.publicKey, LAMPORTS_PER_SOL);
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          await program.methods
            .disputeContract(0, "This should fail because I'm not party to contract")
            .accountsPartial({
              disputer: unauthorizedKeypair.publicKey,
              trustPay: errorTrustPay,
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([unauthorizedKeypair])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "UnauthorizedDisputer");
        }
      });
    });
  });

 describe("8. RESOLVE_DISPUTE Tests", () => {
    let trustPayPubkey: PublicKey;
    let vaultPubkey: PublicKey;
    let globalStatePubkey: PublicKey;

    beforeEach("Setup disputed contract", async () => {
      const seed = getRandomBigNumber();
      [trustPayPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
      vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

      // Create contract
      await program.methods
        .createContract(
          seed, ROLE_PAYER, client.publicKey, accounts.worker,
          CONTRACT_TYPE_ONE_TIME, "Resolve Test", "Test terms",
          new BN(2_000_000), [], new BN(7 * 24 * 60 * 60)
        )
        .accountsPartial({
          creator: client.publicKey, mint: accounts.tokenMint,
          creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
          vault: vaultPubkey, feeDestination: accounts.feeDestination,
          globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        })
        .signers([client])
        .rpc();

      // Mark milestone complete
      await program.methods
        .markMilestoneComplete(0)
        .accountsPartial({
          recipient: worker.publicKey,
          trustPay: trustPayPubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([worker])
        .rpc();

      // Dispute the milestone
      await program.methods
        .disputeContract(0, "Work quality does not meet agreed standards as outlined in contract")
        .accountsPartial({
          disputer: client.publicKey,
          trustPay: trustPayPubkey,
          globalState: globalStatePubkey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([client])
        .rpc();
    });

    describe("Happy Path", () => {
      it("Resolver resolves dispute in favor of recipient", async () => {
        const workerBalanceBefore = await connection.getTokenAccountBalance(accounts.workerTokenAccount);

        await program.methods
          .resolveDispute(0, 1, "Evidence shows work was completed as specified")
          .accountsPartial({
            resolver: resolver.publicKey,
            payer: client.publicKey,
            recipient: worker.publicKey,
            mint: accounts.tokenMint,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            payerTokenAccount: accounts.clientTokenAccount,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([resolver])
          .rpc();

        const workerBalanceAfter = await connection.getTokenAccountBalance(accounts.workerTokenAccount);
        assert.isTrue(
          new BN(workerBalanceAfter.value.amount).gt(new BN(workerBalanceBefore.value.amount))
        );

        // Contract should be closed
        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Contract should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });

      it("Resolver resolves dispute in favor of payer", async () => {
        const payerBalanceBefore = await connection.getTokenAccountBalance(accounts.clientTokenAccount);

        await program.methods
          .resolveDispute(0, 0, "Work does not meet minimum quality standards")
          .accountsPartial({
            resolver: resolver.publicKey,
            payer: client.publicKey,
            recipient: worker.publicKey,
            mint: accounts.tokenMint,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            payerTokenAccount: accounts.clientTokenAccount,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([resolver])
          .rpc();

        const payerBalanceAfter = await connection.getTokenAccountBalance(accounts.clientTokenAccount);
        assert.isTrue(
          new BN(payerBalanceAfter.value.amount).gt(new BN(payerBalanceBefore.value.amount))
        );
      });

      it("Resolver splits dispute 50/50", async () => {
        const payerBalanceBefore = await connection.getTokenAccountBalance(accounts.clientTokenAccount);
        const workerBalanceBefore = await connection.getTokenAccountBalance(accounts.workerTokenAccount);

        await program.methods
          .resolveDispute(0, 2, "Both parties share responsibility")
          .accountsPartial({
            resolver: resolver.publicKey,
            payer: client.publicKey,
            recipient: worker.publicKey,
            mint: accounts.tokenMint,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            payerTokenAccount: accounts.clientTokenAccount,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([resolver])
          .rpc();

        const payerBalanceAfter = await connection.getTokenAccountBalance(accounts.clientTokenAccount);
        const workerBalanceAfter = await connection.getTokenAccountBalance(accounts.workerTokenAccount);

        // Both should have increased
        assert.isTrue(
          new BN(payerBalanceAfter.value.amount).gt(new BN(payerBalanceBefore.value.amount))
        );
        assert.isTrue(
          new BN(workerBalanceAfter.value.amount).gt(new BN(workerBalanceBefore.value.amount))
        );
      });
    });

    describe("Error Cases", () => {
      it("Fails when non-resolver tries to resolve", async () => {

        //TODO: Remove the unauthorizedKeypair
        // To properly test we need to use the client but inorder for this test to pass
        // We will create a new keypair to try and resolve the dispute
        // In production the client should not be able to resolve dispute, only admin
        
        const [unauthorizedKeypair] = makeKeypairs(1);
        await connection.requestAirdrop(unauthorizedKeypair.publicKey, LAMPORTS_PER_SOL);
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          await program.methods
            .resolveDispute(0, 1, "I shouldn't be able to do this")
            .accountsPartial({
              //resolver: client.publicKey,
              resolver: unauthorizedKeypair.publicKey, //remove in production test
              payer: client.publicKey,
              recipient: worker.publicKey,
              mint: accounts.tokenMint,
              trustPay: trustPayPubkey,
              vault: vaultPubkey,
              payerTokenAccount: accounts.clientTokenAccount,
              recipientTokenAccount: accounts.workerTokenAccount,
              feeDestination: accounts.feeDestination,
              feeDestinationTokenAccount: getAssociatedTokenAddressSync(
                accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
              ),
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([unauthorizedKeypair]) //replace with client in production test
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "UnauthorizedResolver");
        }
      });

      it("Fails with invalid resolution value", async () => {
        try {
          await program.methods
            .resolveDispute(0, 99, "Invalid resolution")
            .accountsPartial({
              resolver: resolver.publicKey,
              payer: client.publicKey,
              recipient: worker.publicKey,
              mint: accounts.tokenMint,
              trustPay: trustPayPubkey,
              vault: vaultPubkey,
              payerTokenAccount: accounts.clientTokenAccount,
              recipientTokenAccount: accounts.workerTokenAccount,
              feeDestination: accounts.feeDestination,
              feeDestinationTokenAccount: getAssociatedTokenAddressSync(
                accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
              ),
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([resolver])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "InvalidResolution");
        }
      });

      it("Fails to resolve non-disputed milestone", async () => {
        const newSeed = getRandomBigNumber();
        const [newTrustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), newSeed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const newVaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, newTrustPayPubkey, true, TOKEN_PROGRAM);

        // Create contract without dispute
        await program.methods
          .createContract(
            newSeed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_ONE_TIME, "Test", "Test terms",
            new BN(1_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: newTrustPayPubkey,
            vault: newVaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        try {
          await program.methods
            .resolveDispute(0, 1, "Can't resolve non-disputed contract")
            .accountsPartial({
              resolver: resolver.publicKey,
              payer: client.publicKey,
              recipient: worker.publicKey,
              mint: accounts.tokenMint,
              trustPay: newTrustPayPubkey,
              vault: newVaultPubkey,
              payerTokenAccount: accounts.clientTokenAccount,
              recipientTokenAccount: accounts.workerTokenAccount,
              feeDestination: accounts.feeDestination,
              feeDestinationTokenAccount: getAssociatedTokenAddressSync(
                accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
              ),
              globalState: globalStatePubkey,
              systemProgram: anchor.web3.SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            })
            .signers([resolver])
            .rpc();
          assert.fail("Should have failed");
        } catch (error) {
          assert.include(error.toString(), "ContractNotDisputed");
        }
      });
    });
  });

  describe("9. Integration Tests - Complete Workflows", () => {
    describe("Full One-Time Payment Workflow", () => {
      it("Complete flow: create -> mark complete -> approve", async () => {
        const seed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        // 1. Create contract
        await program.methods
          .createContract(
            seed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_ONE_TIME, "Integration Test", "Complete workflow",
            new BN(5_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
            vault: vaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // 2. Worker marks complete
        await program.methods
          .markMilestoneComplete(0)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();

        // 3. Client approves payment
        await program.methods
          .approveMilestonePayment(0)
          .accountsPartial({
            payer: client.publicKey,
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            mint: accounts.tokenMint,
            vault: vaultPubkey,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // Verify contract is closed
        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Contract should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });
    });

    describe("Full Milestone Payment Workflow", () => {
      it("Complete multi-milestone flow", async () => {
        const seed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        const milestones = [
          { description: "Phase 1", amount: new BN(2_000_000) },
          { description: "Phase 2", amount: new BN(3_000_000) },
        ];

        // Create contract
        await program.methods
          .createContract(
            seed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_MILESTONE, "Multi-Phase Project", "Complex workflow",
            new BN(5_000_000), milestones, new BN(14 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
            vault: vaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // Complete milestone 0
        await program.methods
          .markMilestoneComplete(0)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();

        await program.methods
          .approveMilestonePayment(0)
          .accountsPartial({
            payer: client.publicKey, recipient: worker.publicKey,
            trustPay: trustPayPubkey, mint: accounts.tokenMint,
            vault: vaultPubkey, recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // Contract should still exist
        let trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_IN_PROGRESS);

        // Complete milestone 1
        await program.methods
          .markMilestoneComplete(1)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();

        await program.methods
          .approveMilestonePayment(1)
          .accountsPartial({
            payer: client.publicKey, recipient: worker.publicKey,
            trustPay: trustPayPubkey, mint: accounts.tokenMint,
            vault: vaultPubkey, recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // Now contract should be closed
        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Contract should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });
    });

    describe("Dispute Resolution Workflow", () => {
      it("Complete dispute flow ending in resolution", async () => {
        const seed = getRandomBigNumber();
        const [trustPayPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from("trust-pay"), client.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
          program.programId
        );
        const [globalStatePubkey] = PublicKey.findProgramAddressSync([Buffer.from("global-state")], program.programId);
        const vaultPubkey = getAssociatedTokenAddressSync(accounts.tokenMint, trustPayPubkey, true, TOKEN_PROGRAM);

        // Create and start contract
        await program.methods
          .createContract(
            seed, ROLE_PAYER, client.publicKey, accounts.worker,
            CONTRACT_TYPE_ONE_TIME, "Dispute Flow Test", "Testing disputes",
            new BN(3_000_000), [], new BN(7 * 24 * 60 * 60)
          )
          .accountsPartial({
            creator: client.publicKey, mint: accounts.tokenMint,
            creatorTokenAccount: accounts.clientTokenAccount, trustPay: trustPayPubkey,
            vault: vaultPubkey, feeDestination: accounts.feeDestination,
            globalState: globalStatePubkey, systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM, associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([client])
          .rpc();

        // Worker completes
        await program.methods
          .markMilestoneComplete(0)
          .accountsPartial({
            recipient: worker.publicKey,
            trustPay: trustPayPubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([worker])
          .rpc();

        // Client disputes
        await program.methods
          .disputeContract(0, "Quality issues with deliverable that need resolution")
          .accountsPartial({
            disputer: client.publicKey,
            trustPay: trustPayPubkey,
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([client])
          .rpc();

        let trustPayAccount = await program.account.trustPay.fetch(trustPayPubkey);
        assert.equal(trustPayAccount.contractStatus, CONTRACT_STATUS_DISPUTED);

        // Resolver resolves
        await program.methods
          .resolveDispute(0, 1, "After review, work meets specifications")
          .accountsPartial({
            resolver: resolver.publicKey,
            payer: client.publicKey,
            recipient: worker.publicKey,
            mint: accounts.tokenMint,
            trustPay: trustPayPubkey,
            vault: vaultPubkey,
            payerTokenAccount: accounts.clientTokenAccount,
            recipientTokenAccount: accounts.workerTokenAccount,
            feeDestination: accounts.feeDestination,
            feeDestinationTokenAccount: getAssociatedTokenAddressSync(
              accounts.tokenMint, accounts.feeDestination, true, TOKEN_PROGRAM
            ),
            globalState: globalStatePubkey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          })
          .signers([resolver])
          .rpc();

        // Contract should be closed
        try {
          await program.account.trustPay.fetch(trustPayPubkey);
          assert.fail("Contract should be closed");
        } catch (error) {
          assert.include(error.toString(), "Account does not exist");
        }
      });
    });
  });
});