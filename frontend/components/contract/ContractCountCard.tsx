"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import useTrustPay from "@/hooks/useTrustPay";
import { Progress } from "../ui/progress";
import { useEffect, useState } from "react";
import { TRANSACTION_EVENT, TransactionType } from "@/hooks/transactionEventDispatcher";
import { PublicKey } from "@solana/web3.js";
import { TrendingUp, RefreshCw, Activity, BarChart3 } from "lucide-react";
import { Button } from "../ui/button";

interface ContractStats {
  activeCount: number;
  totalCreated: number;
  totalCompleted: number;
  completionRate: number;
}

const ContractCountCard: React.FC = () => {
  const { getTrustPayAccounts, program } = useTrustPay();
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<ContractStats>({
    activeCount: 0,
    totalCreated: 0,
    totalCompleted: 0,
    completionRate: 0,
  });
  const [previousActiveCount, setPreviousActiveCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Load global state data on initial render
  useEffect(() => {
    fetchGlobalStateData();
    
    // Set up a polling interval to refresh data periodically
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchGlobalStateData();
      }
    }, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Set up transaction event listener
  useEffect(() => {
    const handleTransactionEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const txDetails = customEvent.detail;
      
      if (txDetails.type === TransactionType.PAYMENT_CONFIRMED || 
          txDetails.type === TransactionType.CONTRACT_CREATED || 
          txDetails.type === TransactionType.CONTRACT_ACCEPTED || 
          txDetails.type === TransactionType.MILESTONE_APPROVED ||
          txDetails.type === TransactionType.GLOBAL_STATE_INITIALIZED) {
        fetchGlobalStateData();
      }
    };
    
    window.addEventListener(TRANSACTION_EVENT, handleTransactionEvent);
    
    return () => {
      window.removeEventListener(TRANSACTION_EVENT, handleTransactionEvent);
    };
  }, []);

  const fetchGlobalStateData = async () => {
    setIsLoading(true);

    try {
      // Fetch all trust pay accounts to calculate active count
      const trustPayResult = await getTrustPayAccounts.refetch();
      const activeCount = trustPayResult.data?.length || 0;
      
      // Find global state PDA address
      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global-state")],
        program.programId
      );
      
      // Fetch the global state account with error handling
        let globalStateData;
      try {
        globalStateData = await program.account.globalState.fetch(globalState);
      } catch (fetchError: unknown) {
        // Check if account doesn't exist yet
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        if (errorMessage.includes('Account does not exist') || 
            errorMessage.includes('has no data')) {
          console.log("Global state account not yet initialized");
          globalStateData = null;
        } else {
          throw fetchError; // Re-throw if it's a different error
        }
      }
      
      if (globalStateData) {
        // Use correct property names from IDL (snake_case)
        const newTotalCreated = globalStateData.totalTrustPayCreated.toNumber();
        const newTotalCompleted = globalStateData.totalTrustPayClosed.toNumber();
        
        // Store previous active count for trend calculation
        setPreviousActiveCount(stats.activeCount);
        
        // Calculate completion rate
        const newCompletionRate = newTotalCreated > 0 
          ? (newTotalCompleted / newTotalCreated) * 100 
          : 0;
        
        // Update stats in single state update
        setStats({
          activeCount,
          totalCreated: newTotalCreated,
          totalCompleted: newTotalCompleted,
          completionRate: newCompletionRate,
        });
      } else {
        // Fallback: only update active count
        setPreviousActiveCount(stats.activeCount);
        setStats(prev => ({
          ...prev,
          activeCount,
          completionRate: prev.totalCreated > 0 
            ? (prev.totalCompleted / prev.totalCreated) * 100 
            : 0,
        }));
      }
    } catch (e) {
      console.error("Error fetching global state data:", e);
      // Fallback to trust pay count only
      try {
        const trustPayResult = await getTrustPayAccounts.refetch();
        const activeCount = trustPayResult.data?.length || 0;
        
        setPreviousActiveCount(stats.activeCount);
        setStats(prev => ({
          ...prev,
          activeCount,
          completionRate: prev.totalCreated > 0 
            ? (prev.totalCompleted / prev.totalCreated) * 100 
            : 0,
        }));
      } catch (fallbackError) {
        console.error("Error in fallback fetch:", fallbackError);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Manual refresh handler
  const handleRefresh = (): void => {
    setIsRefreshing(true);
    fetchGlobalStateData();
  };

  // Calculate trend for display
  const getTrendInfo = () => {
    if (isLoading) {
      return { text: "Loading...", positive: null };
    }
    
    const change = stats.activeCount - previousActiveCount;
    
    if (stats.totalCreated > 0) {
      if (change > 0) {
        return { text: `+${change} new contracts`, positive: true };
      } else if (change < 0) {
        return { text: `${Math.abs(change)} contracts completed`, positive: true };
      } else {
        return { text: "Stable", positive: null };
      }
    }
    
    if (change > 0) {
      return { text: `+${change} active`, positive: true };
    } else if (change < 0) {
      return { text: `${change} active`, positive: false };
    } else {
      return { text: "No change", positive: null };
    }
  };

  const trendInfo = getTrendInfo();

  return (
    <Card className="group relative overflow-hidden border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-[1.02]">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Subtle border glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardHeader className="relative pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur-sm opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 p-2.5 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <CardDescription className="text-gray-300 font-medium text-sm tracking-wide">
                Active Contracts
              </CardDescription>
              <div className="flex items-center space-x-2 mt-1">
                <Activity className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400 font-medium">Live Data</span>
              </div>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-lg hover:bg-gray-700 transition-all duration-300 hover:scale-110" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh contract data"
          >
            <RefreshCw className={`h-4 w-4 text-gray-300 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
          </Button>
        </div>
        
        <div className="space-y-2">
          <CardTitle className="text-5xl font-bold bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent tracking-tight">
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-2xl text-gray-400">Loading...</span>
              </div>
            ) : (
              <span className="transition-all duration-700 hover:scale-105 inline-block">
                {stats.activeCount}
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
              trendInfo.positive === true
                ? 'bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50' 
                : trendInfo.positive === false
                ? 'bg-red-900/50 text-red-300 hover:bg-red-800/50'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
            }`}>
              <TrendingUp className="w-3 h-3" />
              <span>{trendInfo.text}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-medium">Completion Rate</span>
            <span className="text-gray-300 font-semibold">{stats.completionRate.toFixed(1)}%</span>
          </div>
          
          <div className="relative">
            <Progress
              value={stats.completionRate}
              className="h-2 bg-gray-700 rounded-full overflow-hidden"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-20 animate-pulse" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 pt-2">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400 font-medium">Total Created:</span>
              <span className="text-lg font-bold text-white">
                {stats.totalCreated}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-xs text-gray-400 font-medium">Completed</div>
                <div className="text-lg font-bold text-green-400">
                  {stats.totalCompleted}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-400 font-medium">Closed</div>
                <div className="text-lg font-bold text-gray-300">
                  {stats.totalCreated - (stats.totalCompleted + stats.activeCount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContractCountCard;