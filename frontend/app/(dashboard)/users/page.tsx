"use client";
import ContractCountCard from "@/components/contract/ContractCountCard";
import CreateContractButton from "@/components/contract/CreateContractButton";
import PayVolumeCard from "@/components/contract/PayVolumeCard";
import AirdropTokens from "@/components/airdrop/AirdropTokens";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import useTrustPay from "@/hooks/useTrustPay";
import { TrustPayGridRef } from "@/components/contract/TrustPayGrid";
import ContractTabs from "./TrustPayTabs";
import  { FilterState } from "@/components/contract/Filter";



const TrustPayPage: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const [filters, setFilters] = useState<FilterState>({
    token: null,
    currency: null,
    sort: null,
  });

  // Reference to the TrustPayGrid component
  const trustPayGridRef = useRef<TrustPayGridRef>(null);
  
  // Get TrustPay program
  const { program } = useTrustPay();
  
  // Query for TrustPay accounts - shared with the whole page
  const { data: trustPayAccounts, isLoading, refetch } = useQuery({
    queryKey: ["get-trust-pay-accounts"],
    queryFn: async () => {
      if (!program) return [];
      return await program.account.trustPay.all();
    },
    enabled: !!program,
  });

  // Extract unique tokens and currencies for filter options
  const { tokens, currencies } = useMemo(() => {
    if (!trustPayAccounts) {
      return { tokens: [], currencies: [] };
    }

    const uniqueTokens = new Set<string>();

    trustPayAccounts.forEach((account) => {
      // Add token if it exists
      if (account.account.mint) {
        uniqueTokens.add(account.account.mint.toString());
      }
    });

    return {
      tokens: Array.from(uniqueTokens).map((token) => ({
        value: token,
        label: token.substring(0, 4) + "..." + token.substring(token.length - 4),
      })),
      currencies: [], // Remove currencies as they're not part of the new structure
    };
  }, [trustPayAccounts]);

  // Handle filter changes with useCallback to prevent unnecessary re-renders
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Handle refresh with useCallback
  
  const handleRefresh = () => {
    trustPayGridRef.current?.refresh();
  };

  return (
  <div className="container mx-auto py-10">
    <div className={`space-y-6 transition-all duration-1000 ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Your Trust Pay</CardTitle>
            <CardDescription className="max-w-lg text-balance leading-relaxed">
              Manage your Contracts
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-2 sm:gap-3">
            <CreateContractButton />
            <AirdropTokens/>
          </CardFooter>
        </Card>
        <ContractCountCard/>
        
        <PayVolumeCard />
        
      </div>
      
      <ContractTabs 
        tokens={tokens}
        onFilterChange={handleFilterChange}
        trustPayGridRef={trustPayGridRef}
        filters={filters}
      />
    </div>
  </div>
);
};

export default TrustPayPage;