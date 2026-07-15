import { describe, expect, it } from "vitest";
import {
  createAuthTransactionMaterial,
  createAuthorizationCode,
  createPkceChallenge,
  createRefreshToken,
  hashOpaqueToken,
  verifyPkceCodeVerifier,
} from "./protocol.js";

describe("public auth protocol primitives", () => {
  it("creates independent state, nonce, and S256 PKCE material", () => {
    const material = createAuthTransactionMaterial();
    expect(material.stateHash).toBe(hashOpaqueToken(material.state));
    expect(material.nonceHash).toBe(hashOpaqueToken(material.nonce));
    expect(material.pkceChallenge).toBe(createPkceChallenge(material.codeVerifier));
    expect(material.pkceMethod).toBe("S256");
    expect(material.state).not.toBe(material.nonce);
  });

  it("verifies the exact PKCE verifier and rejects malformed or wrong values", () => {
    const material = createAuthTransactionMaterial();
    expect(verifyPkceCodeVerifier(material.codeVerifier, material.pkceChallenge)).toBe(true);
    expect(verifyPkceCodeVerifier(`${material.codeVerifier}x`, material.pkceChallenge)).toBe(false);
    expect(verifyPkceCodeVerifier("short", material.pkceChallenge)).toBe(false);
  });

  it("stores only hashes for one-time authorization and refresh tokens", () => {
    const authorization = createAuthorizationCode();
    const refresh = createRefreshToken();
    expect(authorization.codeHash).toBe(hashOpaqueToken(authorization.code));
    expect(refresh.tokenHash).toBe(hashOpaqueToken(refresh.token));
    expect(authorization.codeHash).not.toContain(authorization.code);
    expect(refresh.tokenHash).not.toContain(refresh.token);
  });
});
