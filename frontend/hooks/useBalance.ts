import { useEffect, useState, useCallback } from "react";
import {
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import useTrustPay from "./useTrustPay";
import type { Connection } from "@solana/web3.js";


// Milestone status constants
export enum MilestoneStatus {
  PENDING = 0,
  COMPLETED_BY_SP = 1,
  APPROVED_BY_PAYER = 2,
  DISPUTED = 3,
}

// Batch configuration for optimization
const BALANCE_BATCH_DELAY = 50; // 50ms

// Type definitions
interface BatchedMintInfo {
  address: PublicKey;
  decimals: number;
  isToken2022: boolean;
  tokenProgram: PublicKey;
}

interface BatchedTrustPayInfo {
  fee: { toNumber: () => number };
  totalContractAmount: { toNumber: () => number };
  payer: PublicKey;
  mint: PublicKey;
  milestones: Array<{
    amount: { toNumber: () => number };
    status: number;
  }>;
  contractType: number;
  seed: { toNumber: () => number };
  recipient: PublicKey;
  title: string;
  termsAndConditions: string;
  deadline?: { toNumber: () => number };
  acceptanceTimestamp?: { toNumber: () => number };
  contractStatus: number;
  feePercentage: number;
  feeDestination: PublicKey;
  bump: number;
}

// Batch management for balance requests
const batchedBalanceRequests = new Map<
  string,
  {
    resolve: (value: number) => void;
    reject: (error: Error) => void;
  }
>();


let balanceBatchTimeout: NodeJS.Timeout | null = null;

// Helper function to batch balance requests
const getBatchedBalance = async (
  connection: Connection,
  tokenAccount: PublicKey,
  tokenProgram: PublicKey
): Promise<number> => {
  const key = `${tokenAccount.toString()}-${tokenProgram.toString()}`;

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
        // Group requests by token program for efficient batching
        const programGroups = new Map<
          string,
          Array<
            [
              string,
              {
                resolve: (value: number) => void;
                reject: (error: Error) => void;
              }
            ]
          >
        >();

        requests.forEach(([key, request]) => {
          const [, programId] = key.split("-");
          if (!programGroups.has(programId)) {
            programGroups.set(programId, []);
          }
          programGroups.get(programId)!.push([key, request]);
        });

        // Process each program group
        for (const [programId, groupRequests] of programGroups) {
          const pubkeys = groupRequests.map(([key]) => {
            const [accountAddress] = key.split("-");
            return new PublicKey(accountAddress);
          });

          const accounts = await connection.getMultipleAccountsInfo(pubkeys);

          groupRequests.forEach(([key, { resolve, reject }], index) => {
            try {
              const accountInfo = accounts[index];
              if (!accountInfo) {
                resolve(0); // Account doesn't exist, balance is 0
                return;
              }

              // Parse token account balance from raw data
              const balance = parseTokenAccountBalance(accountInfo.data);
              resolve(balance);
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        }
      } catch (error) {
        requests.forEach(([, { reject }]) => reject(error instanceof Error ? error : new Error(String(error))));
      }
    }, BALANCE_BATCH_DELAY);
  });
};

// Helper function to parse token account balance from raw data
const parseTokenAccountBalance = (data: Buffer): number => {
  try {
    // Token account layout: 32 bytes mint + 32 bytes owner + 8 bytes amount + ...
    const amountOffset = 64;
    const amountBuffer = data.slice(amountOffset, amountOffset + 8);
    return Number(amountBuffer.readBigUInt64LE());
  } catch {
    return 0;
  }
};

/**
 * Hook to fetch vault balance for a trust pay contract
 * Returns total balance, available balance, and locked balance
 */
