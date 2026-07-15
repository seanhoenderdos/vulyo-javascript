import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("./validation.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./validation.js")>();
  return { ...original, validateVulyoAccessToken: vi.fn(async () => ({ claims: { sub: "user_1" } })) };
});

import { handleVulyoProxyRequest } from "./route-handler.js";

const options = {
  apiUrl: "https://api.vulyo.test",
  authUrl: "https://auth.vulyo.test",
  publishableKey: "pk_test_adapter",
  secretKey: "sk_test_adapter",
};

describe("Vulyo same-origin route handler", () => {
  it("sets a readable host-only CSRF cookie without enabling cross-origin credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ app: { id: "app_1" } }), { status: 200 }));
    const response = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/config"), { ...options, fetcher });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__vulyo_csrf=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).not.toContain("Domain=");
  });

  it("bootstraps CSRF for an anonymous session when app config was rendered on the server", async () => {
    const response = await handleVulyoProxyRequest(
      new NextRequest("https://customer.test/api/vulyo/session"),
      options,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entitlements: null, user: null });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__vulyo_csrf=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).not.toContain("Domain=");
  });

  it("preserves the browser user agent when proxying authenticated account requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: "user_1",
      email: "user@example.test",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0";
    const request = new NextRequest("https://customer.test/api/vulyo/account", {
      headers: {
        cookie: "__vulyo_session=access-token",
        "user-agent": browserUserAgent,
      },
    });

    const response = await handleVulyoProxyRequest(request, { ...options, fetcher });

    expect(response.status).toBe(200);
    const forwardedHeaders = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(forwardedHeaders.get("user-agent")).toBe(browserUserAgent);
  });

  it("rejects a mutation without exact Origin and double-submit CSRF", async () => {
    const response = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/transactions", { method: "POST" }), options);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: { code: "forbidden", message: "Request origin is not allowed." } });
  });

  it("keeps PKCE verifier material in an HttpOnly host-only transaction cookie", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      transactionId: "f61eaa9c-d4ea-4cc0-ae06-4f39e22a3f43",
      state: "state_from_platform",
      nonce: "nonce_from_platform",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }), { status: 201, headers: { "content-type": "application/json" } }));
    const request = new NextRequest("https://customer.test/api/vulyo/transactions", {
      method: "POST",
      headers: { cookie: "__vulyo_csrf=csrf_value", origin: "https://customer.test", "x-csrf-token": "csrf_value", "content-type": "application/json" },
      body: JSON.stringify({ purpose: "sign_in", provider: "password", redirectUrl: "/dashboard" }),
    });
    const response = await handleVulyoProxyRequest(request, { ...options, fetcher });
    expect(response.status).toBe(201);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__vulyo_transaction=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as { codeChallenge: string; redirectUri: string };
    expect(body.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(body.redirectUri).toBe("https://customer.test/api/vulyo/callback");
  });

  it("preserves sign-up intent when starting social authentication", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      transactionId: "f61eaa9c-d4ea-4cc0-ae06-4f39e22a3f43",
      state: "state_from_platform",
      nonce: "nonce_from_platform",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }), { status: 201, headers: { "content-type": "application/json" } }));
    const request = new NextRequest("https://customer.test/api/vulyo/oauth/google?redirect_url=%2Fwelcome&failure_url=%2Fregister&purpose=sign_up");
    const response = await handleVulyoProxyRequest(request, { ...options, fetcher });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toMatch(/^https:\/\/auth\.vulyo\.test\/api\/v1\/oauth\/google\/start\?/u);
    expect(response.headers.get("location")).not.toContain("api.vulyo.test");
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as { purpose: string };
    expect(body.purpose).toBe("sign_up");
    const transactionCookie = response.cookies.get("__vulyo_transaction")?.value;
    expect(transactionCookie).toBeTruthy();
    const transaction = JSON.parse(Buffer.from(transactionCookie!, "base64url").toString("utf8")) as {
      failureReturnTo: string;
      publishableKey: string;
    };
    expect(transaction.failureReturnTo).toBe("/register");
    expect(transaction.publishableKey).toBe(options.publishableKey);
  });

  it("keeps API transactions on the API host while starting account OAuth on the auth host", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      transactionId: "f61eaa9c-d4ea-4cc0-ae06-4f39e22a3f43",
      state: "state_from_platform_that_is_long_enough",
      nonce: "nonce_from_platform",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }), { status: 201, headers: { "content-type": "application/json" } }));
    const request = new NextRequest("https://customer.test/api/vulyo/account/oauth/github", {
      method: "POST",
      headers: {
        cookie: "__vulyo_csrf=csrf_value; __vulyo_session=access-token",
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ purpose: "link_account", redirectUrl: "/account" }),
    });

    const response = await handleVulyoProxyRequest(request, { ...options, fetcher });

    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.vulyo.test/api/v1/auth/transactions");
    await expect(response.json()).resolves.toMatchObject({
      url: expect.stringMatching(/^https:\/\/auth\.vulyo\.test\/api\/v1\/oauth\/github\/start\?/u),
    });
  });

  it("uses the registered first-party callback for password sign-up while preserving the local return path", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        transactionId: "f61eaa9c-d4ea-4cc0-ae06-4f39e22a3f43",
        state: "state_from_platform_that_is_long_enough",
        nonce: "nonce_from_platform",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ verificationRequired: true }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authorizationCode: "authorization_code" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: "access-token",
        expiresIn: 300,
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        user: { id: "user_1", email: "new@example.test" },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    const transactionResponse = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/transactions", {
      method: "POST",
      headers: { cookie: "__vulyo_csrf=csrf_value", origin: "https://customer.test", "x-csrf-token": "csrf_value", "content-type": "application/json" },
      body: JSON.stringify({ purpose: "sign_up", provider: "password", redirectUrl: "/dashboard" }),
    }), { ...options, fetcher });
    const transactionCookie = transactionResponse.cookies.get("__vulyo_transaction")?.value;
    expect(transactionCookie).toBeTruthy();

    const signUpResponse = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/sign-up", {
      method: "POST",
      headers: {
        cookie: `__vulyo_csrf=csrf_value; __vulyo_transaction=${transactionCookie}`,
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "new@example.test", password: "Password-A1!", redirectUrl: "/dashboard" }),
    }), { ...options, fetcher });

    expect(signUpResponse.status).toBe(201);
    const forwarded = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as {
      authTransactionId: string;
      redirectUrl: string;
      state: string;
    };
    expect(forwarded.authTransactionId).toBe("f61eaa9c-d4ea-4cc0-ae06-4f39e22a3f43");
    expect(forwarded.redirectUrl).toBe("https://customer.test/api/vulyo/callback");
    expect(forwarded.state).toBe("state_from_platform_that_is_long_enough");
    const transaction = JSON.parse(Buffer.from(transactionCookie!, "base64url").toString("utf8")) as { returnTo: string };
    expect(transaction.returnTo).toBe("/dashboard");

    const verificationResponse = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/verify-email", {
      method: "POST",
      headers: {
        cookie: `__vulyo_csrf=csrf_value; __vulyo_transaction=${transactionCookie}`,
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "123456", email: "new@example.test", redirectUrl: "/dashboard" }),
    }), { ...options, fetcher });
    expect(verificationResponse.status).toBe(200);
    const forwardedVerification = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body)) as { redirectUrl: string };
    expect(forwardedVerification.redirectUrl).toBe("https://customer.test/api/vulyo/callback");
    await expect(verificationResponse.json()).resolves.toMatchObject({ redirectUrl: "/dashboard" });
    expect(verificationResponse.cookies.get("__vulyo_session")?.value).toBe("access-token");
  });

  it("binds password-reset requests to the current first-party transaction", async () => {
    const transaction = {
      codeVerifier: "code-verifier",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      failureReturnTo: "/sign-in",
      publishableKey: options.publishableKey,
      purpose: "sign_in",
      redirectUri: "https://customer.test/api/vulyo/callback",
      returnTo: "/dashboard",
      state: "password_reset_state_that_is_long_enough",
      transactionId: "0ad2a997-55ea-47e0-ab3e-4379c81b6651",
    };
    const transactionCookie = Buffer.from(JSON.stringify(transaction)).toString("base64url");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { "content-type": "application/json" },
    }));
    const response = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/password-reset/request", {
      method: "POST",
      headers: {
        cookie: `__vulyo_csrf=csrf_value; __vulyo_transaction=${transactionCookie}`,
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "user@example.test", redirectUrl: "/dashboard" }),
    }), { ...options, fetcher });

    expect(response.status).toBe(202);
    const forwarded = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      authTransactionId: string;
      redirectUrl: string;
      state: string;
    };
    expect(forwarded).toMatchObject({
      authTransactionId: transaction.transactionId,
      redirectUrl: transaction.redirectUri,
      state: transaction.state,
    });
  });

  it("exchanges a transaction-bound password reset grant into first-party session cookies", async () => {
    const transaction = {
      codeVerifier: "password-reset-code-verifier",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      failureReturnTo: "/sign-in",
      publishableKey: options.publishableKey,
      purpose: "sign_in",
      redirectUri: "https://customer.test/api/vulyo/callback",
      returnTo: "/dashboard",
      state: "password_reset_state_that_is_long_enough",
      transactionId: "0ad2a997-55ea-47e0-ab3e-4379c81b6651",
    };
    const transactionCookie = Buffer.from(JSON.stringify(transaction)).toString("base64url");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authorizationCode: "password-reset-authorization-code",
        redirectUrl: transaction.redirectUri,
        state: transaction.state,
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: "reset-access-token",
        expiresIn: 300,
        refreshToken: "reset-refresh-token",
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        user: { id: "user_1", email: "user@example.test" },
      }), { status: 200, headers: { "content-type": "application/json" } }));
    const response = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/password-reset/confirm", {
      method: "POST",
      headers: {
        cookie: `__vulyo_csrf=csrf_value; __vulyo_transaction=${transactionCookie}`,
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "Replacement-A1!", token: "reset-token", redirectUrl: "/dashboard" }),
    }), { ...options, fetcher });

    expect(response.status).toBe(200);
    const forwarded = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      authTransactionId: string;
      redirectUrl: string;
      state: string;
    };
    expect(forwarded).toMatchObject({
      authTransactionId: transaction.transactionId,
      redirectUrl: transaction.redirectUri,
      state: transaction.state,
    });
    const exchange = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    };
    expect(exchange).toEqual({
      code: "password-reset-authorization-code",
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
    });
    await expect(response.json()).resolves.toMatchObject({ redirectUrl: "/dashboard" });
    expect(response.cookies.get("__vulyo_session")?.value).toBe("reset-access-token");
    expect(response.cookies.get("__vulyo_refresh")?.value).toBe("reset-refresh-token");
    expect(response.cookies.get("__vulyo_transaction")?.value).toBe("");
  });

  it("rejects password-reset completion without a first-party transaction cookie", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await handleVulyoProxyRequest(new NextRequest("https://customer.test/api/vulyo/password-reset/confirm", {
      method: "POST",
      headers: {
        cookie: "__vulyo_csrf=csrf_value",
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "Replacement-A1!", token: "reset-token", redirectUrl: "/dashboard" }),
    }), { ...options, fetcher });

    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves multipart request bytes and content type through the same-origin proxy", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 202 }));
    const form = new FormData(); form.set("avatar", new File(["image-bytes"], "avatar.png", { type: "image/png" }));
    const request = new NextRequest("https://customer.test/api/vulyo/waitlist", {
      method: "POST",
      headers: { cookie: "__vulyo_csrf=csrf_value", origin: "https://customer.test", "x-csrf-token": "csrf_value" },
      body: form,
    });
    const response = await handleVulyoProxyRequest(request, { ...options, fetcher });
    expect(response.status).toBe(202);
    const forwarded = fetcher.mock.calls[0]?.[1];
    expect(new Headers(forwarded?.headers).get("content-type")).toMatch(/^multipart\/form-data; boundary=/u);
    expect((forwarded?.body as ArrayBuffer).byteLength).toBeGreaterThan(0);
  });

  it("rotates the HttpOnly access cookie after password change without exposing the token to app JavaScript", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      accessToken: "rotated-access-token",
      expiresIn: 300,
      user: { id: "user_1", email: "user@example.test" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const request = new NextRequest("https://customer.test/api/vulyo/account/password", {
      method: "POST",
      headers: {
        cookie: "__vulyo_csrf=csrf_value; __vulyo_session=old-access-token; __vulyo_refresh=existing-refresh-token",
        origin: "https://customer.test",
        "x-csrf-token": "csrf_value",
        "content-type": "application/json",
      },
      body: JSON.stringify({ currentPassword: "old-password", newPassword: "new-password" }),
    });
    const response = await handleVulyoProxyRequest(request, { ...options, fetcher });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, user: { id: "user_1", email: "user@example.test" } });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__vulyo_session=rotated-access-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("__vulyo_refresh=");
  });
});
