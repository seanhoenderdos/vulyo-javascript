import { z } from "zod";

export const authIdentifierSchema = z.enum(["email", "phone", "username"]);
export const authProviderSchema = z.enum(["google", "github"]);

export type AuthIdentifier = z.infer<typeof authIdentifierSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;

export type AuthMethodSettings = {
  email: boolean;
  phone: boolean;
  username: boolean;
  google: boolean;
  github: boolean;
};

export const defaultAuthMethodSettings = {
  email: true,
  phone: false,
  username: false,
  google: true,
  github: false,
} satisfies AuthMethodSettings;

function checkboxBoolean(defaultValue: boolean) {
  return z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return defaultValue;
      if (value === true || value === "true" || value === "on" || value === "1") return true;
      if (value === false || value === "false" || value === "off" || value === "0") return false;
      return value;
    }, z.boolean())
    .default(defaultValue);
}

export const appCreateSchema = z
  .object({
    applicationName: z.string().trim().min(1, "Application name is required.").max(80, "Application name must be 80 characters or fewer."),
    email: checkboxBoolean(defaultAuthMethodSettings.email),
    phone: checkboxBoolean(defaultAuthMethodSettings.phone),
    username: checkboxBoolean(defaultAuthMethodSettings.username),
    google: checkboxBoolean(defaultAuthMethodSettings.google),
    github: checkboxBoolean(defaultAuthMethodSettings.github),
  })
  .transform((value) => ({
    applicationName: value.applicationName,
    ...normalizeAuthMethodSettings(value),
  }));

export type AppCreateInput = z.infer<typeof appCreateSchema>;

export function createAppSlug(applicationName: string, suffix: string) {
  const slug = applicationName
    .trim()
    .toLowerCase()
    .replace(/[<>/]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42)
    .replace(/-+$/g, "");

  return `${slug || "app"}-${suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
}

export function buildHostedAppUrl(slug: string, rootDomain = "vulyo.com") {
  return `https://${slug}.${rootDomain}`;
}

export function normalizeAuthMethodSettings(settings: AuthMethodSettings): AuthMethodSettings {
  if (!settings.email && !settings.phone && !settings.username) {
    throw new Error("Enable at least one identifier.");
  }

  return {
    email: settings.email,
    phone: settings.phone,
    username: settings.username,
    google: settings.google,
    github: settings.github,
  };
}

export function getEnabledAuthIdentifiers(settings: Pick<AuthMethodSettings, "email" | "phone" | "username">): AuthIdentifier[] {
  return (["email", "phone", "username"] as const).filter((identifier) => settings[identifier]);
}

export function getEnabledAuthProviders(settings: Pick<AuthMethodSettings, "google" | "github">): AuthProvider[] {
  return (["google", "github"] as const).filter((provider) => settings[provider]);
}
