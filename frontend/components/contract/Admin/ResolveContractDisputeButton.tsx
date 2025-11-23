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
import { 
  RadioGroup,
  RadioGroupItem
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PublicKey } from '@solana/web3.js';
import useTrustPay from '@/hooks/useTrustPay';
import { Loader2, Scale } from 'lucide-react';
import { toast } from 'sonner';

interface ResolveContractDisputeButtonProps {
  trustPay: PublicKey;
  milestoneIndex: number;
  isResolver: boolean;
  milestoneDescription?: string;
  onResolved?: () => void;
  className?: string;
  disabled?: boolean;
}

export function ResolveContractDisputeButton({
  trustPay,
  milestoneIndex,
  isResolver,
  milestoneDescription,
  onResolved,
  className = '',
  disabled = false
}: ResolveContractDisputeButtonProps) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<number>(1); // Default to favor recipient
  const [resolutionReason, setResolutionReason] = useState('');
  const { resolveDispute } = useTrustPay();
  
  // Don't show the button if the user is not a resolver
  if (!isResolver) {
    return null;
  }

  // Define resolution options
  const resolutionOptions = {
    favorPayer: {
      value: 0,
      label: "Favor Payer (Refund)",
      description: "The milestone amount will be refunded to the payer (no fee charged)"
    },
    favorRecipient: {
      value: 1,
      label: "Favor Recipient (Pay)",
      description: "The milestone amount will be paid to the recipient (fee charged)"
    },
    split: {
      value: 2,
      label: "Split 50/50",
      description: "The milestone amount will be split equally between payer and recipient (no fee charged)"
    }
  };
  
  const handleResolve = async () => {
    if (!resolutionReason.trim() || resolutionReason.length < 10) {
      toast.error("Please provide a resolution reason (minimum 10 characters)");
      return;
    }

    if (resolutionReason.length > 500) {
      toast.error("Resolution reason must be 500 characters or less");
      return;
    }

    try {
      toast.info("Resolving dispute...", {
        description: "Please confirm the transaction in your wallet"
      });

      await resolveDispute.mutateAsync({
        trustPay,
        milestoneIndex,
        resolution,
        resolutionReason
      });
      
      toast.success("Dispute resolved successfully!", {
        description: `Resolution: ${
          resolution === 0 ? "Favor Payer" : 
          resolution === 1 ? "Favor Recipient" : 
          "Split 50/50"
        }`
      });

      setOpen(false);
      setResolutionReason('');
      setResolution(1);
      
      if (onResolved) {
        onResolved();
      }
    } catch (error) {
      console.error("Failed to resolve dispute:", error);
      
      let errorMessage = "Failed to resolve dispute";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes("User rejected")) {
          errorMessage = "Transaction was cancelled";
        } else if (errorMessage.includes("UnauthorizedResolver")) {
          errorMessage = "You are not authorized to resolve disputes";
        }
      }
      
      toast.error(errorMessage);
    }
  };
  
  return (
    <>
      <Button 
        variant="outline"
        className={`bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 border-yellow-600 ${className}`}
        onClick={() => setOpen(true)}
        disabled={disabled || resolveDispute.isPending}
      >
        {resolveDispute.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Resolving...
          </>
        ) : (
          <>
            <Scale className="mr-2 h-4 w-4" />
            Resolve Dispute
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Resolve Dispute - Milestone {milestoneIndex + 1}</DialogTitle>
            <DialogDescription className="text-gray-400">
              As a resolver, you can resolve this dispute in favor of either party or split the amount.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {milestoneDescription && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-300">
                  <strong>Milestone:</strong> {milestoneDescription}
                </p>
              </div>
            )}

            <div className="mb-4">
              <h4 className="mb-3 font-medium text-gray-300">Resolution Decision</h4>
              <RadioGroup 
                value={resolution.toString()} 
                onValueChange={(value: string) => setResolution(Number(value))}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 border border-gray-700 rounded-lg hover:bg-gray-800">
                  <RadioGroupItem 
                    value={resolutionOptions.favorPayer.value.toString()} 
                    id="favor-payer" 
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="favor-payer" className="font-medium cursor-pointer text-gray-300">
                      {resolutionOptions.favorPayer.label}
                    </Label>
                    <p className="text-sm text-gray-400 mt-1">
                      {resolutionOptions.favorPayer.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 border border-gray-700 rounded-lg hover:bg-gray-800">
                  <RadioGroupItem 
                    value={resolutionOptions.favorRecipient.value.toString()} 
                    id="favor-recipient" 
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="favor-recipient" className="font-medium cursor-pointer text-gray-300">
                      {resolutionOptions.favorRecipient.label}
                    </Label>
                    <p className="text-sm text-gray-400 mt-1">
                      {resolutionOptions.favorRecipient.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border border-gray-700 rounded-lg hover:bg-gray-800">
                  <RadioGroupItem 
                    value={resolutionOptions.split.value.toString()} 
                    id="split" 
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="split" className="font-medium cursor-pointer text-gray-300">
                      {resolutionOptions.split.label}
                    </Label>
                    <p className="text-sm text-gray-400 mt-1">
                      {resolutionOptions.split.description}
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="reason" className="mb-2 block font-medium text-gray-300">
                Resolution Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain the reason for your decision (10-500 characters)..."
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                className="min-h-[120px] bg-gray-800 border-gray-700 text-white"
                maxLength={500}
              />
              <p className="text-sm text-gray-400 mt-1">
                {resolutionReason.length}/500 characters
                {resolutionReason.length > 0 && resolutionReason.length < 10 && (
                  <span className="text-red-400 ml-2">
                    (minimum 10 characters required)
                  </span>
                )}
              </p>
            </div>

            <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800">
              <p className="text-sm text-blue-200">
                <strong>⚖️ Important:</strong> Your resolution will be recorded on-chain and cannot be reversed. 
                Make sure you&apos;ve reviewed all dispute details before proceeding.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setOpen(false);
                setResolutionReason('');
                setResolution(1);
              }}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResolve}
              disabled={
                resolveDispute.isPending || 
                !resolutionReason.trim() || 
                resolutionReason.length < 10 ||
                resolutionReason.length > 500
              }
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {resolveDispute.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <Scale className="mr-2 h-4 w-4" />
                  Confirm Resolution
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}