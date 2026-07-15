import { describe, expect, it } from "vitest";
import { createAuthRequestSchema, createSignInRequestSchema, validateAuthFormValues } from "./auth-forms.js";

describe("validateAuthFormValues", () => {
  it("returns trimmed email data for valid form values", () => {
    const result = validateAuthFormValues({ type: "sign-up", email: " user@example.com ", password: "password123" });

    expect(result.ok).toBe(true);
    expect(result.data?.email).toBe("user@example.com");
  });

  it("returns field-level errors for invalid email and password", () => {
    const result = validateAuthFormValues({ type: "sign-up", email: "bad-email", password: "short" });

    expect(result.ok).toBe(false);
    expect(result.fieldErrors).toEqual({
      email: "Enter a valid email address.",
      password: "Use at least 8 characters.",
    });
  });

  it("uses sign-in copy for short password errors", () => {
    const result = validateAuthFormValues({ type: "sign-in", email: "user@example.com", password: "short" });

    expect(result.ok).toBe(false);
    expect(result.fieldErrors.password).toBe("Password must be at least 8 characters.");
  });

  it("allows a username or phone number in the sign-in identifier field", () => {
    expect(validateAuthFormValues({ type: "sign-in", email: "afri_builder", password: "password123" }).ok).toBe(true);
    expect(validateAuthFormValues({ type: "sign-in", email: "+27825550101", password: "password123" }).ok).toBe(true);
  });

  it("preserves optional username and phone number values in auth requests", () => {
    const schema = createAuthRequestSchema("/dashboard/apps");

    expect(
      schema.parse({
        email: "user@example.com",
        password: "password123",
        phoneNumber: " +27 82 555 0101 ",
        username: " Afri_Builder ",
      }),
    ).toMatchObject({
      email: "user@example.com",
      phoneNumber: "+27825550101",
      username: "afri_builder",
    });
  });

  it("accepts only an explicit, version-bound legal acceptance", () => {
    const schema = createAuthRequestSchema("/");
    expect(schema.parse({ email: "user@example.com", password: "password123", legalAcceptance: { accepted: true, termsVersion: "2026-07" } }).legalAcceptance)
      .toEqual({ accepted: true, termsVersion: "2026-07" });
    expect(schema.safeParse({ email: "user@example.com", password: "password123", legalAcceptance: { accepted: false, termsVersion: "2026-07" } }).success)
      .toBe(false);
  });

  it("normalizes the sign-in identifier without requiring an email address", () => {
    const schema = createSignInRequestSchema("/dashboard/apps");

    expect(schema.parse({ email: " afri_builder ", password: "password123" })).toMatchObject({
      identifier: "afri_builder",
      redirectUrl: "/dashboard/apps",
    });
  });
});
