"use client";
import { BN, ProgramAccount } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import React, { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { ellipsify } from "@/lib/utils";
import {
  CircleUser,
  Ellipsis,
  RedoDot,
  RefreshCcw,
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Calendar,
  DollarSign,
  ExternalLink,
  ShieldAlert,
  Info,
  Play,
  CheckCheck
} from "lucide-react";
import { Separator } from "../ui/separator";
import ExplorerLink from "../ExplorerLink";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useWallet } from "@solana/wallet-adapter-react";
import useTrustPay, { 
  TrustPayAccountData, 
  Milestone, 
  ContractStatus, 
  MilestoneStatus,
  ContractType 
} from "@/hooks/useTrustPay";
import ApproveMilestoneButton from "./ApprovePayment";
import { DisputeContractButton } from "./DisputeContractButton";
import { DeclineContractButton } from "./DeclineContractButton";
import { CancelContractButton } from "./CancelContractButton";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import TokenDisplay from "@/components/TokenDisplay";
import { toast } from "sonner";

// Props type
interface Props {
  data: ProgramAccount<TrustPayAccountData>;
}

const TrustPayCard: React.FC<Props> = ({ data }) => {
  const { publicKey } = useWallet();
  const { 
    acceptContract, 
    markMilestoneComplete, 
  } = useTrustPay();
  const { metadata: tokenMetadata } = useTokenMetadata(data.account.mint);

  const isPayer = useMemo(() => {
    return !!(publicKey && data.account.payer.equals(publicKey));
  }, [publicKey, data.account.payer]);

  const isRecipient = useMemo(() => {
    return !!(publicKey && data.account.recipient.equals(publicKey));
  }, [publicKey, data.account.recipient]);

  // Determine who is the creator based on contract status
  const isCreator = useMemo(() => {
    if (data.account.contractStatus === ContractStatus.PENDING) {
      // For pending contracts, check if there are tokens in vault
      // If no tokens deposited yet, recipient is the creator
      // If tokens are deposited, payer is the creator
      // We'll check this through acceptance_timestamp
      if (!data.account.acceptanceTimestamp) {
        // No acceptance yet, so recipient created it
        return isRecipient;
      } else {
        // Already accepted, payer created it
        return isPayer;
      }
    }
    return false; // Only pending contracts can be cancelled
  }, [data.account.contractStatus, data.account.acceptanceTimestamp, isPayer, isRecipient]);

  const [currentTime] = React.useState(() => Date.now() / 1000);

  const isExpired = useMemo(() => {
    return data.account.deadline && 
      data.account.deadline.toNumber() > 0 &&
      currentTime > data.account.deadline.toNumber();
  }, [data.account.deadline, currentTime]);

  if (!isPayer && !isRecipient) {
    return null;
  }

  // Calculate contract progress
  const approvedMilestones = data.account.milestones.filter(
    m => m.status === MilestoneStatus.APPROVED_BY_PAYER
  ).length;
  const totalMilestones = data.account.milestones.length;
  const progressPercentage = (approvedMilestones / totalMilestones) * 100;

  // Check for active disputes
  const hasActiveDisputes = data.account.milestones.some(
    m => m.status === MilestoneStatus.DISPUTED
  );

  // Get contract status display
  const getContractStatusDisplay = () => {
    if (hasActiveDisputes) {
      return { text: "Disputed", color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-900" };
    }
    
    switch (data.account.contractStatus) {
      case ContractStatus.PENDING:
        return { text: "Pending Acceptance", color: "text-yellow-500", bgColor: "bg-yellow-100 dark:bg-yellow-900" };
      case ContractStatus.IN_PROGRESS:
        return { text: "In Progress", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900" };
      case ContractStatus.COMPLETED:
        return { text: "Completed", color: "text-green-500", bgColor: "bg-green-100 dark:bg-green-900" };
      case ContractStatus.DISPUTED:
        return { text: "Disputed", color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-900" };
      case ContractStatus.CANCELLED:
        return { text: "Cancelled", color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-900" };
      default:
        return { text: "Unknown", color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-900" };
    }
  };

  const statusDisplay = getContractStatusDisplay();

  // Handle contract acceptance
  const handleAcceptContract = async () => {
    if (!isPayer) return;
    
    try {
      // Default deadline duration: 30 days in seconds
      const defaultDeadlineDuration = new BN(30 * 24 * 60 * 60);
      
      await acceptContract.mutateAsync({ 
        trustPay: data.publicKey,
        deadlineDurationSeconds: defaultDeadlineDuration
      });
      toast.success("Contract accepted successfully!");
    } catch (error) {
      console.error("Failed to accept contract:", error);
      toast.error("Failed to accept contract");
    }
  };

  // Handle milestone completion
  const handleMarkMilestoneComplete = async (milestoneIndex: number) => {
    if (!isRecipient) return;
    
    try {
      await markMilestoneComplete.mutateAsync({
        trustPay: data.publicKey,
        milestoneIndex
      });
      toast.success("Milestone marked as complete!");
    } catch (error) {
      console.error("Failed to mark milestone complete:", error);
      toast.error("Failed to mark milestone complete");
    }
  };

  // Get milestone status display
  const getMilestoneStatusDisplay = (status: number) => {
    switch (status) {
      case MilestoneStatus.PENDING:
        return { text: "Pending", icon: Clock, color: "text-gray-500" };
      case MilestoneStatus.COMPLETED_BY_SP:
        return { text: "Awaiting Approval", icon: CheckCircle, color: "text-blue-500" };
      case MilestoneStatus.APPROVED_BY_PAYER:
        return { text: "Approved", icon: CheckCheck, color: "text-green-500" };
      case MilestoneStatus.DISPUTED:
        return { text: "Disputed", icon: AlertTriangle, color: "text-red-500" };
      default:
        return { text: "Unknown", icon: Clock, color: "text-gray-500" };
    }
  };

  // Format deadline
  const formatDeadline = (deadline: BN | null) => {
    if (!deadline) {
      return "Not set";
    }
    
    const date = new Date(Number(deadline.toString()) * 1000);
    return date.toLocaleDateString();
  };

  // Get card border class based on user role
  const getCardBorderClass = () => {
    if (isPayer) {
      return "border-blue-500 dark:border-blue-600";
    } else if (isRecipient) {
      return "border-green-500 dark:border-green-600";
    }
    return "";
  };

  // Get token decimals
  const tokenDecimals = tokenMetadata?.decimals || 9;
  const totalAmount = Number(data.account.totalContractAmount.toString()) / Math.pow(10, tokenDecimals);

  return (
    <Card className={`group cursor-pointer ${getCardBorderClass()}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCcw className="text-primary/70 group-hover:animate-spin" />
            Contract
            {isPayer && (
              <Badge variant="outline" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
                You are the Payer
              </Badge>
            )}
            {isRecipient && (
              <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">
                You are the Recipient
              </Badge>
            )}
            {hasActiveDisputes && (
              <div className="relative ml-2">
                <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse cursor-pointer" />
              </div>
            )}
          </div>
          
          {(isPayer || isRecipient) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size={"icon"} variant={"ghost"} className="h-6 w-6 p-0">
                  <span className="sr-only">Open menu</span>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900/80 rounded-lg p-4 border border-gray-600">
                <DropdownMenuLabel className="text-slate-100">Actions</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                
                <DropdownMenuItem className="text-slate-100 hover:bg-slate-700">
                  <FileText className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            <span className="text-gray-500">Seed:</span>
            <span className="text-primary/70 ml-2">
              {ellipsify(data.account.seed.toString())}
            </span>
          </span>
          <span className="flex items-center">
            <span className="text-gray-500">Address:</span>
            <ExplorerLink type="address" value={data.publicKey.toString()}>
              <span className="text-primary/70 text-sm ml-2 flex items-center">
                {ellipsify(data.publicKey.toString(), 4)}
                <ExternalLink className="h-3 w-3 ml-1" />
              </span>
            </ExplorerLink>
          </span>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Separator />
        
        {/* Contract Title */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Title:
          </div>
          <span className="font-medium text-right max-w-[200px] truncate">
            {data.account.title}
          </span>
        </div>

        {/* Terms and Conditions */}
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Terms & Conditions:</span>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {data.account.termsAndConditions || "No terms specified"}
            </p>
          </div>
        </div>

        {/* Contract Status */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Status:
          </div>
          <Badge className={`${statusDisplay.bgColor} ${statusDisplay.color} border-0`}>
            {statusDisplay.text}
          </Badge>
        </div>
        
        {/* Payer */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CircleUser className="w-4 h-4" />
            Payer:
          </div>
          <ExplorerLink type="address" value={data.account.payer.toString()}>
            <Avatar>
              <AvatarFallback>
                {ellipsify(data.account.payer.toString(), 1)}
              </AvatarFallback>
            </Avatar>
          </ExplorerLink>
        </div>

        {/* Recipient */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CircleUser className="w-4 h-4" />
            Recipient:
          </div>
          <ExplorerLink type="address" value={data.account.recipient.toString()}>
            <Avatar>
              <AvatarFallback>
                {ellipsify(data.account.recipient.toString(), 1)}
              </AvatarFallback>
            </Avatar>
          </ExplorerLink>
        </div>
        
        <Separator />
        
        {/* Token */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RedoDot className="w-4 h-4" />
            Token:
          </div>
          <ExplorerLink type="address" value={data.account.mint.toString()}>
            <span className="text-primary/70 text-sm flex items-center">
              {ellipsify(data.account.mint.toString(), 4)}
              <ExternalLink className="h-3 w-3 ml-1" />
            </span>
          </ExplorerLink>
        </div>

        {/* Total Amount */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Total Amount:
          </div>
          <TokenDisplay
            amount={totalAmount}
            symbol={tokenMetadata?.symbol}
            logoURI={tokenMetadata?.logoURI}
          />
        </div>

        {/* Deadline */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Deadline:
          </div>
          <span className={`font-medium ${isExpired ? 'text-red-500' : 'text-gray-300'}`}>
            {formatDeadline(data.account.deadline)}
            {isExpired && " (Expired)"}
          </span>
        </div>

        {/* Progress */}
        {data.account.contractType === ContractType.MILESTONE && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Progress:</span>
              <span className="text-gray-300">{approvedMilestones}/{totalMilestones} milestones</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        <Separator />

        {/* Milestones */}
        {data.account.contractType === ContractType.MILESTONE && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-300">Milestones:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {data.account.milestones.map((milestone: Milestone, index: number) => {
                const statusDisplay = getMilestoneStatusDisplay(milestone.status);
                const StatusIcon = statusDisplay.icon;
                
                return (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-300 truncate">
                        {milestone.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className={`w-3 h-3 ${statusDisplay.color}`} />
                        <span className={`text-xs ${statusDisplay.color}`}>
                          {statusDisplay.text}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <TokenDisplay
                        amount={Number(milestone.amount.toString()) / Math.pow(10, tokenDecimals)}
                        symbol={tokenMetadata?.symbol}
                        logoURI={tokenMetadata?.logoURI}
                        className="text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="space-y-2">
          {/* Accept, Decline, or Cancel Contract (when pending) */}
          {data.account.contractStatus === ContractStatus.PENDING && (
            <div className="flex flex-col gap-2">
               {isPayer && (
                  <div className="flex gap-2 w-full">
                    <Button
                      onClick={handleAcceptContract}
                      disabled={acceptContract.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm px-2 sm:px-4"
                    >
                      {acceptContract.isPending ? (
                        <>
                          <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                          <span className="hidden sm:inline">Accepting...</span>
                          <span className="sm:hidden">Accept...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Accept</span>
                          <span className="sm:hidden">Accept</span>
                        </>
                      )}
                    </Button>
                    
                    <DeclineContractButton
                      trustPay={data.publicKey}
                      isPayer={isPayer}
                      variant="destructive"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-xs sm:text-sm px-2 sm:px-4"
                    />
                  </div>
                )}
              
              {/* Cancel button for creator */}
              {isCreator && (
                <CancelContractButton
                  trustPay={data.publicKey}
                  isCreator={isCreator}
                  contractTitle={data.account.title}
                  totalAmount={totalAmount}
                  tokenSymbol={tokenMetadata?.symbol}
                  variant="outline"
                  className="w-full bg-red-600 hove:bg-red-700"
                />
              )}
            </div>
          )}

          {/* Milestone Actions (when contract is in progress) */}
          {data.account.contractStatus === ContractStatus.IN_PROGRESS && (
            <div className="space-y-2">
              {data.account.milestones.map((milestone: Milestone, index: number) => (
                <div key={index} className="flex gap-2">
                  {/* Mark Complete (Recipient only, when pending) */}
                  {isRecipient && milestone.status === MilestoneStatus.PENDING && (
                    <Button
                      onClick={() => handleMarkMilestoneComplete(index)}
                      disabled={markMilestoneComplete.isPending}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-green-600 hover:green-700 text-black"
                    >
                      {markMilestoneComplete.isPending ? (
                        <>
                          <RefreshCcw className="w-3 h-3 mr-1 animate-spin" />
                          Marking...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Complete #{index + 1}
                        </>
                      )}
                    </Button>
                  )}

                  {/* Actions when milestone is completed by SP */}
                  {milestone.status === MilestoneStatus.COMPLETED_BY_SP && (
                    <>
                      {/* Payer can approve or dispute */}
                      {isPayer && (
                        <>
                          <ApproveMilestoneButton
                            disabled={isExpired}
                            trustPay={data.publicKey}
                            milestoneIndex={index}
                            milestoneStatus={milestone.status}
                            milestoneDescription={milestone.description}
                            milestoneAmount={Number(milestone.amount.toString()) / Math.pow(10, tokenDecimals)}
                            variant="default"
                            className="flex-1"
                          />
                          
                          <DisputeContractButton
                            trustPay={data.publicKey}
                            milestoneIndex={index}
                            milestoneStatus={milestone.status}
                            isPayer={isPayer}
                            variant="destructive"
                            className="flex-1"
                          />
                        </>
                      )}

                      {/* Recipient can also dispute */}
                      {isRecipient && (
                        <div className="flex gap-2 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Awaiting Approval
                          </Button>
                          
                          <DisputeContractButton
                            trustPay={data.publicKey}
                            milestoneIndex={index}
                            milestoneStatus={milestone.status}
                            isRecipient={isRecipient}
                            variant="destructive"
                            className="flex-1"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrustPayCard;