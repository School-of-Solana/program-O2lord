"use client";
import React, { useState, useRef } from "react";
import { FileText, Users, RefreshCcw, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterState } from "@/components/contract/Filter";
import TrustPayGrid from "@/components/contract/TrustPayGrid";
import { TrustPayGridRef } from "@/components/contract/TrustPayGrid";
import { toast } from "sonner";

// Define prop types based on page.tsx
interface ContractTabsProps {
  tokens: { value: string; label: string }[];
  onFilterChange: (filters: FilterState) => void;
    trustPayGridRef: React.RefObject<TrustPayGridRef | null>;
  filters: FilterState;
}

const ContractTabs: React.FC<ContractTabsProps> = ({
  tokens,
  onFilterChange,
  trustPayGridRef,
  filters
}) => {
  // State to track active tab
  const [activeTab, setActiveTab] = useState("all");
  const [isTabChanging, setIsTabChanging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Handler for tab change
  const handleTabChange = (tab: string) => {
    if (tab === activeTab) return;
    
    setIsTabChanging(true);
    setTimeout(() => {
      setActiveTab(tab);
      setIsTabChanging(false);
    }, 150);
  };

  // Refresh handler with animations
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    // Add a subtle delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Use the appropriate ref's refresh method based on active tab
      if (trustPayGridRef.current) {
        trustPayGridRef.current.refresh();
      }
      
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

  return (
    <div className="w-full mx-auto">
      {/* Enhanced Tab Navigation with Filter */}
      <div className="relative mb-8">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/20 to-transparent h-px top-12" />
        
        <div className="flex relative justify-between items-center">
          {/* Left side - Tab buttons */}
          <div className="flex">
            {/* All Contracts Tab */}
            <Button
              variant="ghost"
              className={cn(
                "group relative px-8 py-4 rounded-none border-b-2 transition-all duration-300 font-semibold text-base",
                activeTab === "all" 
                  ? "border-blue-500 text-blue-400 bg-blue-500/5" 
                  : "border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
              )}
              onClick={() => handleTabChange("all")}
            >
              <div className="flex items-center space-x-2">
                <FileText className={cn(
                  "w-5 h-5 transition-all duration-300",
                  activeTab === "all" ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400"
                )} />
                <span>All Contracts</span>
              </div>
              
              {/* Active tab glow effect */}
              {activeTab === "all" && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-blue-500/20 to-blue-500/10 rounded-lg blur-sm" />
              )}
            </Button>

            {/* My Contracts Tab */}
            <Button
              variant="ghost"
              className={cn(
                "group relative px-8 py-4 rounded-none border-b-2 transition-all duration-300 font-semibold text-base",
                activeTab === "mine" 
                  ? "border-green-500 text-green-400 bg-green-500/5" 
                  : "border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
              )}
              onClick={() => handleTabChange("mine")}
            >
              <div className="flex items-center space-x-2">
                <Users className={cn(
                  "w-5 h-5 transition-all duration-300",
                  activeTab === "mine" ? "text-green-400" : "text-gray-500 group-hover:text-gray-400"
                )} />
                <span>My Contracts</span>
              </div>
              
              {/* Active tab glow effect */}
              {activeTab === "mine" && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-500/20 to-green-500/10 rounded-lg blur-sm" />
              )}
            </Button>

            {/* Accepted Contracts Tab */}
            <Button
              variant="ghost"
              className={cn(
                "group relative px-8 py-4 rounded-none border-b-2 transition-all duration-300 font-semibold text-base",
                activeTab === "accepted" 
                  ? "border-purple-500 text-purple-400 bg-purple-500/5" 
                  : "border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
              )}
              onClick={() => handleTabChange("accepted")}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className={cn(
                  "w-5 h-5 transition-all duration-300",
                  activeTab === "accepted" ? "text-purple-400" : "text-gray-500 group-hover:text-gray-400"
                )} />
                <span>Accepted Contracts</span>
              </div>
              
              {/* Active tab glow effect */}
              {activeTab === "accepted" && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-purple-500/20 to-purple-500/10 rounded-lg blur-sm" />
              )}
            </Button>
          </div>

          {/* Right side - Token filter could go here if needed */}
        </div>
      </div>

      {/* Tab Header Section */}
      <div className="transition-all duration-300 mb-6">
        <div className="flex justify-between items-center">
          {/* Left side - Tab header content */}
          <div>
            {activeTab === "all" ? (
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg blur-sm opacity-30" />
                  <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 p-2 rounded-lg">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">All Contracts</h3>
                  <p className="text-sm text-gray-400 font-medium">Browse all available milestone-based contracts</p>
                </div>
              </div>
            ) : activeTab === "mine" ? (
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-green-600 rounded-lg blur-sm opacity-30" />
                  <div className="relative bg-gradient-to-r from-green-500 to-green-600 p-2 rounded-lg">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">My Contracts</h3>
                  <p className="text-sm text-gray-400 font-medium">Manage contracts where you are involved</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg blur-sm opacity-30" />
                  <div className="relative bg-gradient-to-r from-purple-500 to-purple-600 p-2 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Accepted Contracts</h3>
                  <p className="text-sm text-gray-400 font-medium">View contracts you have accepted and are working on</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side - Refresh button */}
          <div className="transition-all duration-300">
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
                "mr-2 h-4 w-4 transition-all duration-300",
                isRefreshing ? 'animate-spin text-blue-500' : 'hover:rotate-180'
              )} />
              <span className="transition-all duration-300">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content area with smooth transitions and refresh animation */}
      <div className={cn(
        "transition-all duration-500 transform",
        isRefreshing ? "opacity-70 scale-[0.98]" : "opacity-100 scale-100"
      )}>
        <div className="space-y-6">
          <div className="relative">
            <TrustPayGrid 
              ref={trustPayGridRef}
              filterByCurrentUser={activeTab === "mine"}
              tokenFilter={filters.token}
              activeTab={activeTab}
              title=""
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractTabs;