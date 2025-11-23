"use client";
import React, { useState, useEffect, useRef} from "react";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import TrustPayGrid from "@/components/contract/TrustPayGrid";
import { TrustPayGridRef } from "@/components/contract/TrustPayGrid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Users, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CreateContractButton from "@/components/contract/CreateContractButton";
import UserVolumeCard from "@/components/contract/userVolumeCard";


const PayDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("my-contracts");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs to component methods
  const myContractsGridRef = useRef<TrustPayGridRef>(null);
  const acceptedContractsGridRef = useRef<TrustPayGridRef>(null);

  // Handle URL query parameters for tab selection
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['my-contracts', 'accepted-contracts'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/users/contracts?tab=${value}`, { scroll: false });
  };

  // Animated refresh handler
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    // Add a subtle delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Use the appropriate ref's refresh method based on active tab
      if (activeTab === "my-contracts" && myContractsGridRef.current) {
        myContractsGridRef.current.refresh();
      } else if (activeTab === "accepted-contracts" && acceptedContractsGridRef.current) {
        acceptedContractsGridRef.current.refresh();
      }

      queryClient.invalidateQueries({ queryKey: ["get-trust-pay-accounts-dashboard"] });
      
      // Add success animation delay
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case "my-contracts":
        return <Users className="w-4 h-4 mr-2" />;
      case "accepted-contracts":
        return <CheckCircle className="w-4 h-4 mr-2" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-start mb-12">
        <div className="text-center flex-1">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent tracking-tight">
            Trust Pay Dashboard
          </h1>
        </div>
        <div className="ml-8">
          <UserVolumeCard />
        </div>
      </div>
      <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}>
        <Tabs 
          defaultValue="my-contracts" 
          value={activeTab} 
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 lg:w-[700px] mx-auto bg-gradient-to-r from-gray-800/50 to-gray-800/50 border border-gray-600 p-1">
            <TabsTrigger 
              value="my-contracts"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all duration-300"
            >
              {getTabIcon("my-contracts")}
              My Contracts
              <Badge variant="outline" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 border-blue-300">
                Client
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="accepted-contracts"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-orange-600 data-[state=active]:text-white transition-all duration-300"
            >
              {getTabIcon("accepted-contracts")}
              Accepted Contracts
              <Badge variant="outline" className="ml-2 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 border-amber-300">
                SP
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* My Contracts Tab */}
          <TabsContent value="my-contracts" className="mt-6">
            <Card className={cn(
              "transition-all duration-500 transform",
              isRefreshing && activeTab === "my-contracts" ? "opacity-70 scale-[0.98]" : "opacity-100 scale-100"
            )}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Active Contracts</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className={cn(
                        "transition-all duration-300 transform hover:scale-105",
                        isRefreshing && "scale-95 opacity-80"
                      )}
                    >
                      <RefreshCcw className={cn(
                        "mr-2 h-4 w-4 transition-all duration-700",
                        isRefreshing ? 'animate-spin text-blue-500' : 'hover:rotate-180'
                      )} />
                      <span className="transition-all duration-300">
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                      </span>
                    </Button>
                    <CreateContractButton/>
                  </div>
                </div>
                <CardDescription>
                  View and manage all Trust Contracts you have created
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrustPayGrid 
                  ref={myContractsGridRef} 
                  filterByCurrentUser={true}
                  activeTab="my-contracts"
                  title=""
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accepted Contracts Tab */}
          <TabsContent value="accepted-contracts" className="mt-6">
            <Card className={cn(
              "transition-all duration-500 transform",
              isRefreshing && activeTab === "accepted-contracts" ? "opacity-70 scale-[0.98]" : "opacity-100 scale-100"
            )}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Pending Contracts (Service Provider)</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={cn(
                      "transition-all duration-300 transform hover:scale-105",
                      isRefreshing && "scale-95 opacity-80"
                    )}
                  >
                    <RefreshCcw className={cn(
                      "mr-2 h-4 w-4 transition-all duration-700",
                      isRefreshing ? 'animate-spin text-blue-500' : 'hover:rotate-180'
                    )} />
                    <span className="transition-all duration-300">
                      {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </span>
                  </Button>
                </div>
                <CardDescription>
                  View contracts you have accepted and are working on
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrustPayGrid 
                  ref={acceptedContractsGridRef} 
                  filterByCurrentUser={false}
                  activeTab="accepted-contracts"
                  title=""
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PayDashboard;