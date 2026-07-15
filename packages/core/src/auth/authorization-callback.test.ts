import { describe, expect, it } from "vitest";
import { buildAuthorizationCallbackUrl } from "./authorization-callback.js";

describe("buildAuthorizationCallbackUrl", () => {
  it("preserves callback parameters while adding the one-time grant and state", () => {
    expect(buildAuthorizationCallbackUrl({
      authorizationCode: "authorization-code",
      redirectUrl: "https://customer.test/api/vulyo/callback?source=email",
      state: "transaction-state",
    })).toBe("https://customer.test/api/vulyo/callback?source=email&code=authorization-code&state=transaction-state");
  });
});
