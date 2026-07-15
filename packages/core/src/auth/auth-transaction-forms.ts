import { z } from "zod";

export const authTransactionRequestFields = {
  authTransactionId: z.uuid().optional(),
  state: z.string().min(32).optional(),
} as const;

export function requireCompleteAuthTransactionPair(
  value: { authTransactionId?: string | undefined; state?: string | undefined },
  context: z.RefinementCtx,
) {
  if (Boolean(value.authTransactionId) !== Boolean(value.state)) {
    context.addIssue({
      code: "custom",
      message: "Authentication transaction and state must be provided together.",
    });
  }
}

export const authTransactionRequestSchema = z
  .object(authTransactionRequestFields)
  .superRefine(requireCompleteAuthTransactionPair);

export type AuthTransactionRequest = z.infer<typeof authTransactionRequestSchema>;
