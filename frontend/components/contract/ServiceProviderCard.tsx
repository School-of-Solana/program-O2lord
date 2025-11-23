import React, { useState, useMemo } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Separator } from "../ui/separator";
import ExplorerLink from "../ExplorerLink";
import { ellipsify } from "@/lib/utils";
import {
  Clock,
  Coins,
  Send,
  CircleUser,
  AlertCircle,
  CheckCircle,
  Copy,
  AlertTriangle,
  ShieldAlert,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import useTrustPay, { MilestoneStatus, ContractType, ContractStatus } from "@/hooks/useTrustPay";
import { useQueryClient } from "@tanstack/react-query";
import ConfirmationDialog from "../ui/ConfirmationDialog";
import TokenDisplay from "../TokenDisplay";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { DisputeContractButton } from "./DisputeContractButton";
import { CancelContractButton } from "./CancelContractButton";

type Milestone = {
  description: string;
  amount: BN;
  status: number;
  completedAt: BN | null;
  approvedAt: BN | null;
  disputeReason?: string | null;
  disputeId?: string | null;
};

type Props = {
  trustPay: PublicKey;
  milestoneIndex: number;
  mint: PublicKey;
  milestone: Milestone;
  trustPayAccount: {
    payer: PublicKey;
    recipient: PublicKey;
    paymentInstructions: string;
    termsAndConditions?: string;
    contractType: number;
    contractStatus: number;
    acceptanceTimestamp?: BN | null;
    title?: string;
  };
  mintInfo: {
    decimals: number;
  };
  currency: string;
  pricePerToken: string | number;
};

const ServiceProviderCard: React.FC<Props> = ({
  trustPay,
  milestoneIndex,
  mint,
  milestone,
  trustPayAccount,
  mintInfo,
  currency,
  pricePerToken,
}) => {
  const queryClient = useQueryClient();
  const { markMilestoneComplete } = useTrustPay();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const tokenMetadata = useTokenMetadata(mint);

  // Check if this is a valid contract type (milestone-based)
  const isValidContract = useMemo(() => {
    if (!trustPayAccount) {
      return false;
    }
    
    return trustPayAccount.contractType === ContractType.MILESTONE;
  }, [trustPayAccount]);
  
  // Check if user is the creator (for pending contracts only)
  const isCreator = useMemo(() => {
    if (trustPayAccount.contractStatus === ContractStatus.PENDING) {
      // For pending contracts, if no acceptance timestamp, recipient is the creator
      return !trustPayAccount.acceptanceTimestamp;
    }
    return false;
  }, [trustPayAccount.contractStatus, trustPayAccount.acceptanceTimestamp]);
  
  // If not a valid contract, don't render the card
  if (!isValidContract) {
    return null;
  }

  // Format timestamp to human-readable date
  const milestoneDate = milestone.completedAt 
    ? new Date(milestone.completedAt.toNumber() * 1000).toLocaleString()
    : "Not completed yet";
  
  // Convert token amount using decimals
  const tokenAmount = milestone.amount.toNumber() / 10 ** mintInfo.decimals;
  
  // Calculate fiat amount based on price per token
  const fiatAmount = typeof pricePerToken === 'number' 
    ? (tokenAmount * pricePerToken).toFixed(2)
    : (tokenAmount * parseFloat(pricePerToken)).toFixed(2);

  // Function to copy dispute ID to clipboard
  const copyDisputeId = () => {
    if (milestone.disputeId) {
      navigator.clipboard.writeText(milestone.disputeId);
      toast.success("Dispute ID copied to clipboard");
    }
  };

  const handleConfirmPaymentSent = async () => {
    toast.promise(
      markMilestoneComplete.mutateAsync({ trustPay, milestoneIndex }),
      {
        loading: "Marking milestone as complete...",
        success: "Milestone marked as complete. Awaiting payer approval.",
        error: "Failed to mark milestone as complete",
        finally() {
          setShowConfirmation(false);
          queryClient.invalidateQueries({
            queryKey: ["get-trust-pay-accounts"],
          });
          queryClient.invalidateQueries({
            queryKey: [`trust-pay-info-${trustPay.toString()}`],
          });
        },
      }
    );
  };

  const getConfirmationMessage = () => {
    return `You are about to mark this milestone as complete:

"${milestone.description}"

Amount: ${tokenAmount.toLocaleString()} ${tokenMetadata.metadata?.symbol}
Value: ${fiatAmount} ${currency}

Please ensure that you have completed the work as described before confirming.

Do you confirm that this milestone is complete?`;
  };

  // Get appropriate status badge based on milestone status
  const getStatusBadge = () => {
    if (milestone.status === MilestoneStatus.PENDING) {
      return (
        <Badge variant="outline" className="ml-2 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300">
          Work In Progress
        </Badge>
      );
    } else if (milestone.status === MilestoneStatus.COMPLETED_BY_SP) {
      return (
        <Badge variant="outline" className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
          Awaiting Payer Approval
        </Badge>
      );
    } else if (milestone.status === MilestoneStatus.DISPUTED) {
      return (
        <Badge variant="outline" className="ml-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300">
          Milestone Disputed
        </Badge>
      );
    }
    return null;
  };

  // Get appropriate card border color based on status
  const getCardBorderClass = () => {
    if (milestone.status === MilestoneStatus.PENDING) return "border-amber-500 dark:border-amber-600";
    if (milestone.status === MilestoneStatus.COMPLETED_BY_SP) return "border-blue-500 dark:border-blue-600";
    if (milestone.status === MilestoneStatus.DISPUTED) return "border-red-500 dark:border-red-600";
    return "";
  };

  // Get appropriate status icon based on status
  const getStatusIcon = () => {
    if (milestone.status === MilestoneStatus.PENDING) return <AlertCircle className="text-amber-500" />;
    if (milestone.status === MilestoneStatus.COMPLETED_BY_SP) return <CheckCircle className="text-blue-500" />;
    if (milestone.status === MilestoneStatus.DISPUTED) return <ShieldAlert className="text-red-500" />;
    return null;
  };

  // Render dispute notification when status is disputed
  const renderDisputeNotification = () => {
    if (milestone.status === MilestoneStatus.DISPUTED) {
      return (
        <div className="p-4 bg-red-50 dark:bg-red-950 rounded-md mt-4 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-500 h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-red-800 dark:text-red-300">Disputed Milestone</h4>
              <p className="text-sm text-red-700 dark:text-red-400">
                This milestone is currently under dispute. 
                <span className="font-bold text-green-400"> {tokenAmount.toLocaleString()} {tokenMetadata.metadata?.symbol} </span> 
                are locked until the dispute is resolved. Please open a ticket in{' '}
                <a  
                  href="https://discord.gg/BFwry8rg" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                >
                  discord
                </a>{' '}
                and provide the dispute ID to resolve this issue.
              </p>
              {milestone.disputeReason && (
                <div className="mt-2 text-sm">
                  <span className="font-semibold">Reason: </span>
                  <span className="text-red-600 dark:text-red-400">{milestone.disputeReason}</span>
                </div>
              )}
              {milestone.disputeId && (
                <div className="flex items-center mt-2 bg-red-100 dark:bg-red-900 p-2 rounded-md">
                  <div className="flex-1 flex items-center">
                    <span className="text-red-800 dark:text-red-300 font-medium mr-2">Dispute ID:</span>
                    <span className="font-mono bg-red-200 dark:bg-red-800 py-1 px-2 rounded text-sm">
                      {milestone.disputeId}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 ml-2"
                    onClick={copyDisputeId}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={getCardBorderClass()}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Milestone #{milestoneIndex + 1}
            {getStatusBadge()}
          </div>
        </CardTitle>
        <CardDescription>
          {milestone.completedAt ? `Completed on ${milestoneDate}` : 'Not completed yet'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CircleUser className="w-4 h-4" />
            Payer:
          </div>
          <ExplorerLink type="address" value={trustPayAccount.payer.toString()}>
            <Avatar>
              <AvatarFallback>
                {ellipsify(trustPayAccount.payer.toString(), 1)}
              </AvatarFallback>
            </Avatar>
          </ExplorerLink>
        </div>
        
        <Separator />
        
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Milestone Description:</p>
          <p className="text-sm font-medium">{milestone.description}</p>
        </div>
      
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Milestone Amount:
          </div>
          <TokenDisplay
            amount={tokenAmount}
            symbol={tokenMetadata?.metadata?.symbol}
            logoURI={tokenMetadata?.metadata?.logoURI}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Estimated Value:
          </div>
          <span className="font-semibold">{fiatAmount} {currency}</span>
        </div>
        
        <Separator />
        
        {/* Display dispute notification at the top if disputed */}
        {renderDisputeNotification()}
        
        {/* Terms and Conditions */}
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Terms and Conditions:</p>
          <p className="text-sm text-gray-300">{trustPayAccount.paymentInstructions || "No terms specified"}</p>
        </div>
        
        <Separator />
        
        <div className="flex flex-col gap-2">
          {milestone.status === MilestoneStatus.PENDING ? (
            <>
              <Button 
                className="w-full"
                disabled={markMilestoneComplete.isPending}
                onClick={() => setShowConfirmation(true)}
                variant="default"
              >
                <Send className="w-4 h-4 mr-2" />
                {markMilestoneComplete.isPending ? "Processing..." : "Mark as Complete"}
              </Button>
              
              {/* Cancel button for creator (only for pending contracts) */}
              {isCreator && trustPayAccount.contractStatus === ContractStatus.PENDING && (
                <CancelContractButton
                  trustPay={trustPay}
                  isCreator={isCreator}
                  contractTitle={trustPayAccount.title || "Contract"}
                  totalAmount={tokenAmount}
                  tokenSymbol={tokenMetadata?.metadata?.symbol}
                  variant="outline"
                  className="w-full"
                  size="sm"
                />
              )}
            </>
          ) : milestone.status === MilestoneStatus.COMPLETED_BY_SP ? (
            <>
              <Button 
                className="w-full"
                disabled={true}
                variant="secondary"
              >
                <Clock className="w-4 h-4 mr-2" />
                Waiting for Payer Approval
              </Button>
              
              {/* Add Dispute Button for Service Provider */}
              <DisputeContractButton
                trustPay={trustPay}
                milestoneIndex={milestoneIndex}
                milestoneStatus={milestone.status}
                isRecipient={true}
                variant="outline"
                className="bg-red-500 hover:bg-red-600 w-full"
              />
            </>
          ) : milestone.status === MilestoneStatus.DISPUTED ? (
            <Button 
              className="w-full"
              disabled={true}
              variant="outline"
            >
              <ShieldAlert className="w-4 h-4 mr-2 text-red-500" />
              Milestone Disputed
            </Button>
          ) : null}
        </div>
      </CardContent>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmPaymentSent}
        title="Confirm Milestone Completion"
        description={getConfirmationMessage()}
        confirmText="Yes, Mark as Complete"
        cancelText="Cancel"
        isProcessing={markMilestoneComplete.isPending}
      />
    </Card>
  );
};

export default ServiceProviderCard;