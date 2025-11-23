"use client";
import React, { useCallback, useState, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Form,
  FormItem,
  FormControl,
  FormMessage,
} from "../ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../ui/button";
import { toast } from "sonner";
import useTrustPay, { ContractType, Role } from "@/hooks/useTrustPay";
import { ChevronDown, ChevronUp, Coins, CreditCard, DollarSign, InfoIcon, Loader2, User, Briefcase } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { TokenSelect } from "../ui/select";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useFieldArray } from "react-hook-form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import TokenDisplay from "../TokenDisplay";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { CreatePaySchema, CreatePaySchemaType } from "@/schemas/paySchema";
import { Plus, Trash2, Calendar, FileText, Clock } from "lucide-react";
import { BN } from "@coral-xyz/anchor";

type TokenInfo = {  
  mint: string;
  balance: number;
};

type Props = {
  trigger: React.ReactNode;
};

type MilestoneInput = {
  description: string;
  amount: BN;
};

// Define fee constants
const FEE_PERCENTAGE = 0.05; // 0.5% fee
const MIN_FEE = 0.001; // Minimum fee
const MAX_FEE_PERCENTAGE = 1; // Maximum fee percentage

// Duration options
const DURATION_OPTIONS = [
  { label: "1 Hour", value: 3600, shortLabel: "1h" },
  { label: "6 Hours", value: 21600, shortLabel: "6h" },
  { label: "12 Hours", value: 43200, shortLabel: "12h" },
  { label: "1 Day", value: 86400, shortLabel: "1d" },
  { label: "3 Days", value: 259200, shortLabel: "3d" },
  { label: "1 Week", value: 604800, shortLabel: "1w" },
  { label: "2 Weeks", value: 1209600, shortLabel: "2w" },
  { label: "1 Month", value: 2592000, shortLabel: "1m" },
  { label: "3 Months", value: 7776000, shortLabel: "3m" },
  { label: "6 Months", value: 15552000, shortLabel: "6m" },
];

const CreateContractDialog: React.FC<Props> = ({ trigger }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { createContract, getMintInfo } = useTrustPay();
  const { publicKey, wallet } = useWallet();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(2592000); // Default to 1 month
  const [creatorRole, setCreatorRole] = useState<Role>(Role.PAYER); // Default to payer (client)
  const [contractType, setContractType] = useState<ContractType>(ContractType.MILESTONE); // Default to milestone
  const allowedMints = process.env.NEXT_PUBLIC_ALLOWED_MINTS?.split(",") || [];
  const tokenMetadata = useTokenMetadata(selectedToken || "");
  
  const form = useForm<CreatePaySchemaType>({
    resolver: zodResolver(CreatePaySchema),
    defaultValues: {
      mint: "",
      recipient: "",
      title: "",
      totalAmount: 0,
      milestones: [{ description: "", amount: 0 }],
      deadlineDurationSeconds: 2592000, 
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "milestones"
  });
  
  // Calculate total milestone amounts
  const totalMilestoneAmount = contractType === ContractType.MILESTONE 
  ? form.watch("milestones").reduce((sum, milestone) => sum + (milestone.amount || 0), 0)
  : 0;
  const totalAmount = form.watch("totalAmount");
  const amountMismatch = contractType === ContractType.MILESTONE && 
                       totalAmount > 0 && 
                       Math.abs(totalAmount - totalMilestoneAmount) > 0.01;


  // Fixed fetchTokens function that supports both SPL Token and Token-2022
  useEffect(() => {
    const fetchTokens = async () => {
      if (!publicKey) {
        // Still show allowed mints even without wallet connection for buy orders
        const tokensWithZeroBalance: TokenInfo[] = allowedMints.map(mint => ({
          mint,
          balance: 0
        }));
        setTokens(tokensWithZeroBalance);
        return;
      }

      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl);
        
        // Add connection test
        const slot = await connection.getSlot();

        // Import getAssociatedTokenAddress for direct token account lookups
        const { getAssociatedTokenAddress } = await import("@solana/spl-token");

        // Fetch specific token accounts for each allowed mint
        const tokenPromises = allowedMints.map(async (mint) => {
          try {
            // Try Token-2022 program first
            const ata2022 = await getAssociatedTokenAddress(
              new PublicKey(mint),
              publicKey,
              false, // allowOwnerOffCurve
              new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") // Token-2022 program
            );
            
            const accountInfo2022 = await connection.getParsedAccountInfo(ata2022);
            if (accountInfo2022.value && 'parsed' in accountInfo2022.value.data) {
              const tokenData = accountInfo2022.value.data.parsed.info;
              return {
                mint: tokenData.mint,
                balance: tokenData.tokenAmount.uiAmount || 0,
              };
            }
          } catch (token2022Error) {
            // Continue to SPL token fallback
          }

          try {
            // Fallback to regular SPL token
            const ataRegular = await getAssociatedTokenAddress(
              new PublicKey(mint),
              publicKey,
              false, // allowOwnerOffCurve
              new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") // Regular SPL Token program
            );
            
            const accountInfoRegular = await connection.getParsedAccountInfo(ataRegular);
            if (accountInfoRegular.value && 'parsed' in accountInfoRegular.value.data) {
              const tokenData = accountInfoRegular.value.data.parsed.info;
              return {
                mint: tokenData.mint,
                balance: tokenData.tokenAmount.uiAmount || 0,
              };
            }
          } catch (splError) {
            // Continue to fallback
          }

          // If no account found, return with zero balance (user can still create buy orders)
          return {
            mint,
            balance: 0,
          };
        });

        // Wait for all token lookups to complete
        const userTokens = await Promise.all(tokenPromises);
        setTokens(userTokens);

      } catch (error) {
        console.error("❌ Error fetching tokens:", error);
        
        // Ultimate fallback: show all allowed mints with zero balance
        const fallbackTokens: TokenInfo[] = allowedMints.map(mint => ({
          mint,
          balance: 0
        }));
        
        setTokens(fallbackTokens);
      }
    };

    fetchTokens();
  }, [publicKey]);

  useEffect(() => {
  if (contractType === ContractType.ONE_TIME) {
    form.setValue("milestones", []); // Clear milestones
  } else {
    // Ensure at least one milestone exists for milestone contracts
    if (fields.length === 0) {
      append({ description: "", amount: 0 });
    }
  }
}, [contractType]);

  const onSubmit = useCallback(
    async (values: CreatePaySchemaType) => {
      if (!publicKey) {
        toast.error("Please connect your wallet.");
        return;
      }

      if (!selectedToken) {
        toast.error("Please select a token.");
        return;
      }
// Validate title
      if (!values.title || values.title.trim().length === 0) {
        toast.error("Contract title is required");
        form.setError("title", { message: "Title is required" });
        return;
      }
      if (values.title.length > 50) {
        toast.error("Contract title must be 50 characters or less");
        form.setError("title", { message: "Must be 50 characters or less" });
        return;
      }

      // Validate terms and conditions
      if (!values.termsAndConditions || values.termsAndConditions.trim().length === 0) {
        toast.error("Terms and conditions are required");
        form.setError("termsAndConditions", { message: "Terms and conditions are required" });
        return;
      }
      if (values.termsAndConditions.length < 10) {
        toast.error("Terms and conditions must be at least 10 characters");
        form.setError("termsAndConditions", { message: "Must be at least 10 characters" });
        return;
      }
      if (values.termsAndConditions.length > 1000) {
        toast.error("Terms and conditions must be 1000 characters or less");
        form.setError("termsAndConditions", { message: "Must be 1000 characters or less" });
        return;
      }

      // Validate recipient address
      if (!values.recipient || values.recipient.trim().length === 0) {
        toast.error(`${creatorRole === Role.PAYER ? 'Service provider' : 'Client'} address is required`);
        form.setError("recipient", { message: "Address is required" });
        return;
      }

      // Validate total amount
      if (!values.totalAmount || values.totalAmount <= 0) {
        toast.error("Total amount must be greater than 0");
        return;
      }

      // Validate milestones for milestone contracts
      if (contractType === ContractType.MILESTONE) {
        if (values.milestones.length === 0) {
          toast.error("At least one milestone is required for milestone contracts");
          return;
        }
        if (values.milestones.length > 10) {
          toast.error("Maximum 10 milestones allowed");
          return;
        }
        
        // Validate each milestone
        for (let i = 0; i < values.milestones.length; i++) {
          const milestone = values.milestones[i];
          if (!milestone.description || milestone.description.trim().length === 0) {
            toast.error(`Milestone ${i + 1}: Description is required`);
            form.setError(`milestones.${i}.description`, { message: "Required" });
            return;
          }
          if (milestone.description.length > 200) {
            toast.error(`Milestone ${i + 1}: Description must be 200 characters or less`);
            form.setError(`milestones.${i}.description`, { message: "Too long" });
            return;
          }
          if (!milestone.amount || milestone.amount <= 0) {
            toast.error(`Milestone ${i + 1}: Amount must be greater than 0`);
            form.setError(`milestones.${i}.amount`, { message: "Required" });
            return;
          }
        }
      }

      try {
        // Validate milestone amounts match total for milestone contracts
        if (contractType === ContractType.MILESTONE && amountMismatch) {
          toast.error("Milestone amounts must sum to the total contract amount");
          return;
        }

        // Validate other party address
        let otherPartyPubkey: PublicKey;
        try {
          otherPartyPubkey = new PublicKey(values.recipient);
        } catch (error) {
          toast.error(`Invalid ${creatorRole === Role.PAYER ? 'recipient' : 'payer'} address`);
          return;
        }

        // Get mint info to get decimals
        const mintPubkey = new PublicKey(selectedToken);
        const mintInfo = await getMintInfo(mintPubkey);
        const decimals = mintInfo.decimals;

        // Convert amounts to smallest unit (based on decimals)
        const totalAmountLamports = Math.floor(values.totalAmount * Math.pow(10, decimals));
        
        // Convert milestone amounts or create single milestone for one-time payment
        let milestoneInputs: MilestoneInput[];

        if (contractType === ContractType.MILESTONE) {
          milestoneInputs = values.milestones.map(milestone => ({
            description: milestone.description,
            amount: new BN(Math.floor(milestone.amount * Math.pow(10, decimals))),
          }));
        } else {
          // For one-time payment, create a single milestone
          milestoneInputs = [];
        }

        // Generate a random seed for the contract
        const seed = new BN(Math.floor(Math.random() * 1000000000));

        // Determine payer based on creator role
        const payerPubkey = creatorRole === Role.PAYER ? publicKey : otherPartyPubkey;

       const contractData = {
          creatorRole,
          payerPubkey,
          otherParty: otherPartyPubkey,
          contractType,
          mint: mintPubkey.toString(),
          title: values.title,
          termsAndConditions: values.termsAndConditions,
          totalAmount: values.totalAmount,  // Pass the original number
          milestoneInputs: values.milestones.map(m => ({
            description: m.description,
            amount: m.amount
          })),
          deadlineDurationSeconds: selectedDuration,
        };


        toast.info("Creating contract...", {
          description: "Please confirm the transaction in your wallet",
        });

        const result = await createContract.mutateAsync(contractData);

        toast.success("Contract created successfully!", {
          description: `Transaction: ${result.signature.slice(0, 8)}...`,
        });

        // Reset form and close dialog
        form.reset();
        setSelectedToken(null);
        setSelectedDuration(2592000); // Reset to default 1 month
        setCreatorRole(Role.PAYER);
        setContractType(ContractType.MILESTONE);
        queryClient.invalidateQueries({
          queryKey: ["get-trust-pay-accounts"],
        });
        setOpen(false);

      } catch (error) {
        console.error("❌ Error creating contract:", error);
        
        let errorMessage = "Failed to create contract";
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Handle specific errors
          if (errorMessage.includes("insufficient funds")) {
            errorMessage = "Insufficient funds. Make sure you have enough tokens and SOL for fees.";
          } else if (errorMessage.includes("User rejected")) {
            errorMessage = "Transaction was cancelled.";
          }
        }
        
        toast.error(errorMessage);
      }
    },
    [form, createContract, queryClient, selectedToken, amountMismatch, selectedDuration, publicKey, getMintInfo, creatorRole, contractType]
  );

  const setTokenAmount = (amount: number) => {
    form.setValue("totalAmount", amount);
  };

  const addMilestone = () => {
    if (fields.length < 10) {
      append({ description: "", amount: 0 });
    } else {
      toast.error("Maximum 10 milestones allowed");
    }
  };

  const removeMilestone = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    } else {
      toast.error("At least one milestone is required");
    }
  };

  const formatDurationDisplay = (seconds: number) => {
    const option = DURATION_OPTIONS.find(opt => opt.value === seconds);
    return option ? option.label : `${seconds}s`;
  };

  const isSubmitting = createContract.isPending;

  // Get appropriate label based on creator role
  const getOtherPartyLabel = () => {
    return creatorRole === Role.PAYER ? "Service Provider Address" : "Client Address (Payer)";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger> 
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">

        <DialogHeader className="relative"> 
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 p-2.5 rounded-lg">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                   Create New Contract
                </DialogTitle >
                <DialogDescription className="text-gray-400">
                   Create a contract with secure escrow functionality.
                </DialogDescription>
              </div>
          </div>
        </DialogHeader>
        <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          
          {/* SECTION 0: ROLE SELECTION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-300">
              <User className="w-4 h-4 text-purple-400"/>
              <span className="text-sm font-medium">I am creating this contract as:</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreatorRole(Role.PAYER)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  creatorRole === Role.PAYER
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <User className="w-6 h-6" />
                  <span className="font-semibold">Client (Payer)</span>
                  <span className="text-xs opacity-75">I will pay for the work</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCreatorRole(Role.RECIPIENT)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  creatorRole === Role.RECIPIENT
                    ? "border-green-500 bg-green-500/20 text-green-300"
                    : "border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Briefcase className="w-6 h-6" />
                  <span className="font-semibold">Service Provider</span>
                  <span className="text-xs opacity-75">I will do the work</span>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 0.5: CONTRACT TYPE SELECTION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-300">
              <FileText className="w-4 h-4 text-purple-400"/>
              <span className="text-sm font-medium">Contract Type:</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setContractType(ContractType.ONE_TIME)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  contractType === ContractType.ONE_TIME
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <DollarSign className="w-6 h-6" />
                  <span className="font-semibold">One-Time Payment</span>
                  <span className="text-xs opacity-75">Single payment upon completion</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setContractType(ContractType.MILESTONE)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  contractType === ContractType.MILESTONE
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-800"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Calendar className="w-6 h-6" />
                  <span className="font-semibold">Milestone-Based</span>
                  <span className="text-xs opacity-75">Multiple payments for stages</span>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 1: TOKEN SELECTION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-300">
              <Coins className="w-4 h-4 text-blue-400"/>
              <span className="text-sm font-medium">Select Payment Token</span>
            </div>
            <FormItem>
              <FormControl>
                <div className="relative flex min-h-[100px] flex-col space-y-3 rounded-xl border border-gray-600 p-4 focus-within:border-blue-500 bg-gray-800">
                  <div className="flex flex-1 items-center space-x-2">
                    <div className="group/select flex items-center justify-between">
                      <TokenSelect
                        tokens={tokens}
                        onTokenChange={(token) => {
                          if (token && token.mint) {
                            setSelectedToken(token.mint);
                            form.setValue("mint", token.mint);
                            setTokenAmount(0);
                          } else {
                            console.warn("Invalid token or mint received:", token);
                            setSelectedToken(null);
                            form.setValue("mint", "");
                            setTokenAmount(0);
                          }
                        }}
                        onMaxClick={(balance) => setTokenAmount(balance)}
                        onHalfClick={(balance) => setTokenAmount(balance / 2)}
                        ringColorClass="ring-blue-500"
                      />
                    </div>
                    <span className="flex-1 text-right">
                      <div className="flex h-full flex-col text-right">
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          name="totalAmount"
                          data-lpignore="true"
                          placeholder={form.watch("totalAmount") === 0 ? "0.00" : String(form.watch("totalAmount"))}
                          className="h-full w-full bg-transparent text-right placeholder:text-gray-500 text-2xl outline-none font-semibold text-white"
                          type="number"
                          step="0.000001"
                          value={form.watch("totalAmount") === 0 ? "" : form.watch("totalAmount")}
                          onChange={(e) => {
                            const newValue = e.target.value === "" ? 0 : Number(e.target.value);
                            setTokenAmount(newValue);
                          }}
                        />
                      </div>
                    </span>
                  </div>
                </div>
              </FormControl>
            </FormItem>
          </div>

          {/* SECTION 2: CONTRACT DETAILS */}
          <div className="space-y-4">
            {/* Title */}
            <FormItem>
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <FileText className="w-4 h-4 text-blue-400"/>
                <span className="text-sm font-medium">Contract Title</span>
              </div>
            <FormControl>
              <div className={`relative rounded-xl border p-4 bg-gray-800 focus-within:border-blue-500 ${
                form.formState.errors.title ? 'border-red-500' : 'border-gray-600'
              }`}>
                <input
                  type="text"
                  placeholder="Enter contract title (max 50 characters)"
                  maxLength={50}
                  className="w-full bg-transparent text-white text-lg outline-none placeholder:text-gray-500"
                  {...form.register("title")}
                />
                <div className="text-xs text-gray-400 mt-1">
                  {form.watch("title")?.length || 0}/50 characters
                </div>
                {form.formState.errors.title && (
                  <p className="text-xs text-red-400 mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>
            </FormControl>
            </FormItem>
            {/* Terms and Conditions */}
            <FormItem>
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <FileText className="w-4 h-4 text-blue-400"/>
                <span className="text-sm font-medium">Terms and Conditions</span>
              </div>
            <FormControl>
              <div className={`relative rounded-xl border p-4 bg-gray-800 focus-within:border-blue-500 ${
                form.formState.errors.termsAndConditions ? 'border-red-500' : 'border-gray-600'
              }`}>
                <textarea
                  placeholder="Describe the work to be done, deliverables, acceptance criteria, and any other terms..."
                  maxLength={1000}
                  rows={5}
                  className="w-full bg-transparent text-white text-sm outline-none placeholder:text-gray-500 resize-none"
                  {...form.register("termsAndConditions")}
                />
                <div className="text-xs text-gray-400 mt-1 flex justify-between">
                  <span>Define clear terms for both parties</span>
                  <span>{form.watch("termsAndConditions")?.length || 0}/1000</span>
                </div>
                {form.formState.errors.termsAndConditions && (
                  <p className="text-xs text-red-400 mt-1">{form.formState.errors.termsAndConditions.message}</p>
                )}
              </div>
            </FormControl>
            </FormItem>

            {/* Other Party Address */}
            <FormItem>
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <span className="text-sm font-medium">{getOtherPartyLabel()}</span>
              </div>
             <FormControl>
              <div className={`relative rounded-xl border p-4 bg-gray-800 focus-within:border-blue-500 ${
                form.formState.errors.recipient ? 'border-red-500' : 'border-gray-600'
              }`}>
                <input
                  type="text"
                  placeholder={`Enter ${creatorRole === Role.PAYER ? 'service provider' : 'client'} wallet address`}
                  className="w-full bg-transparent text-white text-lg outline-none placeholder:text-gray-500 font-mono"
                  {...form.register("recipient")}
                />
                <div className="text-xs text-gray-400 mt-1">
                  Wallet address of the {creatorRole === Role.PAYER ? 'service provider' : 'client (who will pay)'}
                </div>
                {form.formState.errors.recipient && (
                  <p className="text-xs text-red-400 mt-1">{form.formState.errors.recipient.message}</p>
                )}
              </div>
            </FormControl>
            </FormItem>

            {/* Duration Selector */}
            <FormItem>
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <Clock className="w-4 h-4 text-green-400"/>
                <span className="text-sm font-medium">Contract Duration</span>
              </div>
              <FormControl>
                <div className="relative rounded-xl border border-gray-600 p-4 bg-gray-800 focus-within:border-green-500">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSelectedDuration(option.value);
                          form.setValue("deadlineDurationSeconds", option.value);
                        }}
                        className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                          selectedDuration === option.value
                            ? "border-green-500 bg-green-500/20 text-green-300"
                            : "border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-semibold">{option.shortLabel}</div>
                          <div className="text-xs opacity-75">{option.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Selected: {formatDurationDisplay(selectedDuration)} from acceptance
                  </div>
                </div>
              </FormControl>
            </FormItem>
          </div>

          {/* SECTION 3: MILESTONES (Only for Milestone contracts) */}
          {contractType === ContractType.MILESTONE && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-sm font-medium">Contract Milestones</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  disabled={fields.length >= 10}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Milestone
                </Button>
              </div>

              {fields.map((field, index) => (
               <div key={field.id} className={`relative rounded-xl border p-4 bg-gray-800 ${
                  form.formState.errors.milestones?.[index] ? 'border-red-500' : 'border-gray-600'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">Milestone {index + 1}</span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMilestone(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Milestone description"
                        className={`w-full bg-transparent text-white outline-none placeholder:text-gray-500 border-b pb-2 ${
                          form.formState.errors.milestones?.[index]?.description ? 'border-red-500' : 'border-gray-600'
                        }`}
                        {...form.register(`milestones.${index}.description`)}
                      />
                      {form.formState.errors.milestones?.[index]?.description && (
                        <p className="text-xs text-red-400 mt-1">
                          {form.formState.errors.milestones[index].description.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="Amount"
                        className={`w-full bg-transparent text-white outline-none placeholder:text-gray-500 border-b pb-2 ${
                          form.formState.errors.milestones?.[index]?.amount ? 'border-red-500' : 'border-gray-600'
                        }`}
                        {...form.register(`milestones.${index}.amount`, { valueAsNumber: true })}
                      />
                      {form.formState.errors.milestones?.[index]?.amount && (
                        <p className="text-xs text-red-400 mt-1">
                          {form.formState.errors.milestones[index].amount.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Amount validation */}
              {amountMismatch && (
                <div className="text-xs text-red-400 p-3 bg-red-900/20 rounded-lg border border-red-800">
                  ⚠️ Milestone amounts ({totalMilestoneAmount.toFixed(6)}) must equal total contract amount ({totalAmount.toFixed(6)})
                </div>
              )}
            </div>
          )}

          {/* Info about contract acceptance */}
          <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-600/30">
            <p className="text-sm text-blue-200">
              ℹ️ {creatorRole === Role.PAYER 
                ? "The service provider will need to accept this contract before work begins." 
                : "The client (payer) will need to accept and deposit funds before you can start work."}
            </p>
          </div>

          <FormMessage />
        </form>
        </Form>
        <DialogFooter className="flex gap-3 pt-4">
          <DialogClose asChild>
             <Button
              variant={"secondary"}
              type="button"
              onClick={() => {
                form.reset();
                setSelectedToken(null);
                setSelectedDuration(2592000);
                setCreatorRole(Role.PAYER);
                setContractType(ContractType.MILESTONE);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting || !publicKey || !selectedToken ||   (contractType === ContractType.MILESTONE && amountMismatch)
            }
            className="bg-blue-700 hover:bg-blue-800 text-white border border-black p-2 disabled:opacity-50"
          >
            {createContract.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Contract"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateContractDialog;