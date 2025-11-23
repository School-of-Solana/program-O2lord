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
import useTrustPay from '@/hooks/useTrustPay';
import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DeclineContractButtonProps {
  trustPay: PublicKey;
  isPayer: boolean;
  onDeclined?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export function DeclineContractButton({
  trustPay,
  isPayer,
  onDeclined,
  className = '',
  disabled = false,
  variant = "destructive"
}: DeclineContractButtonProps) {
  const [open, setOpen] = useState(false);
  const { declineContract } = useTrustPay();
  
  // Only payer can decline
  if (!isPayer) {
    return null;
  }
  
  const handleDecline = async () => {
    try {
      toast.info("Declining contract...", {
        description: "Please confirm the transaction in your wallet"
      });

      await declineContract.mutateAsync({
        trustPay
      });
      
      toast.success("Contract declined successfully!", {
        description: "The contract has been cancelled and any deposited tokens have been refunded"
      });

      setOpen(false);
      if (onDeclined) {
        onDeclined();
      }
    } catch (error) {
      console.error("Failed to decline contract:", error);
      
      let errorMessage = "Failed to decline contract";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes("User rejected")) {
          errorMessage = "Transaction was cancelled";
        }
      }
      
      toast.error(errorMessage);
    }
  };
  
  return (
    <>
      <Button 
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        disabled={disabled || declineContract.isPending}
      >
        {declineContract.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Declining...
          </>
        ) : (
          <>
            <XCircle className="mr-2 h-4 w-4" />
            Decline
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Decline Contract</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to decline this contract? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
              <h4 className="font-medium text-red-300 mb-2">⚠️ Warning</h4>
              <ul className="text-sm text-red-200 space-y-2 list-disc list-inside">
                <li>The contract will be permanently cancelled</li>
                <li>If any tokens were deposited, they will be refunded to the recipient</li>
                <li>The contract account will be closed</li>
                <li>This action cannot be reversed</li>
              </ul>
            </div>

            <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-800">
              <p className="text-sm text-blue-200">
                ℹ️ <strong>Note:</strong> Only contracts in &apos;Pending&apos; status can be declined.
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
              variant="destructive"
              onClick={handleDecline}
              disabled={declineContract.isPending}
              className='bg-red-600 hover:bg-red-700'
            >
              {declineContract.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Declining...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirm Decline
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}