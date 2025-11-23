"use client";
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { buttonVariants } from "./button";
import { cn } from "@/lib/utils";

type ConfirmationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isProcessing = false,
  variant = "default",
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="bg-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {typeof description === 'string' ? (
              description
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                {description}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={isProcessing}
            className="bg-gray-600 hover:bg-gray-700 text-white"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isProcessing}
            className={cn(
              buttonVariants({ variant }),
              "bg-red-600 hover:bg-red-700 text-white",
              isProcessing && "opacity-70 cursor-not-allowed"
            )}
          >
            {isProcessing ? "Processing..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;