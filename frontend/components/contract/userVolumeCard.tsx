import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PublicKey } from "@solana/web3.js";
import { TrendingUp, RefreshCw, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { TRANSACTION_EVENT, TransactionType } from "@/hooks/transactionEventDispatcher";
import useTrustPay, { MilestoneStatus } from "@/hooks/useTrustPay";
import { useWallet } from "@solana/wallet-adapter-react";

// Cache to store mint decimals
const mintDecimalsCache: Record<string, number> = {};

interface VolumeCardProps {
  className?: string;
}

interface PaymentTransaction {
  type: TransactionType;
  signature?: string;
  timestamp: number;
  amount?: number;
  TrustPay?: PublicKey;
  details?: {
    reservationIndex?: number;
  };
}

interface UserVolumeData {
  currentVolume: number;
  previousVolume: number;
  lastUpdateTimestamp: number;
  volumeHistory: {timestamp: number, volume: number}[];
  transactionCount: number;
}

const UserVolumeCard: React.FC<VolumeCardProps> = ({ className }) => {
  const [currentMonthVolume, setCurrentMonthVolume] = useState<number>(0);
  const [volumeChange, setVolumeChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [transactionCount, setTransactionCount] = useState<number>(0);
  
  const { getTrustPayAccounts, getMintInfo } = useTrustPay();
  const { publicKey: userPublicKey } = useWallet();
  const processingRef = useRef<boolean>(false);
  const userVolumeDataRef = useRef<UserVolumeData>({
    currentVolume: 0,
    previousVolume: 0,
    lastUpdateTimestamp: 0,
    volumeHistory: [],
    transactionCount: 0
  });

  // Debug log to console with timestamp
  const debugLog = (message: string, data?: unknown): void => {
    const now = new Date();
    const timestamp = `${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    console.log(`[${timestamp}] ${message}`, data || '');
  };
  
  // Function to get mint decimals with caching
  const getMintDecimalsWithCache = useCallback(async (mintAddress: PublicKey): Promise<number> => {
    const addressStr = mintAddress.toString();
    
    // Return from cache if available
    if (mintDecimalsCache[addressStr] !== undefined) {
      debugLog(`Using cached decimals for mint ${addressStr.slice(0, 8)}...`);
      return mintDecimalsCache[addressStr];
    }
    
    try {
      // Fetch and cache mint info
      debugLog(`Fetching mint info for ${addressStr.slice(0, 8)}...`);
      const mintInfo = await getMintInfo(mintAddress);
      mintDecimalsCache[addressStr] = mintInfo.decimals;
      debugLog(`Cached mint decimals: ${mintInfo.decimals}`);
      return mintInfo.decimals;
    } catch (err) {
      console.error(`Error fetching mint info for ${addressStr}:`, err);
      return 9; // Default to 9 decimals if there's an error
    }
  }, [getMintInfo]);

  // Fetch user's volume by querying TrustPay accounts
  const fetchUserVolumeData = useCallback(async (): Promise<void> => {
    if (!userPublicKey) {
      debugLog('No user wallet connected');
      setIsLoading(false);
      return;
    }

    // Prevent concurrent processing
    if (processingRef.current) {
      debugLog('Already processing a fetch, skipping');
      return;
    }
    
    processingRef.current = true;
    setIsLoading(true);
    
    try {
      debugLog('Fetching user TrustPay accounts', { 
        user: userPublicKey.toString().slice(0, 8) + '...' 
      });
      
      // Get all TrustPay accounts where user is payer or recipient
      const allTrustPayAccountsData = getTrustPayAccounts.data;

      if (!allTrustPayAccountsData) {
        debugLog('No TrustPay accounts data available');
        setCurrentMonthVolume(0);
        setVolumeChange(0);
        setTransactionCount(0);
        return;
      }
      // Filter for accounts involving this user
      const userAccounts = allTrustPayAccountsData.filter(accountData => 
        accountData.account.payer.equals(userPublicKey) || accountData.account.recipient.equals(userPublicKey)
      );

      
      debugLog(`Found ${userAccounts.length} TrustPay accounts for user`);
      
      if (userAccounts.length === 0) {
        setCurrentMonthVolume(0);
        setVolumeChange(0);
        setTransactionCount(0);
        return;
      }
      
      let totalVolume = 0;
      let transactionCount = 0;
      const now = Date.now();
      
      // Process each TrustPay account
      for (const accountData of userAccounts) {
      const trustPayAccount = accountData.account;
      const decimals = await getMintDecimalsWithCache(trustPayAccount.mint);
      

        // Sum up all approved milestones
        for (const milestone of trustPayAccount.milestones) {
          if (milestone.status === MilestoneStatus.APPROVED_BY_PAYER) {
            const rawAmount = milestone.amount.toNumber();
            const readableAmount = rawAmount / Math.pow(10, decimals);
            
            totalVolume += readableAmount;
            transactionCount++;
          }
        }
      }
      
      debugLog('Calculated volumes', {
        total: totalVolume,
        transactionCount
      });
      
      // Update state
      setCurrentMonthVolume(totalVolume);
      setTransactionCount(transactionCount);
      
      // Calculate percentage change (using stored previous if available)
      const previousVolume = userVolumeDataRef.current.previousVolume;
      if (previousVolume > 0) {
        const change = ((totalVolume - previousVolume) / previousVolume) * 100;
        setVolumeChange(Math.round(change * 10) / 10);
      } else if (totalVolume > 0) {
        setVolumeChange(100);
      } else {
        setVolumeChange(0);
      }
      
      // Update stored data
      userVolumeDataRef.current = {
        currentVolume: totalVolume,
        previousVolume: previousVolume || totalVolume * 0.8, // Use 80% as fallback
        lastUpdateTimestamp: now,
        volumeHistory: [
          ...userVolumeDataRef.current.volumeHistory,
          { timestamp: now, volume: totalVolume }
        ].slice(-30),
        transactionCount
      };

    } catch (error) {
      console.error("Error fetching user volume data:", error);
      
      // On error, use stored values if available
      if (userVolumeDataRef.current.currentVolume > 0) {
        setCurrentMonthVolume(userVolumeDataRef.current.currentVolume);
        setTransactionCount(userVolumeDataRef.current.transactionCount);
        
        if (userVolumeDataRef.current.previousVolume > 0) {
          const change = ((userVolumeDataRef.current.currentVolume - userVolumeDataRef.current.previousVolume) / 
                        userVolumeDataRef.current.previousVolume) * 100;
          setVolumeChange(Math.round(change * 10) / 10);
        }
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      processingRef.current = false;
    }
  }, [userPublicKey, getTrustPayAccounts.data, getMintDecimalsWithCache]);

  // Initialize data on mount
  useEffect(() => {
    if (userPublicKey) {
      debugLog('User wallet connected, fetching volume data');
      fetchUserVolumeData();
    } else {
      debugLog('No wallet connected');
      setIsLoading(false);
    }
  }, [userPublicKey, fetchUserVolumeData]);

  // Set up transaction event listener for real-time updates
  useEffect(() => {
  const handleTransaction = async (event: Event) => {
    const customEvent = event as CustomEvent<PaymentTransaction>;
    const txDetails = customEvent.detail;
    
    debugLog('Transaction event received', {
      type: txDetails.type,
      signature: txDetails.signature,
      timestamp: new Date(txDetails.timestamp).toLocaleTimeString(),
      amount: txDetails.amount,
    });
    
    // Update on PAYMENT_CONFIRMED events (milestone payments)
    if (txDetails.type === TransactionType.PAYMENT_CONFIRMED && userPublicKey) {
      debugLog('*** PAYMENT_CONFIRMED DETECTED - Refreshing user volume ***');
      
      // Just refresh from blockchain data
      setTimeout(() => {
        fetchUserVolumeData();
      }, 2000);
    }
  };
  
  window.addEventListener(TRANSACTION_EVENT, handleTransaction);
  
  return () => {
    window.removeEventListener(TRANSACTION_EVENT, handleTransaction);
  };
}, [userPublicKey, fetchUserVolumeData]);

  // Helper function to format currency compactly
  const formatCompactCurrency = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Manual refresh handler
  const handleRefresh = (): void => {
    if (!userPublicKey) return;
    setIsRefreshing(true);
    fetchUserVolumeData();
  };

  const isPositiveChange = volumeChange >= 0;

  // Show message if no wallet connected
  if (!userPublicKey) {
    return (
      <Card className={`group relative overflow-hidden border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-2xl ${className}`}>
        <CardHeader className="relative z-10 pb-6 space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Activity className="w-8 h-8 text-gray-400 mx-auto" />
              <CardTitle className="text-xl text-gray-300">Connect Wallet</CardTitle>
              <CardDescription className="text-gray-400">
                Connect your wallet to view your trading volume
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={`group relative overflow-hidden border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-[1.02] ${className}`}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Subtle border glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <CardHeader className="relative z-10 pb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur-sm opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
              <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 p-2.5 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <CardDescription className="text-gray-300 font-medium text-sm tracking-wide">
                My Trading Volume
              </CardDescription>
              <div className="flex items-center space-x-2 mt-1">
                <Activity className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400 font-medium">
                  {transactionCount} completed contracts
                </span>
              </div>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-lg hover:bg-gray-700 transition-all duration-300 hover:scale-110" 
            onClick={handleRefresh}
            disabled={isRefreshing || !userPublicKey}
            title="Refresh volume data"
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
              <span className="transition-all duration-700 inline-block">
                {formatCompactCurrency(currentMonthVolume)}
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
              isPositiveChange 
                ? 'bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50' 
                : 'bg-red-900/50 text-red-300 hover:bg-red-800/50'
            }`}>
              {isPositiveChange ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              <span>
                {volumeChange >= 0 ? "+" : ""}{volumeChange.toFixed(1)}%
              </span>
            </div>
            <span className="text-sm text-gray-400 font-medium">growth</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-medium">Volume Growth</span>
            <span className="text-gray-300 font-semibold">{Math.min(Math.abs(volumeChange), 100).toFixed(0)}%</span>
          </div>
          
          <div className="relative">
            <Progress
              value={Math.min(Math.abs(volumeChange), 100)}
              className="h-2 bg-gray-700 rounded-full overflow-hidden"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-20 animate-pulse" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <div className="text-xs text-gray-400 font-medium">Total Volume</div>
            <div className="text-lg font-bold text-white">
              {formatCompactCurrency(currentMonthVolume)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-gray-400 font-medium">Transactions</div>
            <div className="text-lg font-bold text-gray-300">
              {transactionCount}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserVolumeCard;