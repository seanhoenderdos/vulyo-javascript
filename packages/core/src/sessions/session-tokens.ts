import { decodeProtectedHeader, importJWK, jwtVerify, SignJWT, type JWK } from "jose";
import { z } from "zod";
import type { SessionClaims } from "../types.js";

export const VULYO_ACCESS_TOKEN_ALGORITHM = "RS256" as const;
export const VULYO_ACCESS_TOKEN_TTL_SECONDS = 5 * 60;

const sessionClaimsSchema = z.object({
  iss: z.string().url(),
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  sub: z.string().min(1),
  sid: z.string().min(1),
  jti: z.string().min(1),
  app_id: z.string().min(1),
  app_instance_id: z.string().min(1),
  token_version: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
  nbf: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
}).strict();

export type SignSessionTokenInput = {
  privateJwk: JWK;
  keyId: string;
  issuer: string;
  audience: string;
  expiresInSeconds?: number;
  claims: Omit<SessionClaims, "iss" | "aud" | "jti" | "iat" | "nbf" | "exp"> & { jti?: string };
};

export type PublicSigningJwk = JWK & {
  kid: string;
  alg: typeof VULYO_ACCESS_TOKEN_ALGORITHM;
  use: "sig";
};

export async function signSessionToken(input: SignSessionTokenInput) {
  const key = await importJWK(input.privateJwk, VULYO_ACCESS_TOKEN_ALGORITHM);
  const { jti, ...claims } = input.claims;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: VULYO_ACCESS_TOKEN_ALGORITHM, typ: "JWT", kid: input.keyId })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setSubject(input.claims.sub)
    .setJti(jti ?? globalThis.crypto.randomUUID())
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime(`${input.expiresInSeconds ?? VULYO_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifySessionToken(
  token: string,
  options: {
    publicJwk: JWK;
    issuer: string;
    audience: string;
    appId?: string;
    appInstanceId?: string;
  },
) {
  const key = await importJWK(options.publicJwk, VULYO_ACCESS_TOKEN_ALGORITHM);
  const verified = await jwtVerify(token, key, {
    algorithms: [VULYO_ACCESS_TOKEN_ALGORITHM],
    issuer: options.issuer,
    audience: options.audience,
  });
  const claims = sessionClaimsSchema.parse(verified.payload) as SessionClaims;
  assertTenantClaims(claims, options);
  return claims;
}

export async function verifySessionTokenWithJwks(
  token: string,
  options: {
    keys: PublicSigningJwk[];
    issuer: string;
    audience: string;
    appId?: string;
    appInstanceId?: string;
  },
) {
  const header = decodeProtectedHeader(token);
  if (header.alg !== VULYO_ACCESS_TOKEN_ALGORITHM || !header.kid) {
    throw new Error("Vulyo access token has an unsupported signing header.");
  }
  const publicJwk = options.keys.find((key) => key.kid === header.kid && key.alg === VULYO_ACCESS_TOKEN_ALGORITHM && key.use === "sig");
  if (!publicJwk) throw new Error("Vulyo access token signing key was not found.");
  return verifySessionToken(token, { ...options, publicJwk });
}

function assertTenantClaims(
  claims: SessionClaims,
  expected: { appId?: string; appInstanceId?: string },
) {
  if (expected.appId && claims.app_id !== expected.appId) {
    throw new Error("Vulyo access token belongs to a different application.");
  }
  if (expected.appInstanceId && claims.app_instance_id !== expected.appInstanceId) {
    throw new Error("Vulyo access token belongs to a different application instance.");
  }
}
