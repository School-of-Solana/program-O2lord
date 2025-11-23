import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/components/ui/use-toast";
import useTrustPay, { MilestoneStatus } from "@/hooks/useTrustPay";
import { Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface ApproveMilestoneButtonProps {
  trustPay: PublicKey;
  milestoneIndex: number;
  milestoneStatus: MilestoneStatus;
  milestoneDescription?: string;
  milestoneAmount?: number;
  disabled?: boolean;
  onSuccess?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string; // ADDED THIS LINE
}

export default function ApproveMilestoneButton({
  trustPay,
  milestoneIndex,
  milestoneStatus,
  milestoneDescription,
  milestoneAmount,
  disabled = false,
  onSuccess,
  variant = "default",
  className = "", // ADDED THIS LINE
}: ApproveMilestoneButtonProps) {
    
  const { approveMilestonePayment, isProcessing } = useTrustPay();
  const { toast } = useToast();
  const [isApproving, setIsApproving] = useState(false);

  // Check milestone status
  const isPending = milestoneStatus === MilestoneStatus.PENDING;
  const isCompleted = milestoneStatus === MilestoneStatus.COMPLETED_BY_SP;
  const isApproved = milestoneStatus === MilestoneStatus.APPROVED_BY_PAYER;
  const isDisputed = milestoneStatus === MilestoneStatus.DISPUTED;
  
  // Button should be disabled if:
  // - explicitly disabled via props
  // - transaction is in progress (local or global)
  // - milestone is NOT completed by service provider
  // - milestone is already approved or disputed
  const isProcessingTransaction = isApproving || approveMilestonePayment.isPending || isProcessing;
  const cannotApprove = !isCompleted || isApproved || isDisputed || isPending;
  const buttonDisabled = disabled || isProcessingTransaction || cannotApprove;

  const handleApproveMilestone = async () => {
    // Double check status before proceeding
    if (!isCompleted) {
      toast({
        title: "Cannot approve milestone",
        description: "Milestone must be marked as completed by the service provider first.",
        variant: "destructive",
      });
      return;
    }

    if (isApproved) {
      toast({
        title: "Already approved",
        description: "This milestone has already been approved.",
        variant: "default",
      });
      return;
    }

    try {
      setIsApproving(true);

      const signature = await approveMilestonePayment.mutateAsync({
        trustPay,
        milestoneIndex,
      });
      
      toast({
        title: "Milestone approved",
        description: `Payment released successfully. Transaction: ${signature.slice(0, 8)}...`,
        variant: "default",
      });
      
      // Small delay to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to approve milestone:", error);
      
      // Better error handling
      let errorMessage = "An unexpected error occurred";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error cases
        if (errorMessage.includes("insufficient funds")) {
          errorMessage = "Insufficient funds in your wallet for transaction fees.";
        } else if (errorMessage.includes("User rejected")) {
          errorMessage = "Transaction was cancelled.";
        } else if (errorMessage.includes("not the payer")) {
          errorMessage = "You are not authorized to approve this milestone.";
        } else if (errorMessage.includes("MilestoneNotCompleted")) {
          errorMessage = "Milestone has not been marked as completed yet.";
        }
      }
      
      toast({
        title: "Failed to approve milestone",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Determine button text and icon based on milestone status
  let buttonText = "Approve Milestone";
  let ButtonIcon = CheckCircle;
  let buttonVariant = variant;
  
  if (isPending) {
    buttonText = "Waiting for Completion";
    ButtonIcon = Clock;
  } else if (isCompleted && !isProcessingTransaction) {
    buttonText = "Approve & Release Payment";
    ButtonIcon = CheckCircle;
    buttonVariant = "default";
  } else if (isApproved) {
    buttonText = "Milestone Approved ✓";
    ButtonIcon = CheckCircle;
    buttonVariant = "outline";
  } else if (isDisputed) {
    buttonText = "Milestone Disputed";
    ButtonIcon = AlertCircle;
    buttonVariant = "destructive";
  }

  return (
    <Button
      onClick={handleApproveMilestone}
      disabled={buttonDisabled}
      variant={buttonVariant}
      className={`${isCompleted && !isProcessingTransaction && !isApproved && !isDisputed ? 'bg-green-600 hover:bg-green-700' : ''} ${className}`}
    >
      {isProcessingTransaction ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <ButtonIcon className="mr-2 h-4 w-4" />
          {buttonText}
        </>
      )}
    </Button>
  );
}