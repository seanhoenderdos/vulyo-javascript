import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createVulyoCallbackHandler } from "./callback.js";

function transactionCookie(purpose: "sign_in" | "sign_up" | "step_up" | "link_account" = "sign_in") {
  return Buffer.from(JSON.stringify({
    codeVerifier: "v".repeat(64), redirectUri: "https://customer.test/api/vulyo/callback",
    failureReturnTo: purpose === "sign_up" ? "/register" : "/login", purpose, returnTo: "/dashboard", state: "expected_state",
  })).toString("base64url");
}

describe("Vulyo callback handler", () => {
  it("rejects a mismatched state without exchanging the code", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createVulyoCallbackHandler({ apiUrl: "https://api.vulyo.test", publishableKey: "pk_test", secretKey: "sk_test", fetcher });
    const response = await handler(new NextRequest("https://customer.test/api/vulyo/callback?code=code_value&state=wrong", {
      headers: { cookie: `__vulyo_transaction=${transactionCookie()}` },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("error=invalid_request");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a denied social sign-up to SignUp with a stable policy code", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createVulyoCallbackHandler({ apiUrl: "https://api.vulyo.test", publishableKey: "pk_test", secretKey: "sk_test", fetcher });
    const response = await handler(new NextRequest("https://customer.test/api/vulyo/callback?error=waitlist_required&state=expected_state", {
      headers: { cookie: `__vulyo_transaction=${transactionCookie("sign_up")}` },
    }));
    expect(response.headers.get("location")).toBe("https://customer.test/register?vulyo_oauth_error=waitlist_required");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves the active session when OAuth step-up is denied", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createVulyoCallbackHandler({ apiUrl: "https://api.vulyo.test", publishableKey: "pk_test", secretKey: "sk_test", fetcher });
    const response = await handler(new NextRequest("https://customer.test/api/vulyo/callback?error=oauth_failed&state=expected_state", {
      headers: { cookie: `__vulyo_transaction=${transactionCookie("step_up")}; __vulyo_session=existing_access; __vulyo_refresh=existing_refresh` },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://customer.test/dashboard?vulyo_oauth_error=oauth_failed");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__vulyo_transaction=");
    expect(cookie).not.toContain("__vulyo_session=");
    expect(cookie).not.toContain("__vulyo_refresh=");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("exchanges once and issues host-only access and refresh cookies", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      accessToken: "access_token", expiresIn: 300, refreshToken: "refresh_token",
      refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(), user: { id: "user_1" },
    }), { status: 200 }));
    const handler = createVulyoCallbackHandler({ apiUrl: "https://api.vulyo.test", publishableKey: "pk_test", secretKey: "sk_test", fetcher });
    const response = await handler(new NextRequest("https://customer.test/api/vulyo/callback?code=code_value&state=expected_state", {
      headers: { cookie: `__vulyo_transaction=${transactionCookie()}` },
    }));
    expect(response.headers.get("location")).toBe("https://customer.test/dashboard");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__vulyo_session=access_token");
    expect(cookie).toContain("__vulyo_refresh=refresh_token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Domain=");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
