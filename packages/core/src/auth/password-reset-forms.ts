import { z } from "zod";
import { authTransactionRequestFields, requireCompleteAuthTransactionPair } from "./auth-transaction-forms.js";

export const passwordResetRequestSchema = z
  .object({
    ...authTransactionRequestFields,
    email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
    redirectUrl: z.string().default("/"),
  })
  .superRefine(requireCompleteAuthTransactionPair);

export const passwordResetConfirmSchema = z
  .object({
    ...authTransactionRequestFields,
    token: z.string().trim().min(1, "Reset token is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    redirectUrl: z.string().default("/"),
  })
  .superRefine(requireCompleteAuthTransactionPair);

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
