import { z } from "zod";
import { authTransactionRequestFields, requireCompleteAuthTransactionPair } from "./auth-transaction-forms.js";

export const authModeSchema = z.enum(["sign-in", "sign-up"]);

export type AuthMode = z.infer<typeof authModeSchema>;

const emailSchema = z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address.");
const identifierSchema = z.string().trim().min(1, "Enter your email address, username, or phone number.");
const optionalUsernameSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || undefined;
}, z.string().min(1).optional());
const optionalPhoneNumberSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(/[^\d+]+/g, "");
  if (!normalized) return undefined;
  return normalized.startsWith("+") ? `+${normalized.slice(1).replace(/\D+/g, "")}` : normalized.replace(/\D+/g, "");
}, z.string().min(1).optional());

export const authCredentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
  phoneNumber: optionalPhoneNumberSchema,
  username: optionalUsernameSchema,
});

export const authFormSchema = z
  .object({
    type: authModeSchema,
    email: identifierSchema,
    password: z.string().min(1, "Enter your password."),
  })
  .superRefine((value, context) => {
    if (value.type === "sign-up") {
      const emailResult = emailSchema.safeParse(value.email);
      if (!emailResult.success) {
        context.addIssue({
          code: "custom",
          message: emailResult.error.issues[0]?.message ?? "Enter a valid email address.",
          path: ["email"],
        });
      }
    }
    if (value.password.length > 0 && value.password.length < 8) {
      context.addIssue({
        code: "custom",
        message: value.type === "sign-up" ? "Use at least 8 characters." : "Password must be at least 8 characters.",
        path: ["password"],
      });
    }
  });

export type AuthFormValues = z.infer<typeof authFormSchema>;

export type AuthFieldErrors = Partial<Record<"email" | "password", string>>;

export type AuthFormValidationResult =
  | { ok: true; data: AuthFormValues; fieldErrors: AuthFieldErrors }
  | { ok: false; data: null; fieldErrors: AuthFieldErrors };

export function createAuthRequestSchema(defaultRedirectUrl: string) {
  return authCredentialsSchema
    .extend({
      ...authTransactionRequestFields,
      legalAcceptance: z.object({
        accepted: z.literal(true),
        termsVersion: z.string().trim().min(1),
      }).optional(),
      redirectUrl: z.string().default(defaultRedirectUrl),
    })
    .superRefine(requireCompleteAuthTransactionPair);
}

export function createSignInRequestSchema(defaultRedirectUrl: string) {
  return authCredentialsSchema
    .extend({
      ...authTransactionRequestFields,
      email: identifierSchema,
      redirectUrl: z.string().default(defaultRedirectUrl),
    })
    .superRefine(requireCompleteAuthTransactionPair)
    .transform((value) => ({ ...value, identifier: value.email }));
}

function getAuthFieldErrors(error: z.ZodError<AuthFormValues>): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password") && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

export function validateAuthFormValues(input: AuthFormValues): AuthFormValidationResult {
  const result = authFormSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data, fieldErrors: {} };
  }

  return { ok: false, data: null, fieldErrors: getAuthFieldErrors(result.error) };
}
