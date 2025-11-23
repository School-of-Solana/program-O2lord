import { BN, Program } from "@coral-xyz/anchor";
import useAnchorProvider from "./useAnchorProvider";
import { AnchorProject } from "@/relics/anchor_project";
import idl from "@/relics/anchor_project.json";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomBytes } from "crypto";
import {  useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import transactionDispatcher, {
  TransactionType,
} from "./transactionEventDispatcher";
import { useMemo, useEffect, useCallback, useState } from "react";

// TypeScript interfaces
export interface Milestone {
  description: string;
  amount: BN;
  status: number;
  completedAt?: BN;
  approvedAt?: BN;
  disputeReason?: string;
  disputeId?: string;
}

export interface TrustPayAccountData {
  contractType: number;
  seed: BN;
  payer: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  title: string;
  termsAndConditions: string;
  totalContractAmount: BN;
  deadline?: BN;
  acceptanceTimestamp?: BN;
  contractStatus: number;
  feePercentage: number;
  feeDestination: PublicKey;
  fee: BN;
  milestones: Milestone[];
  bump: number;
}

export interface MilestoneInput {
  description: string;
  amount: number;
}

// Contract statuses
export enum ContractStatus {
  PENDING = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  DISPUTED = 4,
}

interface BatchedMintInfo {
  address: PublicKey;
  decimals: number;
  isToken2022: boolean;
  tokenProgram: PublicKey;
}

export interface GlobalState {
  authority: PublicKey;
  totalTrustPayCreated: BN;
  totalTrustPayClosed: BN;
  totalConfirmations: BN;
  feePercentage: number;
  feeDestination: PublicKey;
  totalFeesCollected: BN;
  totalDisputes: BN;
  totalVolume: BN;
  tokenDecimals: number;
  highWatermarkVolume: BN;
  lastVolumeUpdate: BN;
  bump: number;
}

// Milestone statuses
export enum MilestoneStatus {
  PENDING = 0,
  COMPLETED_BY_SP = 1,
  APPROVED_BY_PAYER = 2,
  DISPUTED = 3,
}

// Contract types
export enum ContractType {
  ONE_TIME = 0,
  MILESTONE = 1,
}

// Role types
export enum Role {
  PAYER = 0,
  RECIPIENT = 1,
}

// Resolution types
export enum DisputeResolution {
  FAVOR_PAYER = 0,
  FAVOR_RECIPIENT = 1,
  SPLIT = 2,
}

export type FeeInfo = {
  feePercentage: number;
  feeDestination: PublicKey;
};

// Batching configuration
const BATCH_DELAY = 50;

// Batch management for trust pay info
const batchedTrustPayRequests = new Map<
  string,
  {
    resolve: (value: TrustPayAccountData) => void;
    reject: (error: Error) => void;
  }
>();

let trustPayBatchTimeout: NodeJS.Timeout | null = null;

// Batch management for token balances
const batchedBalanceRequests = new Map<
  string,
  {
    resolve: (value: number) => void;
    reject: (error: Error) => void;
  }
>();

let balanceBatchTimeout: NodeJS.Timeout | null = null;

// Batch management for mint info
const batchedMintRequests = new Map<
  string,
  {
    resolve: (value: BatchedMintInfo) => void;
    reject: (error: Error) => void;
  }
>();

let mintBatchTimeout: NodeJS.Timeout | null = null;



export default function useTrustPay() {
  const provider = useAnchorProvider();
  const { publicKey } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const program = useMemo(
  () => new Program<AnchorProject>(idl as AnchorProject, provider),
  [provider]
);
  const queryClient = useQueryClient();

  // Optimized batch trust pay info fetcher
const getBatchedTrustPayInfo = useCallback(
  async (trustPayPubkey: PublicKey): Promise<TrustPayAccountData> => {
    const key = trustPayPubkey.toString();

    // Check cache first
    const cachedData = queryClient.getQueryData<TrustPayAccountData>([
      `trust-pay-info-${key}`,
    ]);
    if (cachedData) {
      return cachedData;
    }

    return new Promise((resolve, reject) => {
      batchedTrustPayRequests.set(key, { resolve, reject });

      if (trustPayBatchTimeout) {
        clearTimeout(trustPayBatchTimeout);
      }

      trustPayBatchTimeout = setTimeout(async () => {
        const requests = Array.from(batchedTrustPayRequests.entries());
        batchedTrustPayRequests.clear();

        if (requests.length === 0) return;

        try {
          const pubkeys = requests.map(([key]) => new PublicKey(key));
          const accounts = await provider.connection.getMultipleAccountsInfo(
            pubkeys
          );

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                reject(new Error(`TrustPay account not found: ${key}`));
                return;
              }

              const parsedData =
                program.account.trustPay.coder.accounts.decode(
                  "trustPay",
                  accountInfo.data
                ) as TrustPayAccountData;

              queryClient.setQueryData(
                [`trust-pay-info-${key}`],
                parsedData,
                {
                  updatedAt: Date.now(),
                }
              );

              resolve(parsedData);
            } catch (error) {
              reject(error instanceof Error? error : new Error(String(error)));
            }
          });
        } catch (error) {
            requests.forEach(([, { reject }]) => reject(error instanceof Error ? error : new Error(String(error))));

        }
      }, BATCH_DELAY);
    });
  },
  [program, provider.connection, queryClient]
);

// Optimized batch token balance fetcher
const getBatchedTokenBalance = useCallback(
  async (tokenAccount: PublicKey): Promise<number> => {
    const key = tokenAccount.toString();

    // Check cache first
    const cachedBalance = queryClient.getQueryData<number>([
      `token-balance-${key}`,
    ]);
    if (cachedBalance !== undefined) {
      return cachedBalance;
    }

    return new Promise((resolve, reject) => {
      batchedBalanceRequests.set(key, { resolve, reject });

      if (balanceBatchTimeout) {
        clearTimeout(balanceBatchTimeout);
      }

      balanceBatchTimeout = setTimeout(async () => {
        const requests = Array.from(batchedBalanceRequests.entries());
        batchedBalanceRequests.clear();

        if (requests.length === 0) return;

        try {
          const pubkeys = requests.map(([key]) => new PublicKey(key));
          const accounts = await provider.connection.getMultipleAccountsInfo(
            pubkeys
          );

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                resolve(0); // Account doesn't exist, balance is 0
                return;
              }

              // Parse token account data manually for better performance
              const balance = parseTokenAccountBalance(accountInfo.data);

              // Cache for 30 seconds
              queryClient.setQueryData([`token-balance-${key}`], balance, {
                updatedAt: Date.now(),
              });

              resolve(balance);
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        } catch (error) {
          requests.forEach(([, { reject }]) =>
            reject(error instanceof Error ? error : new Error(String(error)))
          );
        }
      }, BATCH_DELAY);
    });
  },
  [provider.connection, queryClient]
);

// Helper function to parse token account balance from raw data
const parseTokenAccountBalance = (data: Buffer): number => {
  try {
    // Token account layout: 32 bytes mint + 32 bytes owner + 8 bytes amount + ...
    const amountOffset = 64;
    const amountBuffer = data.slice(amountOffset, amountOffset + 8);
    return Number(Buffer.from(amountBuffer).readBigUInt64LE());
  } catch {
    return 0;
  }
};

