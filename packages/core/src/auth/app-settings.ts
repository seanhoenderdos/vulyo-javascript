import { z } from "zod";

const DEFAULT_BRAND_NAME = "Vulyo";
const DEFAULT_PRIMARY_COLOR = "#16756f";

const logoUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    if (value.startsWith("/")) return true;
    return z.string().url().safeParse(value).success;
  }, "Logo URL must be a valid absolute URL or a Vulyo-hosted asset path.");

const nullableLogoUrlSchema = logoUrlSchema
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" || value == null ? null : value));

const nullableHttpUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    const parsed = z.string().url().safeParse(value);
    if (!parsed.success) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "URL must be a valid HTTP or HTTPS URL.")
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" || value == null ? null : value));

const nullableTextSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" || value == null ? null : value));

const nullableEmailSchema = z
  .string()
  .trim()
  .email("Support email must be a valid email address.")
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" || value == null ? null : value));

const primaryColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a 6-digit hex color.")
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value === "" || value == null ? null : value.toLowerCase()));

export const appBrandingSchema = z.object({
  applicationName: z.string().trim().min(1, "Application name is required.").max(80, "Application name must be 80 characters or fewer."),
  logoUrl: nullableLogoUrlSchema,
  logoAltText: nullableTextSchema,
  faviconUrl: nullableLogoUrlSchema,
  primaryColor: primaryColorSchema,
  supportEmail: nullableEmailSchema,
  termsUrl: nullableHttpUrlSchema,
  privacyUrl: nullableHttpUrlSchema,
});

export const appGoogleOAuthSettingsSchema = z.object({
  enabled: z.boolean(),
  clientId: nullableTextSchema,
  clientSecretConfigured: z.boolean(),
  platformCredentialsConfigured: z.boolean().default(false),
  requiresCustomCredentials: z.boolean().default(false),
});

export type AppBrandingSettings = z.infer<typeof appBrandingSchema>;
export type AppGoogleOAuthSettings = z.infer<typeof appGoogleOAuthSettingsSchema>;

export type PublicAuthProviderState = {
  provider: "google" | "github";
  enabled: boolean;
  configured: boolean;
};

export function getSanitizedBranding(input: Partial<AppBrandingSettings>): AppBrandingSettings {
  const applicationName = input.applicationName?.trim() || DEFAULT_BRAND_NAME;

  return {
    applicationName,
    logoUrl: input.logoUrl ?? null,
    logoAltText: input.logoAltText?.trim() || `${applicationName} logo`,
    faviconUrl: input.faviconUrl ?? null,
    primaryColor: input.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    supportEmail: input.supportEmail ?? null,
    termsUrl: input.termsUrl ?? null,
    privacyUrl: input.privacyUrl ?? null,
  };
}

export function getPublicAuthProviderState(settings: AppGoogleOAuthSettings, provider: PublicAuthProviderState["provider"] = "google"): PublicAuthProviderState {
  const customCredentialsConfigured = Boolean(settings.clientId && settings.clientSecretConfigured);
  const developmentCredentialsConfigured = settings.platformCredentialsConfigured && !settings.requiresCustomCredentials;
  const configured = customCredentialsConfigured || developmentCredentialsConfigured;

  return {
    provider,
    enabled: settings.enabled && configured,
    configured,
  };
}