export const useVaultBalance = (
  trustPay: PublicKey | undefined,
  mintAddress: PublicKey | undefined
) => {
  const { connection } = useConnection();
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [lockedBalance, setLockedBalance] = useState<number | null>(null);
  const [reservedFee, setReservedFee] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const trustPayHook = useTrustPay();

  // Optimized helper function to determine if a mint uses TOKEN_2022_PROGRAM
  const isToken2022 = useCallback(
    async (mint: PublicKey): Promise<boolean> => {
      try {
        // Use batched mint info if available
        if (trustPayHook.getBatchedMintInfo) {
          const mintInfo = (await trustPayHook.getBatchedMintInfo(
            mint
          )) as BatchedMintInfo;
          return mintInfo.isToken2022;
        }

        // Fallback to individual call
        const mintInfo = await connection.getAccountInfo(mint);
        return mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) ?? false;
      } catch {
        return false;
      }
    },
    [trustPayHook, connection]
  );

  // Optimized helper function to get mint info with correct token program
  const getMintInfo = useCallback(
    async (mint: PublicKey): Promise<BatchedMintInfo> => {
      try {
        // Use batched mint info if available
        if (trustPayHook.getBatchedMintInfo) {
          return (await trustPayHook.getBatchedMintInfo(
            mint
          )) as BatchedMintInfo;
        }

        // Fallback to individual call
        const tokenProgram = (await isToken2022(mint))
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

        const mintInfo = await getMint(
          connection,
          mint,
          undefined,
          tokenProgram
        );

        return {
          address: mint,
          decimals: mintInfo.decimals,
          isToken2022: tokenProgram.equals(TOKEN_2022_PROGRAM_ID),
          tokenProgram,
        };
      } catch (error) {
        console.error("Error getting mint info:", error);
        throw error;
      }
    },
    [trustPayHook, connection, isToken2022]
  );

  // Utility function to check if vault account exists
  const checkVaultExists = useCallback(
    async (vaultAddress: PublicKey): Promise<boolean> => {
      try {
        const accountInfo = await connection.getAccountInfo(vaultAddress);
        return accountInfo !== null;
      } catch {
        return false;
      }
    },
    [connection]
  );

  useEffect(() => {
    const fetchVaultBalance = async () => {
      try {
        if (!trustPay || !mintAddress) {
          setError("Invalid input data.");
          setLoading(false);
          return;
        }

        // Use batched trust pay info if available
        let trustPayAccount: BatchedTrustPayInfo;
        if (trustPayHook.getBatchedTrustPayInfo) {
          trustPayAccount = (await trustPayHook.getBatchedTrustPayInfo(
            trustPay
          )) as BatchedTrustPayInfo;
        } else {
          trustPayAccount = (await trustPayHook.getTrustPayInfo(
            trustPay
          )) as BatchedTrustPayInfo;
        }

        // Get mint info and token program for decimal calculations
        const mintInfo = await getMintInfo(mintAddress);
        const tokenProgram =
          mintInfo.tokenProgram ||
          (mintInfo.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID);
        const decimals = mintInfo.decimals || 0;

        // Calculate reserved fee
        const rawReservedFee = trustPayAccount.fee?.toNumber() || 0;
        const formattedReservedFee = rawReservedFee / Math.pow(10, decimals);
        setReservedFee(formattedReservedFee);

        // Calculate the associated token address for the vault PDA
        const vaultAccount = getAssociatedTokenAddressSync(
          mintAddress,
          trustPay,
          true,
          tokenProgram
        );

        // Check if vault exists first
        const vaultExists = await checkVaultExists(vaultAccount);

        // Fetch the vault token account balance with batching
        let vaultBalance = 0;

        if (vaultExists) {
          try {
            // Use batched balance fetching if available
            if (trustPayHook.getBatchedTokenBalance) {
              const rawBalance = await trustPayHook.getBatchedTokenBalance(
                vaultAccount
              );
              vaultBalance = rawBalance / Math.pow(10, decimals);
            } else {
              // Fallback to individual call with our own batching
              const rawBalance = await getBatchedBalance(
                connection,
                vaultAccount,
                tokenProgram
              );
              vaultBalance = rawBalance / Math.pow(10, decimals);
            }
          } catch (vaultError) {
            console.error("Error reading vault account:", vaultError);
            throw vaultError;
          }
        } else {
          vaultBalance = 0;
          console.warn("Vault account not found - balance is 0");
        }

        setTotalBalance(vaultBalance);

        // Calculate locked balance from pending/completed milestones
        let lockedAmount = 0;
        if (trustPayAccount.milestones && trustPayAccount.milestones.length > 0) {
          const activeMilestones = trustPayAccount.milestones.filter(
            (m) =>
              m.status === MilestoneStatus.PENDING ||
              m.status === MilestoneStatus.COMPLETED_BY_SP ||
              m.status === MilestoneStatus.DISPUTED
          );

          lockedAmount = activeMilestones.reduce((total, m) => {
            return total + (m.amount?.toNumber() || 0);
          }, 0);
        }

        const formattedLockedBalance = lockedAmount / Math.pow(10, decimals);
        setLockedBalance(formattedLockedBalance);

        // Available balance = total - locked - fee
        const available =
          vaultBalance - formattedLockedBalance - formattedReservedFee;
        setAvailableBalance(available > 0 ? available : 0);

        setError(null);
      } catch (error) {
        console.error("Error fetching vault balance:", error);

        let errorMessage = "Failed to fetch vault balance.";
        if (error instanceof Error) {
          if (error.message.includes("TokenInvalidAccountOwnerError")) {
            errorMessage =
              "Token mint uses unsupported token program or mint account is invalid.";
          } else if (error.message.includes("AccountNotFound")) {
            errorMessage = "Trust pay account not found.";
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }

        setTotalBalance(null);
        setAvailableBalance(null);
        setLockedBalance(null);
        setReservedFee(null);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (trustPay && mintAddress) {
      setLoading(true);
      fetchVaultBalance();
    } else {
      setLoading(false);
      setError("Invalid input data.");
    }
  }, [
    trustPay,
    mintAddress,
    connection,
    trustPayHook,
    getMintInfo,
    checkVaultExists,
  ]);

  return {
    vaultBalance: totalBalance, // Keep for backward compatibility
    totalBalance,
    availableBalance,
    lockedBalance,
    reservedFee,
    loading,
    error,
  };
};

/**
 * Hook to fetch user's token balance
 * Returns the balance of a specific token for the connected wallet
 */
export const useTokenBalance = (
  walletAddress: PublicKey | undefined,
  mintAddress: PublicKey | undefined
) => {
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const trustPayHook = useTrustPay();

  useEffect(() => {
    const fetchTokenBalance = async () => {
      try {
        if (!walletAddress || !mintAddress) {
          setError("Invalid input data.");
          setLoading(false);
          return;
        }

        // Determine token program
        const isToken2022Mint = await trustPayHook.isToken2022(mintAddress);
        const tokenProgram = isToken2022Mint
          ? TOKEN_2022_PROGRAM_ID
          : TOKEN_PROGRAM_ID;

        // Get mint info for decimals
        const mintInfo = await trustPayHook.getMintInfo(mintAddress);
        const decimals = mintInfo.decimals;

        // Get associated token account
        const tokenAccount = getAssociatedTokenAddressSync(
          mintAddress,
          walletAddress,
          false,
          tokenProgram
        );

        // Check if account exists
        const accountInfo = await connection.getAccountInfo(tokenAccount);
        if (!accountInfo) {
          setBalance(0);
          setError(null);
          setLoading(false);
          return;
        }

        // Fetch balance
        const tokenBalance = await connection.getTokenAccountBalance(
          tokenAccount
        );
        const formattedBalance =
          Number(tokenBalance.value.amount) / Math.pow(10, decimals);

        setBalance(formattedBalance);
        setError(null);
      } catch (error) {
        console.error("Error fetching token balance:", error);

        let errorMessage = "Failed to fetch token balance.";
        if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`;
        }

        setBalance(null);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (walletAddress && mintAddress) {
      setLoading(true);
      fetchTokenBalance();
    } else {
      setLoading(false);
      setError("Invalid input data.");
    }
  }, [walletAddress, mintAddress, connection, trustPayHook]);

  return {
    balance,
    loading,
    error,
  };
};