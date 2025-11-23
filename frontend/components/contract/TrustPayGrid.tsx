"use client";
import useTrustPay, { ContractStatus } from "@/hooks/useTrustPay";
import React, { forwardRef, useMemo, useImperativeHandle } from "react";
import TrustPayCard from "./TrustPayCard";
import SkeletonWapper from "../SkeletonWapper";
import { useWallet } from "@solana/wallet-adapter-react";
import { TokenFilter } from "@/components/contract/Filter";

// Define the ref handle type with refresh method
export interface TrustPayGridRef {
  refresh: () => void;
}

interface TrustPayGridProps {
  filterByCurrentUser?: boolean;
  tokenFilter?: TokenFilter;
  title?: string;
  activeTab?: string;
}

const TrustPayGrid = forwardRef<TrustPayGridRef, TrustPayGridProps>(
  ({ 
    filterByCurrentUser = false, 
    tokenFilter = null,
    title,
    activeTab = "all"
  }, ref) => {
    const { getTrustPayAccounts } = useTrustPay();
    const { publicKey } = useWallet();

    // Expose refresh method to parent component
    useImperativeHandle(ref, () => ({
      refresh: () => {
        getTrustPayAccounts.refetch();
      }
    }), [getTrustPayAccounts]);

    // Get the trustPay data and apply filters based on activeTab
    const filteredTrustPayAccounts = useMemo(() => {
      const trustPayData = getTrustPayAccounts.data || [];
      
      let filtered = [];
      
      if (activeTab === "all") {
        // Show all contracts regardless of status
        filtered = trustPayData;
      } else if (activeTab === "mine") {
        // Show contracts where the connected publicKey matches either payer or recipient
        if (!publicKey) {
          return [];
        }
        filtered = trustPayData.filter(trustPay => 
          trustPay.account.payer.toString() === publicKey.toString() ||
          trustPay.account.recipient.toString() === publicKey.toString()
        );
      } else if (activeTab === "pending") {
        // Show contracts that are in pending status
        filtered = trustPayData.filter(trustPay => 
          trustPay.account.contractStatus === ContractStatus.PENDING
        );
      } else if (activeTab === "active") {
        // Show contracts that are in progress
        filtered = trustPayData.filter(trustPay => 
          trustPay.account.contractStatus === ContractStatus.IN_PROGRESS
        );
      } else if (activeTab === "completed") {
        // Show contracts that are completed
        filtered = trustPayData.filter(trustPay => 
          trustPay.account.contractStatus === ContractStatus.COMPLETED
        );
      } else if (activeTab === "awaiting-acceptance") {
        // Show contracts where the connected publicKey is the payer and status is PENDING
        if (!publicKey) {
          return [];
        }
        filtered = trustPayData.filter(trustPay => 
          trustPay.account.payer.toString() === publicKey.toString() &&
          trustPay.account.contractStatus === ContractStatus.PENDING
        );
      } else if (activeTab === "awaiting-work") {
        // Show contracts where the connected publicKey is the recipient and status is IN_PROGRESS
        if (!publicKey) {
          return [];
        }
        filtered = trustPayData.filter(trustPay => 
          trustPay.account.recipient.toString() === publicKey.toString() &&
          trustPay.account.contractStatus === ContractStatus.IN_PROGRESS
        );
      } else {
        // Fallback to existing filterByCurrentUser logic for backward compatibility
        if (filterByCurrentUser && (!publicKey)) {
          return [];
        }
        
        filtered = filterByCurrentUser && publicKey
          ? trustPayData.filter(trustPay => 
              trustPay.account.payer.toString() === publicKey.toString() ||
              trustPay.account.recipient.toString() === publicKey.toString())
          : trustPayData;
      }
        
      // Apply token filter if selected
      if (tokenFilter) {
        filtered = filtered.filter(trustPay => 
          trustPay.account.mint && trustPay.account.mint.toString() === tokenFilter
        );
      }
      
      return filtered;
    }, [
      getTrustPayAccounts.data, 
      activeTab,
      filterByCurrentUser, 
      publicKey, 
      tokenFilter
    ]);

    if (getTrustPayAccounts.isError) {
      return (
        <div className="text-center my-10">
          <h2 className="text-2xl font-semibold text-red-500">Error loading contracts</h2>
          <p className="mt-2 text-gray-600">There was an error loading the contract data.</p>
        </div>
      );
    }

    // Dynamic title based on activeTab
    const getDisplayTitle = () => {
      if (title) return title;
      
      switch (activeTab) {
        case "all":
          return "All Contracts";
        case "mine":
          return "Your Contracts";
        case "pending":
          return "Pending Contracts";
        case "active":
          return "Active Contracts";
        case "completed":
          return "Completed Contracts";
        case "awaiting-acceptance":
          return "Awaiting Your Acceptance";
        case "awaiting-work":
          return "Awaiting Your Work";
        default:
          return filterByCurrentUser ? "Your Contracts" : "Available Contracts";
      }
    };

    const displayTitle = getDisplayTitle();

    // Dynamic empty state message based on activeTab
    const getEmptyStateMessage = () => {
      switch (activeTab) {
        case "all":
          return "No contracts found.";
        case "mine":
          return "You haven't created or been assigned any contracts yet.";
        case "pending":
          return "No pending contracts at the moment.";
        case "active":
          return "No active contracts in progress.";
        case "completed":
          return "No completed contracts yet.";
        case "awaiting-acceptance":
          return "No contracts awaiting your acceptance.";
        case "awaiting-work":
          return "No contracts awaiting your work.";
        default:
          return filterByCurrentUser 
            ? "You haven't created or been assigned any contracts matching these filters." 
            : "No contracts match the selected filters.";
      }
    };

    if (getTrustPayAccounts.isLoading) {
    return <SkeletonWapper isLoading={true}>...</SkeletonWapper>;
}

    if (filteredTrustPayAccounts.length === 0) {
      return (
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">{displayTitle}</h2>
          </div>
          <div className="text-center my-10">
            <h2 className="text-2xl font-semibold">No contracts found</h2>
            <p className="mt-2 text-gray-600">
              {getEmptyStateMessage()}
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <SkeletonWapper isLoading={getTrustPayAccounts.isLoading}>
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">{displayTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrustPayAccounts.map((trustPay) => (
              <TrustPayCard key={trustPay.publicKey.toString()} data={trustPay} />
            ))}
          </div>
        </div>
      </SkeletonWapper>
    );
  }
);

TrustPayGrid.displayName = "TrustPayGrid";

export default TrustPayGrid;