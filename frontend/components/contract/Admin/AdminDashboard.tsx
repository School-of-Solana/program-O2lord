"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import useTrustPay, { MilestoneStatus } from '@/hooks/useTrustPay';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import { ResolveContractDisputeButton } from '@/components/contract/Admin/ResolveContractDisputeButton';
import TokenDisplay from '@/components/TokenDisplay';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ExplorerLink from '@/components/ExplorerLink';
import { 
  ShieldAlert, 
  AlertTriangle, 
  UserCheck, 
  Clock, 
  User, 
  Coins, 
  Search,
} from 'lucide-react';
import { getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';

interface DisputeInfo {
  trustPay: PublicKey;
  milestoneIndex: number;
  payer: string;
  recipient: string;
  amount: number;
  disputeReason: string;
  timestamp: number;
  disputeId: string;
  milestoneDescription: string;
  contractTitle: string;
  mint: PublicKey;
}

// Component to display token amount with metadata
const DisputeTokenDisplay = ({ amount, mint }: { amount: number; mint: PublicKey }) => {
  const tokenMetadata = useTokenMetadata(mint);
  
  return (
    <TokenDisplay
      amount={amount.toLocaleString()}
      symbol={tokenMetadata?.metadata?.symbol || "TOKEN"}
      logoURI={tokenMetadata?.metadata?.logoURI}
      showSymbol={true}
      className="font-medium"
      imageSize={16}
    />
  );
};

export default function AdminDashboard() {
  const [disputes, setDisputes] = useState<DisputeInfo[]>([]);
  const [isResolver, setIsResolver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({
    totalDisputes: 0,
    activeDisputes: 0,
    resolvedDisputes: 0,
    resolutionRate: 0,
  });
  const { publicKey } = useWallet();
  const { getTrustPayAccounts, getGlobalState } = useTrustPay();
  
  const connection = useMemo(() => new Connection('https://api.devnet.solana.com'), []);

  // Cache for mint decimals to avoid repeated API calls
  const [mintDecimalsCache, setMintDecimalsCache] = useState<Map<string, number>>(new Map());

  const toggleCollapsible = (id: string) => {
    setOpenCollapsibles(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Validate if a PublicKey represents a valid mint account
  const isValidMintAddress = (mintAddress: PublicKey): boolean => {
    try {
      const zeroKey = new PublicKey('11111111111111111111111111111111');
      if (mintAddress.equals(zeroKey)) {
        return false;
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  // Enhanced function to get token decimals
 const getTokenDecimals = useCallback(async (mint: PublicKey): Promise<number> => {
  const mintKey = mint.toString();
  
  if (mintDecimalsCache.has(mintKey)) {
    return mintDecimalsCache.get(mintKey)!;
  }
  
  if (!isValidMintAddress(mint)) {
    console.warn(`Invalid mint address: ${mintKey}`);
    const fallbackDecimals = 6;
    setMintDecimalsCache(prev => new Map(prev).set(mintKey, fallbackDecimals));
    return fallbackDecimals;
  }
  
  try {
    const accountInfo = await connection.getAccountInfo(mint);
    
    if (!accountInfo) {
      console.warn(`Mint account not found: ${mintKey}`);
      const fallbackDecimals = 6;
      setMintDecimalsCache(prev => new Map(prev).set(mintKey, fallbackDecimals));
      return fallbackDecimals;
    }
    
    const isTokenProgram = accountInfo.owner.equals(TOKEN_PROGRAM_ID);
    const isToken2022Program = accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
    
    if (!isTokenProgram && !isToken2022Program) {
      console.warn(`Mint account not owned by token program: ${mintKey}`);
      const fallbackDecimals = 6;
      setMintDecimalsCache(prev => new Map(prev).set(mintKey, fallbackDecimals));
      return fallbackDecimals;
    }
    
    let mintInfo;
    if (isToken2022Program) {
      mintInfo = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
    } else {
      mintInfo = await getMint(connection, mint);
    }
    
    const decimals = mintInfo.decimals;
    setMintDecimalsCache(prev => new Map(prev).set(mintKey, decimals));
    
    return decimals;
  } catch (error) {
    console.warn(`Error fetching mint decimals for ${mintKey}:`, error);
    const fallbackDecimals = 6;
    setMintDecimalsCache(prev => new Map(prev).set(mintKey, fallbackDecimals));
    return fallbackDecimals;
  }
}, [mintDecimalsCache, connection]);
  
  const loadDisputes = useCallback(async () => {
    if (!publicKey) {
      setIsLoading(false);
      return;
    }

      console.log("Loading disputes for publicKey:", publicKey.toBase58());

    
    try {
      // Check if the current user is a resolver (admin)
       const adminPubkey = process.env.NEXT_PUBLIC_ADMIN_WALLET;
    if (adminPubkey && publicKey.toBase58() === adminPubkey) {
      setIsResolver(true);
    }
      
      const trustPayAccounts = await getTrustPayAccounts.refetch();
      
      if (!trustPayAccounts.data) {
        setIsLoading(false);
        return;
      }
      
      const allDisputes: DisputeInfo[] = [];
      let resolvedCount = 0;
      
      for (const trustPayData of trustPayAccounts.data) {
        const contract = trustPayData.account;
        
        try {
          const decimals = await getTokenDecimals(contract.mint);

          contract.milestones.forEach((milestone, index) => {
            if (milestone.status === MilestoneStatus.DISPUTED) {
              const reason = milestone.disputeReason || "No reason provided";
              const timestamp = milestone.completedAt ? milestone.completedAt.toNumber() * 1000 : Date.now();
              const amount = Number(milestone.amount.toString()) / Math.pow(10, decimals);
              
              allDisputes.push({
                trustPay: trustPayData.publicKey,
                milestoneIndex: index,
                payer: contract.payer.toString(),
                recipient: contract.recipient.toString(),
                amount: amount,
                disputeReason: reason,
                timestamp: timestamp,
                disputeId: milestone.disputeId || "Unknown",
                milestoneDescription: milestone.description || `Milestone ${index + 1}`,
                contractTitle: contract.title || "Untitled Contract",
                mint: contract.mint
              });
            }
            if (milestone.status === MilestoneStatus.APPROVED_BY_PAYER) {
              resolvedCount++;
            }
          });
        } catch (error) {
          console.error(`Error processing contract ${trustPayData.publicKey.toString()}:`, error);
        }
      }
      
      allDisputes.sort((a, b) => b.timestamp - a.timestamp);
      
      setDisputes(allDisputes);
      
      const totalDisputes = allDisputes.length + resolvedCount;
      const resolutionRate = totalDisputes > 0 ? (resolvedCount / totalDisputes) * 100 : 0;
      
      setStats({
        totalDisputes: totalDisputes,
        activeDisputes: allDisputes.length,
        resolvedDisputes: resolvedCount,
        resolutionRate: resolutionRate
      });
    } catch (error) {
      console.error("Error loading disputes:", error);
    } finally {
      setIsLoading(false);
    }
    }, [publicKey, getTrustPayAccounts, getGlobalState, getTokenDecimals]);

  
  useEffect(() => {
    if (!publicKey) return;
    loadDisputes();
  }, []);
  
  const handleDisputeResolved = (index: number) => {
    setDisputes((prevDisputes) => {
      const newDisputes = [...prevDisputes];
      newDisputes.splice(index, 1);
      
      setStats(prev => ({
        ...prev,
        activeDisputes: prev.activeDisputes - 1,
        resolvedDisputes: prev.resolvedDisputes + 1,
        resolutionRate: ((prev.resolvedDisputes + 1) / prev.totalDisputes) * 100
      }));
      
      return newDisputes;
    });
  };

  const filteredDisputes = disputes.filter(dispute => 
    dispute.disputeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dispute.payer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dispute.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dispute.contractTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Progress value={30} className="w-64 mb-4" />
        <p className="text-center">Loading dispute data...</p>
      </div>
    );
  }
  
  if (!publicKey) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-xl mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please connect your wallet to access the admin dashboard.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!isResolver) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-xl mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unauthorized Access</AlertTitle>
        <AlertDescription>
          You do not have the required permissions to access the admin dashboard.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Notice
          </CardTitle>
          <CardDescription>
            Admins should use this dashboard to monitor and resolve disputes across the platform and make sure the proof provided are correct before resolving dispute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="group/stat relative overflow-hidden border border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 opacity-0 group-hover/stat:opacity-100 transition-opacity duration-300" />
              <CardContent className="pt-6 relative">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-400">Total Disputes</span>
                    <span className="text-2xl font-bold text-white">{stats.totalDisputes}</span>
                  </div>
                  <div className='relative'>
                    <div className="absolute inset-0 bg-amber-500 rounded-full blur-sm opacity-30" />
                    <AlertTriangle className="h-8 w-8 text-amber-400 relative" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group/stat relative overflow-hidden border border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-pink-500/5 opacity-0 group-hover/stat:opacity-100 transition-opacity duration-300" />
              <CardContent className="pt-6 relative">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Active Disputes</span>
                    <span className="text-2xl font-bold">{stats.activeDisputes}</span>
                  </div>
                  <div className='relative'>
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-sm opacity-30" />
                    <ShieldAlert className="h-8 w-8 text-red-400 relative" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group/stat relative overflow-hidden border border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover/stat:opacity-100 transition-opacity duration-300" />
              <CardContent className="pt-6 relative">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Resolved Disputes</span>
                    <span className="text-2xl font-bold">{stats.resolvedDisputes}</span>
                  </div>
                  <div className='relative'>
                    <div className="absolute inset-0 bg-green-500 rounded-full blur-sm opacity-30" />
                    <UserCheck className="h-8 w-8 text-green-400 relative" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group/stat relative overflow-hidden border border-gray-700 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 opacity-0 group-hover/stat:opacity-100 transition-opacity duration-300" />
              <CardContent className="pt-6 relative">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Resolution Rate</span>
                    <span className="text-2xl font-bold">{stats.resolutionRate.toFixed(2)}%</span>
                  </div>
                  <div className='relative'>
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-sm opacity-30" />
                    <Clock className="h-8 w-8 text-blue-400 relative" />
                  </div>
                </div>
                <Progress value={stats.resolutionRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>
          
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 rounded-lg border border-gray-600 p-1 bg-gray-700 focus-within:border-blue-500">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-300" />
              <Input
                placeholder="Search by Dispute ID, Contract Title, Payer or Recipient address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-transparent border-none outline-none focus:ring-0"
              />
            </div>
            {searchQuery && (
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear
              </Button>
            )}
          </div>
          
          {filteredDisputes.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              {searchQuery ? (
                <>
                  <Search className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium">No Disputes Found</h3>
                  <p className="text-muted-foreground mt-1">No disputes match your search criteria.</p>
                </>
              ) : (
                <>
                  <ShieldAlert className="mx-auto h-12 w-12 text-green-500 mb-3" />
                  <h3 className="text-lg font-medium">No Active Disputes</h3>
                  <p className="text-muted-foreground mt-1">All contracts are currently operating smoothly.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-medium text-white">Active Disputes ({filteredDisputes.length})</h3>
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                  Requires Attention
                </Badge>
              </div>
              
              {filteredDisputes.map((dispute, index) => {
                const disputeId = `${dispute.trustPay.toString()}-${dispute.milestoneIndex}`;
                
                return (
                  <Card key={disputeId} className="border-red-200 dark:border-red-900">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          <span className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                            Dispute #{index + 1}
                          </span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300">
                            Active Dispute
                          </Badge>
                          <Badge variant="secondary" className="font-mono">
                            ID: {dispute.disputeId}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        {new Date(dispute.timestamp).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pb-4">
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-100 dark:border-blue-900">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">Contract</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-300">{dispute.contractTitle}</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Payer:</span>
                            <ExplorerLink type="address" value={dispute.payer}>
                              <span className="font-medium">{dispute.payer.slice(0, 4)}...{dispute.payer.slice(-4)}</span>
                            </ExplorerLink>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Recipient:</span>
                            <ExplorerLink type='address' value={dispute.recipient}>
                              <span className="font-medium">{dispute.recipient.slice(0, 4)}...{dispute.recipient.slice(-4)}</span>
                            </ExplorerLink>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Coins className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Milestone Amount:</span>
                            <DisputeTokenDisplay amount={dispute.amount} mint={dispute.mint} />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Milestone Description:</h4>
                          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md text-sm border border-gray-200 dark:border-gray-800">
                            {dispute.milestoneDescription}
                          </div>
                          
                          <h4 className="text-sm font-medium mt-3">Dispute Reason:</h4>
                          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md text-sm text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900">
                            {dispute.disputeReason}
                          </div>
                        </div>
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="flex justify-end">
                        <ResolveContractDisputeButton
                          trustPay={dispute.trustPay}
                          milestoneIndex={dispute.milestoneIndex}
                          isResolver={isResolver}
                          milestoneDescription={dispute.milestoneDescription}
                          onResolved={() => handleDisputeResolved(index)}
                          className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-300 dark:hover:bg-amber-800"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}