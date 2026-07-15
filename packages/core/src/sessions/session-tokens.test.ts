import { exportJWK, generateKeyPair, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken, verifySessionTokenWithJwks, type PublicSigningJwk } from "./session-tokens.js";

const issuer = "https://api.vulyo.com";
const audience = "instance_1";
let privateJwk: JWK;
let publicJwk: PublicSigningJwk;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateJwk = await exportJWK(pair.privateKey);
  publicJwk = { ...(await exportJWK(pair.publicKey)), alg: "RS256", kid: "key_current", use: "sig" };
});

function claims() {
  return {
    sub: "user_1",
    sid: "session_1",
    app_id: "app_1",
    app_instance_id: "instance_1",
    token_version: 1,
  };
}

describe("RS256 session tokens", () => {
  it("signs and verifies tenant-bound session claims", async () => {
    const token = await signSessionToken({ privateJwk, keyId: publicJwk.kid, issuer, audience, claims: claims() });
    await expect(
      verifySessionToken(token, { publicJwk, issuer, audience, appId: "app_1", appInstanceId: "instance_1" }),
    ).resolves.toMatchObject(claims());
    await expect(
      verifySessionToken(token, { publicJwk, issuer, audience, appId: "app_1", appInstanceId: "instance_1" }),
    ).resolves.toMatchObject({ jti: expect.any(String) });
  });

  it("rejects the wrong audience, app, and app instance", async () => {
    const token = await signSessionToken({ privateJwk, keyId: publicJwk.kid, issuer, audience, claims: claims() });
    await expect(verifySessionToken(token, { publicJwk, issuer, audience: "pk_test_other" })).rejects.toThrow();
    await expect(verifySessionToken(token, { publicJwk, issuer, audience, appId: "app_2" })).rejects.toThrow("different application");
    await expect(verifySessionToken(token, { publicJwk, issuer, audience, appInstanceId: "instance_2" })).rejects.toThrow("different application instance");
  });

  it("selects rotated public keys by kid and fails closed for unknown keys", async () => {
    const token = await signSessionToken({ privateJwk, keyId: publicJwk.kid, issuer, audience, claims: claims() });
    await expect(verifySessionTokenWithJwks(token, { keys: [publicJwk], issuer, audience })).resolves.toMatchObject({ sid: "session_1" });
    await expect(verifySessionTokenWithJwks(token, { keys: [], issuer, audience })).rejects.toThrow("signing key was not found");
  });

  it("rejects profile and entitlement fields embedded in access tokens", async () => {
    const token = await signSessionToken({
      privateJwk,
      keyId: publicJwk.kid,
      issuer,
      audience,
      claims: { ...claims(), email: "stale@example.com", features: ["admin"] } as Parameters<typeof signSessionToken>[0]["claims"],
    });
    await expect(verifySessionToken(token, { publicJwk, issuer, audience })).rejects.toThrow();
  });
});
