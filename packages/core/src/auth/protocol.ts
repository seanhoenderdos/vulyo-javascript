import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const AUTH_TRANSACTION_TTL_SECONDS = 10 * 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 60;
export const REFRESH_TOKEN_IDLE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS = 90 * 24 * 60 * 60;

export function createAuthTransactionMaterial() {
  const state = randomOpaqueToken(32);
  const nonce = randomOpaqueToken(32);
  const codeVerifier = randomOpaqueToken(48);
  return {
    state,
    stateHash: hashOpaqueToken(state),
    nonce,
    nonceHash: hashOpaqueToken(nonce),
    codeVerifier,
    pkceChallenge: createPkceChallenge(codeVerifier),
    pkceMethod: "S256" as const,
  };
}

export function createAuthorizationCode() {
  const code = randomOpaqueToken(32);
  return { code, codeHash: hashOpaqueToken(code) };
}

export function createRefreshToken() {
  const token = randomOpaqueToken(48);
  return { token, tokenHash: hashOpaqueToken(token) };
}

export function createPkceChallenge(codeVerifier: string) {
  assertCodeVerifier(codeVerifier);
  return createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
}

export function verifyPkceCodeVerifier(codeVerifier: string, expectedChallenge: string) {
  try {
    return constantTimeEqual(createPkceChallenge(codeVerifier), expectedChallenge);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token: string) {
  if (!token) throw new Error("Opaque token cannot be empty.");
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function randomOpaqueToken(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

function assertCodeVerifier(value: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(value)) {
    throw new Error("PKCE code verifier must use RFC 7636 unreserved characters and be 43 to 128 characters long.");
  }
}
