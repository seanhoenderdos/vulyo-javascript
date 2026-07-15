import { exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { signSessionToken, type PublicSigningJwk } from "@vulyo/core";
import { validateVulyoAccessToken } from "./validation.js";

const apiUrl = "https://api.vulyo.test";
const instanceId = "instance_1";
let accessToken: string;
let publicJwk: PublicSigningJwk;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  const privateJwk = await exportJWK(pair.privateKey);
  publicJwk = { ...(await exportJWK(pair.publicKey)), alg: "RS256", kid: "key_1", use: "sig" };
  accessToken = await signSessionToken({
    privateJwk,
    keyId: publicJwk.kid,
    issuer: apiUrl,
    audience: instanceId,
    claims: {
      sub: "user_1",
      sid: "session_1",
      app_id: "app_1",
      app_instance_id: instanceId,
      token_version: 2,
    },
  });
});

function createFetcher(overrides: Record<string, unknown> = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/.well-known/jwks.json")) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      active: true,
      appId: "app_1",
      appInstanceId: instanceId,
      sid: "session_1",
      sub: "user_1",
      tokenVersion: 2,
      user: {
        id: "user_1",
        appId: "app_1",
        appInstanceId: instanceId,
        email: "current@example.com",
        emailVerified: true,
        displayName: "Current profile",
        imageUrl: null,
      },
      entitlements: { features: ["reports"], plan: "pro" },
      ...overrides,
    }), { status: 200 });
  });
}

describe("authoritative access-token validation", () => {
  it("returns current profile and entitlements from uncached introspection", async () => {
    const fetcher = createFetcher();
    const validated = await validateVulyoAccessToken(accessToken, {
      apiUrl,
      fetcher,
      publishableKey: "pk_test_instance",
      secretKey: "sk_test_instance",
    });

    expect(validated?.claims).toMatchObject({ app_instance_id: instanceId, sub: "user_1" });
    expect(validated?.claims).not.toHaveProperty("email");
    expect(validated?.user.email).toBe("current@example.com");
    expect(validated?.entitlements).toEqual({ features: ["reports"], plan: "pro" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fails closed when introspection does not match the signed session", async () => {
    await expect(validateVulyoAccessToken(accessToken, {
      apiUrl,
      fetcher: createFetcher({ tokenVersion: 3 }),
      publishableKey: "pk_test_instance",
      secretKey: "sk_test_instance",
    })).resolves.toBeNull();
  });
});
