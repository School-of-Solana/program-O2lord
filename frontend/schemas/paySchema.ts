import { z } from "zod";

// Milestone input schema for creating contracts
export const MilestoneInputSchema = z.object({
  description: z.string().min(1, "Description is required").max(200, "Description must be 200 characters or less"),
  amount: z.coerce.number().positive("Amount must be positive"),
});

export const CreatePaySchema = z.object({
  mint: z.string().min(1, "Token mint is required"),
  recipient: z.string().min(1, "Recipient address is required"),
  title: z.string().min(1, "Title is required").max(50, "Title must be 50 characters or less"),
  termsAndConditions: z.string()
    .min(10, "Terms and conditions must be at least 10 characters")
    .max(1000, "Terms and conditions must be 1000 characters or less"),
  totalAmount: z.coerce.number().positive("Total amount must be positive"),
  milestones: z.array(MilestoneInputSchema).max(10, "Maximum 10 milestones allowed"), 
  deadlineDurationSeconds: z.coerce.number().positive("Deadline duration must be a positive number"),
});

export type CreatePaySchemaType = z.infer<typeof CreatePaySchema>;
export type MilestoneInputType = z.infer<typeof MilestoneInputSchema>;