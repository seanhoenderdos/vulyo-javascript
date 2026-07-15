import { describe, expect, it } from "vitest";
import {
  appBrandingSchema,
  appGoogleOAuthSettingsSchema,
  getPublicAuthProviderState,
  getSanitizedBranding,
} from "./app-settings.js";

describe("app auth settings", () => {
  it("normalizes customer branding settings", () => {
    expect(
      appBrandingSchema.parse({
        applicationName: "  Remotion Market  ",
        logoUrl: "/api/v1/assets/app-logos/demo.png",
        logoAltText: "",
        faviconUrl: "/api/v1/assets/app-favicons/demo.png",
        primaryColor: "#0F766E",
        supportEmail: " support@example.com ",
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
      }),
    ).toEqual({
      applicationName: "Remotion Market",
      logoUrl: "/api/v1/assets/app-logos/demo.png",
      logoAltText: null,
      faviconUrl: "/api/v1/assets/app-favicons/demo.png",
      primaryColor: "#0f766e",
      supportEmail: "support@example.com",
      termsUrl: "https://example.com/terms",
      privacyUrl: "https://example.com/privacy",
    });
  });

  it("rejects invalid app support and legal settings", () => {
    expect(() =>
      appBrandingSchema.parse({
        applicationName: "Vulyo",
        logoUrl: null,
        logoAltText: null,
        faviconUrl: null,
        primaryColor: null,
        supportEmail: "not-an-email",
        termsUrl: "javascript:alert(1)",
        privacyUrl: "https://example.com/privacy",
      }),
    ).toThrow();
  });

  it("sanitizes branding for hosted auth surfaces", () => {
    expect(
      getSanitizedBranding({
        applicationName: "",
        logoUrl: null,
        logoAltText: null,
        faviconUrl: null,
        primaryColor: null,
        supportEmail: null,
        termsUrl: null,
        privacyUrl: null,
      }),
    ).toEqual({
      applicationName: "Vulyo",
      logoUrl: null,
      logoAltText: "Vulyo logo",
      faviconUrl: null,
      primaryColor: "#16756f",
      supportEmail: null,
      termsUrl: null,
      privacyUrl: null,
    });
  });

  it("does not expose Google as ready until enabled and fully configured", () => {
    const disabled = appGoogleOAuthSettingsSchema.parse({ enabled: false, clientId: null, clientSecretConfigured: false });
    const missingSecret = appGoogleOAuthSettingsSchema.parse({ enabled: true, clientId: "google-client-id", clientSecretConfigured: false });
    const ready = appGoogleOAuthSettingsSchema.parse({ enabled: true, clientId: "google-client-id", clientSecretConfigured: true });
    const platformReady = appGoogleOAuthSettingsSchema.parse({
      enabled: true,
      clientId: null,
      clientSecretConfigured: false,
      platformCredentialsConfigured: true,
    });
    const productionNeedsCustomCredentials = appGoogleOAuthSettingsSchema.parse({
      enabled: true,
      clientId: null,
      clientSecretConfigured: false,
      platformCredentialsConfigured: true,
      requiresCustomCredentials: true,
    });

    expect(getPublicAuthProviderState(disabled)).toEqual({ provider: "google", enabled: false, configured: false });
    expect(getPublicAuthProviderState(missingSecret)).toEqual({ provider: "google", enabled: false, configured: false });
    expect(getPublicAuthProviderState(ready)).toEqual({ provider: "google", enabled: true, configured: true });
    expect(getPublicAuthProviderState(platformReady)).toEqual({ provider: "google", enabled: true, configured: true });
    expect(getPublicAuthProviderState(productionNeedsCustomCredentials)).toEqual({ provider: "google", enabled: false, configured: false });
  });
});
