import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/components/ui/use-toast";
import useTrustPay, { MilestoneStatus, ContractStatus } from "@/hooks/useTrustPay";
import { Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MarkMilestoneCompleteButtonProps {
  trustPay: PublicKey;
  milestoneIndex: number;
  milestoneStatus: MilestoneStatus;
  contractStatus: ContractStatus;
  milestoneDescription?: string;
  milestoneAmount?: number;
  disabled?: boolean;
  onSuccess?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export default function MarkMilestoneCompleteButton({
  trustPay,
  milestoneIndex,
  milestoneStatus,
  contractStatus,
  milestoneDescription,
  milestoneAmount,
  disabled = false,
  onSuccess,
  variant = "default",
}: MarkMilestoneCompleteButtonProps) {
  const { markMilestoneComplete } = useTrustPay();
  const { toast } = useToast();
  const [isMarking, setIsMarking] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check milestone status
  const isPending = milestoneStatus === MilestoneStatus.PENDING;
  const isCompleted = milestoneStatus === MilestoneStatus.COMPLETED_BY_SP;
  const isApproved = milestoneStatus === MilestoneStatus.APPROVED_BY_PAYER;
  const isDisputed = milestoneStatus === MilestoneStatus.DISPUTED;

  // Check contract status
  const isContractInProgress = contractStatus === ContractStatus.IN_PROGRESS;

  // Button should be disabled if:
  // - explicitly disabled via props
  // - transaction is in progress
  // - milestone is NOT pending
  // - contract is NOT in progress
  // - milestone is already completed, approved, or disputed
  const isProcessingTransaction = isMarking || markMilestoneComplete.isPending;
  const cannotMark = !isPending || !isContractInProgress || isCompleted || isApproved || isDisputed;
  const buttonDisabled = disabled || isProcessingTransaction || cannotMark;

  const handleOpenDialog = () => {
    if (!isContractInProgress) {
      toast({
        title: "Cannot mark milestone complete",
        description: "Contract must be in progress.",
        variant: "destructive",
      });
      return;
    }

    if (!isPending) {
      toast({
        title: "Cannot mark milestone complete",
        description: "This milestone is not in pending status.",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleMarkComplete = async () => {
    // Double check status before proceeding
    if (!isPending) {
      toast({
        title: "Cannot mark milestone complete",
        description: "Milestone must be in pending status.",
        variant: "destructive",
      });
      return;
    }

    if (!isContractInProgress) {
      toast({
        title: "Cannot mark milestone complete",
        description: "Contract must be in progress.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsMarking(true);

      toast({
        title: "Marking milestone as complete...",
        description: "Please confirm the transaction in your wallet",
      });

      const signature = await markMilestoneComplete.mutateAsync({
        trustPay,
        milestoneIndex,
      });

      toast({
        title: "Milestone marked complete",
        description: `The milestone has been marked as complete. Transaction: ${signature.slice(
          0,
          8
        )}...`,
        variant: "default",
      });

      // Small delay to ensure blockchain state is updated
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setShowConfirmDialog(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to mark milestone complete:", error);

      // Better error handling
      let errorMessage = "An unexpected error occurred";

      if (error instanceof Error) {
        errorMessage = error.message;

        // Handle specific error cases
        if (errorMessage.includes("insufficient funds")) {
          errorMessage = "Insufficient SOL for transaction fees.";
        } else if (errorMessage.includes("User rejected")) {
          errorMessage = "Transaction was cancelled.";
        } else if (errorMessage.includes("not the recipient")) {
          errorMessage = "You are not authorized to mark this milestone complete.";
        } else if (errorMessage.includes("ContractNotInProgress")) {
          errorMessage = "Contract is not in progress.";
        } else if (errorMessage.includes("MilestoneNotPending")) {
          errorMessage = "Milestone is not in pending status.";
        } else if (errorMessage.includes("ContractExpired")) {
          errorMessage = "Contract deadline has expired.";
        } else if (errorMessage.includes("InvalidMilestoneIndex")) {
          errorMessage = "Invalid milestone index.";
        }
      }

      toast({
        title: "Failed to mark milestone complete",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsMarking(false);
    }
  };

  // Determine button text and icon based on milestone status
  let buttonText = "Mark Complete";
  let ButtonIcon = CheckCircle;
  let buttonVariant = variant;

  if (isPending && isContractInProgress) {
    buttonText = "Mark as Complete";
    ButtonIcon = CheckCircle;
    buttonVariant = "default";
  } else if (isCompleted) {
    buttonText = "Awaiting Approval";
    ButtonIcon = Clock;
    buttonVariant = "outline";
  } else if (isApproved) {
    buttonText = "Milestone Approved ✓";
    ButtonIcon = CheckCircle;
    buttonVariant = "outline";
  } else if (isDisputed) {
    buttonText = "Milestone Disputed";
    ButtonIcon = AlertCircle;
    buttonVariant = "destructive";
  } else if (!isContractInProgress) {
    buttonText = "Contract Not Active";
    ButtonIcon = Clock;
    buttonVariant = "secondary";
  }

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        disabled={buttonDisabled}
        variant={buttonVariant}
        className="w-full"
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Mark Milestone as Complete
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Confirm that you have completed this milestone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {milestoneDescription && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Milestone Description
                </label>
                <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
                  <p className="text-gray-300">{milestoneDescription}</p>
                </div>
              </div>
            )}

            {milestoneAmount !== undefined && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Milestone Amount
                </label>
                <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
                  <p className="text-gray-300 font-semibold">{milestoneAmount} tokens</p>
                </div>
              </div>
            )}

            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-300">
                <strong>Important:</strong> By marking this milestone as complete, you&apos;re
                indicating that you&apos;ve fulfilled all requirements for this milestone. The payer
                will review and approve payment.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isProcessingTransaction}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkComplete}
              disabled={isProcessingTransaction}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessingTransaction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm Complete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}