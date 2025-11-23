import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "../ui/button";
import { XCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import useTrustPay from "@/hooks/useTrustPay";
import { useQueryClient } from "@tanstack/react-query";
import ConfirmationDialog from "../ui/ConfirmationDialog";

interface CancelContractButtonProps {
  trustPay: PublicKey;
  isCreator: boolean;
  contractTitle: string;
  totalAmount: number;
  tokenSymbol?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export const CancelContractButton: React.FC<CancelContractButtonProps> = ({
  trustPay,
  isCreator,
  contractTitle,
  totalAmount,
  tokenSymbol = "tokens",
  variant = "destructive",
  className = "",
  size = "default",
}) => {
  const { cancelContract } = useTrustPay();
  const queryClient = useQueryClient();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleCancel = async () => {
    if (!isCreator) {
      toast.error("Only the contract creator can cancel");
      return;
    }

    try {
      await cancelContract.mutateAsync({
        trustPay,
      });

      toast.success("Contract cancelled successfully!");
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({
        queryKey: ["get-trust-pay-accounts"],
      });
      queryClient.invalidateQueries({
        queryKey: [`trust-pay-info-${trustPay.toString()}`],
      });
    } catch (error) {
      console.error("Failed to cancel contract:", error);
      toast.error("Failed to cancel contract");
    } finally {
      setShowConfirmation(false);
    }
  };

  const getConfirmationMessage = () => {
    return `Are you sure you want to cancel this contract?

Title: "${contractTitle}"
Amount: ${totalAmount.toLocaleString()} ${tokenSymbol}

This action cannot be undone. Any deposited funds will be refunded to you.

Do you want to proceed?`;
  };

  if (!isCreator) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowConfirmation(true)}
        disabled={cancelContract.isPending}
      >
        {cancelContract.isPending ? (
          <>
            <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
            Cancelling...
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 mr-2" />
            Cancel Contract
          </>
        )}
      </Button>

      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleCancel}
        title="Cancel Contract"
        description={getConfirmationMessage()}
        confirmText="Yes, Cancel Contract"
        cancelText="No, Keep Contract"
        isProcessing={cancelContract.isPending}
        variant="destructive"
      />
    </>
  );
};