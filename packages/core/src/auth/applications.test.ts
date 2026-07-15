import { describe, expect, it } from "vitest";
import {
  appCreateSchema,
  buildHostedAppUrl,
  createAppSlug,
  defaultAuthMethodSettings,
  getEnabledAuthIdentifiers,
  normalizeAuthMethodSettings,
} from "./applications.js";

describe("applications", () => {
  it("creates stable hosted app slugs from application names", () => {
    expect(createAppSlug("Remotion Market", "abc123")).toBe("remotion-market-abc123");
    expect(createAppSlug("  My <SignIn /> App  ", "xyz789")).toBe("my-signin-app-xyz789");
    expect(buildHostedAppUrl("remotion-market-abc123")).toBe("https://remotion-market-abc123.vulyo.com");
  });

  it("normalizes create application input with Clerk-like defaults", () => {
    const input = appCreateSchema.parse({
      applicationName: "My Application",
      email: true,
      phone: false,
      username: true,
      google: true,
      github: false,
    });

    expect(input).toEqual({
      applicationName: "My Application",
      email: true,
      phone: false,
      username: true,
      google: true,
      github: false,
    });
  });

  it("parses HTML checkbox values without treating false strings as enabled", () => {
    const input = appCreateSchema.parse({
      applicationName: "My Application",
      email: "false",
      phone: "on",
      username: "0",
      google: "off",
      github: "true",
    });

    expect(input).toEqual({
      applicationName: "My Application",
      email: false,
      phone: true,
      username: false,
      google: false,
      github: true,
    });
  });

  it("enforces at least one primary identifier", () => {
    expect(() =>
      normalizeAuthMethodSettings({
        ...defaultAuthMethodSettings,
        email: false,
        phone: false,
        username: false,
      }),
    ).toThrow("Enable at least one identifier.");
  });

  it("lists enabled identifiers in preview order", () => {
    expect(getEnabledAuthIdentifiers({ email: true, phone: true, username: true })).toEqual(["email", "phone", "username"]);
  });
});
