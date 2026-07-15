import { describe, expect, it } from "vitest";
import { normalizeWaitlistEmail, waitlistJoinSchema } from "./waitlist.js";

describe("waitlistJoinSchema", () => {
  it("accepts valid component submissions", () => {
    expect(waitlistJoinSchema.parse({ email: "Person@Example.com" })).toEqual({
      email: "Person@Example.com",
      source: "component",
    });
  });

  it("rejects invalid email addresses", () => {
    expect(() => waitlistJoinSchema.parse({ email: "not-an-email" })).toThrow();
  });

  it("normalizes email before persistence", () => {
    expect(normalizeWaitlistEmail(" Person@Example.com ")).toBe("person@example.com");
  });
});