// Optimized batch mint info fetcher
const getBatchedMintInfo = useCallback(
  async (mintPubkey: PublicKey): Promise<BatchedMintInfo> => {
    const key = mintPubkey.toString();

    // Check cache first
    const cachedMintInfo = queryClient.getQueryData<BatchedMintInfo>([
      `mint-info-${key}`,
    ]);
    if (cachedMintInfo) {
      return cachedMintInfo;
    }

    return new Promise((resolve, reject) => {
      batchedMintRequests.set(key, { resolve, reject });

      if (mintBatchTimeout) {
        clearTimeout(mintBatchTimeout);
      }

      mintBatchTimeout = setTimeout(async () => {
        const requests = Array.from(batchedMintRequests.entries());
        batchedMintRequests.clear();

        if (requests.length === 0) return;

        try {
          const pubkeys = requests.map(([key]) => new PublicKey(key));
          const accounts = await provider.connection.getMultipleAccountsInfo(
            pubkeys
          );

          requests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                reject(new Error(`Mint account not found: ${key}`));
                return;
              }

              const isToken2022 = accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
              const tokenProgram = isToken2022
                ? TOKEN_2022_PROGRAM_ID
                : TOKEN_PROGRAM_ID;

              const mintInfo: BatchedMintInfo = {
                address: new PublicKey(key),
                decimals: accountInfo.data[44], // Decimals at offset 44
                isToken2022,
                tokenProgram,
              };

              // Cache for 5 minutes (mint info rarely changes)
              queryClient.setQueryData([`mint-info-${key}`], mintInfo, {
                updatedAt: Date.now(),
              });

              resolve(mintInfo);
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        } catch (error) {
          requests.forEach(([, { reject }]) =>
            reject(error instanceof Error ? error : new Error(String(error)))
          );
        }
      }, BATCH_DELAY);
    });
  },
  [provider.connection, queryClient]
);

  const isToken2022 = async (mint: PublicKey) => {
    try {
      const mintInfo = await provider.connection.getAccountInfo(mint);
      if (!mintInfo || !mintInfo.owner) {
        return false;
      }
      return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
    } catch (error) {
      console.error(`Error checking if mint ${mint.toString()} is Token2022:`, error);
      return false;
    }
  };

  const getMintInfo = async (mint: PublicKey) => {
    try {
      const tokenProgram = (await isToken2022(mint))
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      return await getMint(provider.connection, mint, undefined, tokenProgram);
    } catch (error) {
      console.error(`Error getting mint info for ${mint.toString()}:`, error);
      throw new Error(
        `Failed to fetch mint information: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const getTrustPayInfo = useCallback(
    async (trustPay: PublicKey): Promise<TrustPayAccountData> => {
      try {
        return await getBatchedTrustPayInfo(trustPay);
      } catch (error) {
        console.warn("Batched request failed, falling back to individual call:", error);
        return program.account.trustPay.fetch(trustPay) as Promise<TrustPayAccountData>;
      }
    },
    [program, getBatchedTrustPayInfo]
  );

  // Get global state
  const getGlobalState = useQuery({
    queryKey: ["get-global-state"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async (): Promise<GlobalState | null> => {
        try {
          const [globalState] = PublicKey.findProgramAddressSync(
            [Buffer.from("global-state")],
            program.programId
          );

          // First check if the account exists
          const accountInfo = await provider.connection.getAccountInfo(globalState);
          
          // If account doesn't exist, return null (this is not an error)
          if (!accountInfo) {
            console.log("Global state account does not exist yet");
            return null;
          }

          return await program.account.globalState.fetch(globalState);
        } catch (error: unknown) {
          // Check if error is due to account not existing
          const isAccountNotFoundError =
            error instanceof Error &&
            (error.message?.includes("Account does not exist") ||
              error.message?.includes("has no data"));

          // If account doesn't exist, return null (not an error condition)
          if (isAccountNotFoundError) {
            console.log("Global state account does not exist yet");
            return null;
          }

          const isRateLimitError =
            (error instanceof Error && error.message?.includes("429")) ||
            (typeof error === "object" &&
              error !== null &&
              "toString" in error &&
              error.toString().includes("429"));

          const isConnectionError =
            error instanceof Error &&
            (error.message?.includes("failed to fetch") ||
              error.message?.includes("network error"));

          if ((isRateLimitError || isConnectionError) && retryCount < maxRetries) {
            console.warn(
              `Query failed, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${maxRetries})`,
              error
            );
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
            backoffTime *= 2;
            return executeQuery();
          }

          console.error("Error fetching global state after retries:", error);
          return null;
        }
      };

      return executeQuery();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Get all TrustPay accounts
  const getTrustPayAccounts = useQuery({
    queryKey: ["get-trust-pay-accounts"],
    queryFn: async () => {
      const maxRetries = 3;
      let retryCount = 0;
      let backoffTime = 1000;

      const executeQuery = async () => {
        try {
          const responses = await program.account.trustPay.all();
          const sortedResponses = responses.sort((a, b) =>
            a.account.seed.cmp(b.account.seed)
          );

          // Pre-populate cache
          sortedResponses.forEach((response) => {
            const key = response.publicKey.toString();
            queryClient.setQueryData(
              [`trust-pay-info-${key}`],
              response.account,
              {
                updatedAt: Date.now(),
              }
            );
          });

          return sortedResponses;
        } catch (error: unknown) {
          if (retryCount >= maxRetries) {
            console.error("Max retries reached when fetching TrustPay accounts:", error);
            throw error;
          }

          const isRateLimitError =
            (error instanceof Error && error.message?.includes("429")) ||
            (typeof error === "object" &&
              error !== null &&
              "toString" in error &&
              error.toString().includes("429"));

          const isConnectionError =
            error instanceof Error &&
            (error.message?.includes("failed to fetch") ||
              error.message?.includes("network error"));

          if (isRateLimitError || isConnectionError) {
            console.warn(
              `Rate limit or connection error, retrying in ${backoffTime}ms (attempt ${
                retryCount + 1
              }/${maxRetries})`,
              error
            );
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
            backoffTime *= 2;
            return executeQuery();
          } else {
            console.error("Error fetching TrustPay accounts:", error);
            throw error;
          }
        }
      };

      return executeQuery();
    },
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    retry: false,
  });

  // Optimized global refresh scheduler
  useEffect(() => {
    const intervalId = setInterval(() => {
      const trustPayAccountsQuery = queryClient.getQueryCache().find({
        queryKey: ["get-trust-pay-accounts"],
      });

      const globalStateQuery = queryClient.getQueryCache().find({
        queryKey: ["get-global-state"],
      });

      if (
        trustPayAccountsQuery &&
        trustPayAccountsQuery.getObserversCount() > 0 &&
        trustPayAccountsQuery.state.fetchStatus !== "fetching"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["get-trust-pay-accounts"],
          refetchType: "active",
        });
      }

      if (
        globalStateQuery &&
        globalStateQuery.getObserversCount() > 0 &&
        globalStateQuery.state.fetchStatus !== "fetching"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["get-global-state"],
          refetchType: "active",
        });
      }
    }, 120000);

    return () => clearInterval(intervalId);
  }, [queryClient]);

  // Create contract
  const createContract = useMutation({
    mutationKey: ["create-contract"],
    mutationFn: async (params: {
      creatorRole: Role;
      payerPubkey: PublicKey;
      otherParty: PublicKey;
      contractType: ContractType;
      mint: string;
      title: string;
      termsAndConditions: string;
      totalAmount: number;
      milestoneInputs: MilestoneInput[];
      deadlineDurationSeconds: number;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const {
        creatorRole,
        payerPubkey,
        otherParty,
        contractType,
        mint,
        title,
        termsAndConditions,
        totalAmount,
        milestoneInputs,
        deadlineDurationSeconds,
      } = params;

      const seed = new BN(randomBytes(8));
      const mintPubkey = new PublicKey(mint);

      const isToken2022Result = await isToken2022(mintPubkey);
      const tokenProgram = isToken2022Result
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const mintInfo = await getMint(
        provider.connection,
        mintPubkey,
        undefined,
        tokenProgram
      );

      const totalAmountBN = new BN(Math.floor(totalAmount * 10 ** mintInfo.decimals));

      const milestones = milestoneInputs.map((m) => ({
        description: m.description,
        amount: new BN(Math.floor(m.amount * 10 ** mintInfo.decimals)),
      }));

      const creatorTokenAccount = getAssociatedTokenAddressSync(
        mintPubkey,
        publicKey,
        false,
        tokenProgram
      );

      const [trustPay] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("trust-pay"),
          payerPubkey.toBuffer(),
          seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const vault = getAssociatedTokenAddressSync(
        mintPubkey,
        trustPay,
        true,
        tokenProgram
      );

      const feeDestination = new PublicKey(
        "F253qoSQFw27q2Zt6RF3ox3FZGpTZPxdQ6ci7bbTxoRy"
      );

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      const signature = await program.methods
        .createContract(
          seed,
          creatorRole,
          payerPubkey,
          otherParty,
          contractType,
          title,
          termsAndConditions,
          totalAmountBN,
          milestones,
          new BN(deadlineDurationSeconds)
        )
        .accountsPartial({
          creator: publicKey,
          mint: mintPubkey,
          creatorTokenAccount,
          trustPay,
          vault,
          feeDestination,
          globalState,
          systemProgram: SystemProgram.programId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.CONTRACT_CREATED,
        trustPay: trustPay,
        amount: totalAmount,
        signature,
        timestamp: Date.now(),
        details: {
          title,
          contractType: ContractType[contractType],
          payer: payerPubkey.toString(),
          recipient: otherParty.toString(),
          milestoneCount: milestones.length,
        },
      });

      return { signature, trustPayPubkey: trustPay.toString() };
    },
    onError: (error) => {
      console.error("Error creating contract:", error);
    },
  });

  // Cancel contract
  const cancelContract = useMutation({
    mutationKey: ["cancel-contract"],
    mutationFn: async (params: { trustPay: PublicKey }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { trustPay } = params;
      const trustPayAccount = await getTrustPayInfo(trustPay);

      const isToken2022Result = await isToken2022(trustPayAccount.mint);
      const tokenProgram = isToken2022Result
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const vault = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPay,
        true,
        tokenProgram
      );

      const cancellerTokenAccount = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        publicKey,
        false,
        tokenProgram
      );

      const signature = await program.methods
        .cancelContract()
        .accountsPartial({
          canceller: publicKey,
          payer: trustPayAccount.payer,
          recipient: trustPayAccount.recipient,
          mint: trustPayAccount.mint,
          trustPay,
          vault,
          cancellerTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.CONTRACT_COMPLETED,
        trustPay,
        signature,
        timestamp: Date.now(),
        details: {
          canceller: publicKey.toString(),
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error cancelling contract:", error);
    },
  });

  // Accept contract
  const acceptContract = useMutation({
    mutationKey: ["accept-contract"],
    mutationFn: async (params: {
      trustPay: PublicKey;
      deadlineDurationSeconds: number;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { trustPay, deadlineDurationSeconds } = params;
      const trustPayAccount = await getTrustPayInfo(trustPay);

      const isToken2022Result = await isToken2022(trustPayAccount.mint);
      const tokenProgram = isToken2022Result
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const payerTokenAccount = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        publicKey,
        false,
        tokenProgram
      );

      const vault = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPay,
        true,
        tokenProgram
      );

      const signature = await program.methods
        .acceptContract(new BN(deadlineDurationSeconds))
        .accountsPartial({
          payer: publicKey,
          mint: trustPayAccount.mint,
          payerTokenAccount,
          trustPay,
          vault,
          systemProgram: SystemProgram.programId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.CONTRACT_ACCEPTED,
        trustPay,
        signature,
        timestamp: Date.now(),
        details: {
          payer: publicKey.toString(),
          deadlineDurationSeconds,
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error accepting contract:", error);
    },
  });

  // Mark milestone complete
  const markMilestoneComplete = useMutation({
    mutationKey: ["mark-milestone-complete"],
    mutationFn: async (params: {
      trustPay: PublicKey;
      milestoneIndex: number;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { trustPay, milestoneIndex } = params;

      const signature = await program.methods
        .markMilestoneComplete(milestoneIndex)
        .accountsPartial({
          recipient: publicKey,
          trustPay,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.MILESTONE_COMPLETE,
        trustPay,
        signature,
        timestamp: Date.now(),
        details: {
          milestoneIndex,
          recipient: publicKey.toString(),
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error marking milestone complete:", error);
    },
  });

  // Approve milestone payment
  const approveMilestonePayment = useMutation({
    mutationKey: ["approve-milestone-payment"],
    mutationFn: async (params: {
      trustPay: PublicKey;
      milestoneIndex: number;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      setIsProcessing(true);
      
      try {
        const { trustPay, milestoneIndex } = params;
        const trustPayAccount = await getTrustPayInfo(trustPay);

        const isToken2022Result = await isToken2022(trustPayAccount.mint);
        const tokenProgram = isToken2022Result
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

        const vault = getAssociatedTokenAddressSync(
          trustPayAccount.mint,
          trustPay,
          true,
          tokenProgram
        );

        const recipientTokenAccount = getAssociatedTokenAddressSync(
          trustPayAccount.mint,
          trustPayAccount.recipient,
          false,
          tokenProgram
        );

        const feeDestinationTokenAccount = getAssociatedTokenAddressSync(
          trustPayAccount.mint,
          trustPayAccount.feeDestination,
          false,
          tokenProgram
        );

        const [globalState] = PublicKey.findProgramAddressSync(
          [Buffer.from("global-state")],
          program.programId
        );

        const signature = await program.methods
          .approveMilestonePayment(milestoneIndex)
          .accountsPartial({
            payer: publicKey,
            recipient: trustPayAccount.recipient,
            trustPay,
            mint: trustPayAccount.mint,
            vault,
            recipientTokenAccount,
            feeDestination: trustPayAccount.feeDestination,
            feeDestinationTokenAccount,
            globalState,
            systemProgram: SystemProgram.programId,
            tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();

        transactionDispatcher.dispatchEvent({
          type: TransactionType.MILESTONE_APPROVED,
          trustPay,
          signature,
          timestamp: Date.now(),
          details: {
            milestoneIndex,
            payer: publicKey.toString(),
            recipient: trustPayAccount.recipient.toString(),
          },
        });

        return signature;
      } finally {
        setIsProcessing(false);
      }
    },
    onError: (error) => {
      console.error("Error approving milestone payment:", error);
      setIsProcessing(false);
    },
  });

  // Decline contract
  const declineContract = useMutation({
    mutationKey: ["decline-contract"],
    mutationFn: async (params: { trustPay: PublicKey }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { trustPay } = params;
      const trustPayAccount = await getTrustPayInfo(trustPay);

      const isToken2022Result = await isToken2022(trustPayAccount.mint);
      const tokenProgram = isToken2022Result
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const vault = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPay,
        true,
        tokenProgram
      );

      const recipientTokenAccount = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPayAccount.recipient,
        false,
        tokenProgram
      );

      const signature = await program.methods
        .declineContract()
        .accountsPartial({
          payer: publicKey,
          recipient: trustPayAccount.recipient,
          mint: trustPayAccount.mint,
          trustPay,
          vault,
          recipientTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.CONTRACT_COMPLETED,
        trustPay,
        signature,
        timestamp: Date.now(),
        details: {
          payer: publicKey.toString(),
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error declining contract:", error);
    },
  });

  // Dispute contract
  const disputeContract = useMutation({
    mutationKey: ["dispute-contract"],
    mutationFn: async (params: {
      trustPay: PublicKey;
      milestoneIndex: number;
      disputeReason: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { trustPay, milestoneIndex, disputeReason } = params;

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      const signature = await program.methods
        .disputeContract(milestoneIndex, disputeReason)
        .accountsPartial({
          disputer: publicKey,
          trustPay,
          globalState,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.MILESTONE_DISPUTED,
        trustPay,
        signature,
        timestamp: Date.now(),
        details: {
          milestoneIndex,
          disputer: publicKey.toString(),
          reason: disputeReason,
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error disputing contract:", error);
    },
  });

  // Resolve dispute
  const resolveDispute = useMutation({
    mutationKey: ["resolve-dispute"],
    mutationFn: async (params: {
      trustPay: PublicKey;
      milestoneIndex: number;
      resolution: DisputeResolution;
      resolutionReason: string;
    }) => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const { trustPay, milestoneIndex, resolution, resolutionReason } = params;
      const trustPayAccount = await getTrustPayInfo(trustPay);

      const isToken2022Result = await isToken2022(trustPayAccount.mint);
      const tokenProgram = isToken2022Result
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const vault = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPay,
        true,
        tokenProgram
      );

      const payerTokenAccount = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPayAccount.payer,
        false,
        tokenProgram
      );

      const recipientTokenAccount = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPayAccount.recipient,
        false,
        tokenProgram
      );

      const feeDestinationTokenAccount = getAssociatedTokenAddressSync(
        trustPayAccount.mint,
        trustPayAccount.feeDestination,
        false,
        tokenProgram
      );

      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );

      const signature = await program.methods
        .resolveDispute(milestoneIndex, resolution, resolutionReason)
        .accountsPartial({
          resolver: publicKey,
          payer: trustPayAccount.payer,
          recipient: trustPayAccount.recipient,
          mint: trustPayAccount.mint,
          trustPay,
          vault,
          payerTokenAccount,
          recipientTokenAccount,
          feeDestination: trustPayAccount.feeDestination,
          feeDestinationTokenAccount,
          globalState,
          systemProgram: SystemProgram.programId,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      transactionDispatcher.dispatchEvent({
        type: TransactionType.CONTRACT_COMPLETED,
        trustPay,
        signature,
        timestamp: Date.now(),
        details: {
          milestoneIndex,
          resolution: DisputeResolution[resolution],
          resolver: publicKey.toString(),
          reason: resolutionReason,
        },
      });

      return signature;
    },
    onError: (error) => {
      console.error("Error resolving dispute:", error);
    },
  });

  return {
    program,
    getTrustPayInfo,
    getGlobalState,
    getTrustPayAccounts,
    createContract,
    cancelContract,
    acceptContract,
    markMilestoneComplete,
    approveMilestonePayment,
    declineContract,
    disputeContract,
    resolveDispute,
    getMintInfo,
    isToken2022,
    getBatchedTrustPayInfo,
    getBatchedTokenBalance,
    getBatchedMintInfo,
    isProcessing,
  };
}