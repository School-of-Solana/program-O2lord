"use client";
import React, { useMemo, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useTrustPay, { ContractType, MilestoneStatus } from "@/hooks/useTrustPay";
import ServiceProviderCard from "./ServiceProviderCard";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useQueryClient } from "@tanstack/react-query";

// Define proper types for the milestone object
type MilestoneType = {
  trustPay: PublicKey;
  trustPayAccount: {
    seed: BN;
    payer: PublicKey;
    recipient: PublicKey;
    mint: PublicKey;
    currency: number[];
    contractType: number;
    totalContractAmount: BN;
    pricePerToken?: BN;
    paymentInstructions: string;
    termsAndConditions?: string; 
    milestones: {
      description: string;
      amount: BN;
      status: number;
      completedAt: BN | null;
      approvedAt: BN | null;
      disputeReason: string | null;
      disputeId: string | null;
    }[];
    bump?: number;
    contractStatus: number;
  };
  milestoneIndex: number;
  milestone: {
    description: string;
    amount: BN;
    status: number;
    completedAt: BN | null;
    approvedAt: BN | null;
    disputeReason: string | null;
    disputeId: string | null;
  };
};

// Add type for mint info
type MintInfo = {
  decimals: number;
  supply?: bigint;
  isInitialized?: boolean;
  freezeAuthority?: PublicKey | null;
  mintAuthority?: PublicKey | null;
};

// Define the ref handle type
export interface ServiceProviderContainerRef {
  refresh: () => void;
}

const ServiceProviderContainer = forwardRef<ServiceProviderContainerRef>((_, ref) => {
  const { publicKey } = useWallet();
  const { getTrustPayAccounts, getMintInfo } = useTrustPay();
  const [mintInfoCache, setMintInfoCache] = useState<Record<string, MintInfo>>({});
  const queryClient = useQueryClient();
  
  // Expose the refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ["get-trust-pay-accounts"] });
      getTrustPayAccounts.refetch();
    }
  }));
  
  // Filter contracts for milestones that belong to the current user as recipient
  const recipientPendingMilestones = useMemo(() => {
    if (!publicKey || !getTrustPayAccounts.data) return [];

    const milestones: MilestoneType[] = [];
    
    // Go through all contracts and find milestones where current user is recipient
    for (const trustPay of getTrustPayAccounts.data) {
      // Check if contract is milestone-based and user is recipient
      if (
        trustPay.account.contractType === ContractType.MILESTONE &&
        trustPay.account.recipient.equals(publicKey)
      ) {
        trustPay.account.milestones.forEach((milestone, index) => {
          // Only include pending or completed milestones (not approved or disputed)
          if (
            milestone.status === MilestoneStatus.PENDING ||
            milestone.status === MilestoneStatus.COMPLETED_BY_SP ||
            milestone.status === MilestoneStatus.DISPUTED
          ) {
            milestones.push({
              trustPay: trustPay.publicKey,
              trustPayAccount: {
                seed: trustPay.account.seed,
                payer: trustPay.account.payer,
                recipient: trustPay.account.recipient,
                mint: trustPay.account.mint,
                currency: [], // Add appropriate currency data if available
                contractType: trustPay.account.contractType,
                totalContractAmount: trustPay.account.totalContractAmount,
                pricePerToken: undefined, // Add if available
                paymentInstructions: "", // Add appropriate payment instructions
                termsAndConditions: trustPay.account.termsAndConditions,
                milestones: trustPay.account.milestones,
                bump: trustPay.account.bump,
                contractStatus: trustPay.account.contractStatus,
              },
              milestoneIndex: index,
              milestone
            });
          }
        });
      }
    }
    
    return milestones;
  }, [publicKey, getTrustPayAccounts.data]);
  
  // Fetch mint info for all relevant mints
  useEffect(() => {
    const fetchMintInfo = async () => {
      if (recipientPendingMilestones.length === 0) return;
      
      // Create a unique set of mint addresses
      const mintAddresses = Array.from(
        new Set(
          recipientPendingMilestones.map(item => 
            item.trustPayAccount.mint.toString()
          )
        )
      );
      
      // Only fetch mint info for addresses we don't already have
      const mintAddressesToFetch = mintAddresses.filter(
        mintAddress => !(mintAddress in mintInfoCache)
      );
      
      if (mintAddressesToFetch.length === 0) return;
      
      const newMintInfoCache = { ...mintInfoCache };
      
      // Fetch mint info for each unique mint
      const results = await Promise.allSettled(
        mintAddressesToFetch.map(async (mintAddress) => {
          const mintPublicKey = new PublicKey(mintAddress);
          const mintInfo = await getMintInfo(mintPublicKey);
          return { mintAddress, mintInfo };
        })
      );
      
      // Process results
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          newMintInfoCache[result.value.mintAddress] = result.value.mintInfo;
        } else {
          console.error(`Error fetching mint info:`, result.reason);
        }
      });
      
      setMintInfoCache(newMintInfoCache);
    };
    
    fetchMintInfo();
  }, [recipientPendingMilestones, getMintInfo, mintInfoCache]);
  
  // No pending milestones as recipient
  if (recipientPendingMilestones.length === 0) {
    return getTrustPayAccounts.isLoading ? (
      <div className="text-center py-8">Loading your milestones...</div>
    ) : (
      <div className="text-center py-8 text-muted-foreground">
        You do not have any pending or disputed milestones
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
        Your Pending Milestones ({recipientPendingMilestones.length})
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipientPendingMilestones.map((item) => {
          const currencyStr = String.fromCharCode(...item.trustPayAccount.currency).trim();
          // Calculate price per token from total contract amount and milestones
          const totalMilestoneAmount = item.trustPayAccount.milestones.reduce(
            (sum, m) => sum.add(m.amount),
            new BN(0)
          );
          const pricePerToken = item.trustPayAccount.pricePerToken 
            ? item.trustPayAccount.pricePerToken.toNumber() / 100
            : 0;
          
          const mintAddress = item.trustPayAccount.mint.toString();
          
          // Get mint info from cache or use fallback
          const mintInfo = mintInfoCache[mintAddress] || { decimals: 9 };
          
          return (
            <ServiceProviderCard
              key={`${item.trustPay.toString()}-${item.milestoneIndex}`}
              trustPay={item.trustPay}
              milestoneIndex={item.milestoneIndex}
              mint={item.trustPayAccount.mint}
              milestone={item.milestone}
              trustPayAccount={{
                payer: item.trustPayAccount.payer,
                recipient: item.trustPayAccount.recipient,
                paymentInstructions: item.trustPayAccount.paymentInstructions,
                termsAndConditions: item.trustPayAccount.termsAndConditions,
                contractType: item.trustPayAccount.contractType,
                contractStatus: item.trustPayAccount.contractStatus, 
              }}
              mintInfo={mintInfo}
              currency={currencyStr}
              pricePerToken={pricePerToken}
            />
          );
        })}
      </div>
    </div>
  );
});

ServiceProviderContainer.displayName = "ServiceProviderContainer";

export default ServiceProviderContainer;