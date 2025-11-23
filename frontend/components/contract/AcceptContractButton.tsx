import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import useTrustPay from '@/hooks/useTrustPay';
import { Loader2, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface AcceptContractButtonProps {
  trustPay: PublicKey;
  isPayer: boolean;
  totalAmount: string;
  fee: string;
  tokenSymbol?: string;
  onAccepted?: () => void;
  className?: string;
  disabled?: boolean;
}

export function AcceptContractButton({
  trustPay,
  isPayer,
  totalAmount,
  fee,
  tokenSymbol = 'tokens',
  onAccepted,
  className = '',
  disabled = false,
}: AcceptContractButtonProps) {
  const [open, setOpen] = useState(false);
  const { acceptContract } = useTrustPay();
  
  // Only payer can accept
  if (!isPayer) {
    return null;
  }
  
  const handleAccept = async () => {
    try {
      toast.info("Accepting contract...", {
        description: "Please confirm the transaction in your wallet"
      });

      // Default deadline duration: 30 days in seconds
      const defaultDeadlineDuration = new BN(30 * 24 * 60 * 60);

      await acceptContract.mutateAsync({
        trustPay,
        deadlineDurationSeconds: defaultDeadlineDuration
      });
      
      toast.success("Contract accepted successfully!", {
        description: "Funds have been deposited into escrow and the contract is now active"
      });

      setOpen(false);
      if (onAccepted) {
        onAccepted();
      }
    } catch (error) {
      console.error("Failed to accept contract:", error);
      
      let errorMessage = "Failed to accept contract";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes("User rejected")) {
          errorMessage = "Transaction was cancelled";
        } else if (errorMessage.includes("Insufficient")) {
          errorMessage = "Insufficient funds to accept this contract";
        }
      }
      
      toast.error(errorMessage);
    }
  };
  
  return (
    <>
      <Button 
        variant="default"
        className={`bg-green-600 hover:bg-green-700 ${className}`}
        onClick={() => setOpen(true)}
        disabled={disabled || acceptContract.isPending}
      >
        {acceptContract.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Accepting...
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Accept
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Accept Contract</DialogTitle>
            <DialogDescription className="text-gray-400">
              Review the contract details before accepting.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 bg-green-900/20 rounded-lg border border-green-800">
              <h4 className="font-medium text-green-300 mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Contract Details
              </h4>
              <div className="space-y-2 text-sm text-green-200">
                <div className="flex justify-between">
                  <span>Contract Amount:</span>
                  <span className="font-semibold">{totalAmount} {tokenSymbol}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee (0.5%):</span>
                  <span className="font-semibold">{fee} {tokenSymbol}</span>
                </div>
                <div className="border-t border-green-700 my-2 pt-2 flex justify-between">
                  <span className="font-semibold">Total to Deposit:</span>
                  <span className="font-bold text-lg">{(parseFloat(totalAmount) + parseFloat(fee)).toFixed(6)} {tokenSymbol}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-800">
              <h4 className="font-medium text-blue-300 mb-2 flex items-center">
                <Info className="w-5 h-5 mr-2" />
                What happens next?
              </h4>
              <ul className="text-sm text-blue-200 space-y-2 list-disc list-inside">
                <li>Funds will be deposited into a secure escrow</li>
                <li>The service provider can begin work on milestones</li>
                <li>You&apos;ll approve each completed milestone to release payment</li>
                <li>Funds remain in escrow until you approve or dispute</li>
              </ul>
            </div>

            <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-800">
              <p className="text-sm text-amber-200">
                ⚠️ <strong>Important:</strong> Make sure you have sufficient balance to cover the total deposit amount plus transaction fees.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button 
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
              disabled={acceptContract.isPending}
            >
              {acceptContract.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirm & Accept
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}