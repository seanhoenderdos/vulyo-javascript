import { z } from "zod";

export const waitlistEntryStatusSchema = z.enum(["pending", "invited", "accepted", "archived"]);

export const waitlistJoinSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address.").max(320, "Enter a shorter email address."),
  source: z.enum(["component", "hosted"]).default("component"),
  turnstileToken: z.string().trim().min(1).max(4096).optional(),
});

export const waitlistInvitationAcceptSchema = z.object({
  token: z.string().trim().min(32).max(512),
});

export type WaitlistJoinInput = z.infer<typeof waitlistJoinSchema>;
export type WaitlistInvitationAcceptInput = z.infer<typeof waitlistInvitationAcceptSchema>;
export type WaitlistEntryStatus = z.infer<typeof waitlistEntryStatusSchema>;

export function normalizeWaitlistEmail(email: string) {
  return email.trim().toLowerCase();
}
