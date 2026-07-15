import {
  VULYO_ACCESS_TOKEN_TTL_SECONDS,
  verifySessionTokenWithJwks,
  type PublicSigningJwk,
  type SessionClaims,
} from "@vulyo/core";
import { decodeJwt } from "jose";
import { vulyoRoutes } from "@vulyo/core/routes";
import { resolveVulyoAdapterOptions, type VulyoAdapterOptions, VulyoNetworkError } from "./config.js";

type JwksCacheEntry = { expiresAt: number; keys: PublicSigningJwk[] };
const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_CACHE_MS = 5 * 60 * 1000;

export type ValidatedVulyoSession = {
  accessToken: string;
  claims: SessionClaims;
  entitlements: { features: string[]; plan: string | null };
  expiresAt: number;
  user: {
    id: string;
    appId: string;
    appInstanceId: string;
    email: string;
    emailVerified: boolean;
    displayName: string | null;
    imageUrl?: string | null;
  };
};

export async function validateVulyoAccessToken(accessToken: string, options?: VulyoAdapterOptions): Promise<ValidatedVulyoSession | null> {
  const resolved = resolveVulyoAdapterOptions(options);
  try {
    const keys = await getSigningKeys(resolved.apiUrl, resolved.fetcher);
    const decoded = decodeJwt(accessToken);
    if (typeof decoded.app_instance_id !== "string") return null;
    const claims = await verifySessionTokenWithJwks(accessToken, {
      keys,
      issuer: resolved.apiUrl,
      audience: decoded.app_instance_id,
    });
    const introspection = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.introspect}`, {
      method: "POST",
      cache: "no-store",
      headers: authorizationHeaders(resolved.secretKey),
      body: JSON.stringify({ token: accessToken }),
    });
    if (!introspection.ok) return null;
    const authoritative = (await introspection.json()) as {
      active?: boolean;
      appId?: string;
      appInstanceId?: string;
      sid?: string;
      sub?: string;
      tokenVersion?: number;
      entitlements?: { features?: string[]; plan?: string | null };
      user?: ValidatedVulyoSession["user"];
    };
    if (
      !authoritative.active ||
      authoritative.appId !== claims.app_id ||
      authoritative.appInstanceId !== claims.app_instance_id ||
      authoritative.sid !== claims.sid ||
      authoritative.sub !== claims.sub ||
      authoritative.tokenVersion !== claims.token_version ||
      !authoritative.user ||
      !authoritative.entitlements ||
      !Array.isArray(authoritative.entitlements.features)
    ) return null;
    return {
      accessToken,
      claims,
      entitlements: {
        features: authoritative.entitlements.features,
        plan: authoritative.entitlements.plan ?? null,
      },
      expiresAt: decoded.exp ?? 0,
      user: authoritative.user,
    };
  } catch (error) {
    if (error instanceof VulyoNetworkError) throw error;
    return null;
  }
}

export async function refreshVulyoSession(refreshToken: string, options?: VulyoAdapterOptions) {
  const resolved = resolveVulyoAdapterOptions(options);
  const response = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.refresh}`, {
    method: "POST",
    cache: "no-store",
    headers: authorizationHeaders(resolved.secretKey),
    body: JSON.stringify({ refreshToken }),
  }).catch(() => { throw new VulyoNetworkError("Unable to reach the Vulyo session service."); });
  if (!response.ok) return null;
  return response.json() as Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    user: unknown;
  }>;
}

export function shouldRefreshVulyoSession(expiresAt: number, nowSeconds = Math.floor(Date.now() / 1000)) {
  return expiresAt - nowSeconds < 60;
}

export function authorizationHeaders(secretKey: string) {
  return {
    accept: "application/json",
    authorization: `Bearer ${secretKey}`,
    "content-type": "application/json",
  };
}

async function getSigningKeys(apiUrl: string, fetcher: typeof fetch) {
  const cached = jwksCache.get(apiUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetcher(`${apiUrl}${vulyoRoutes.api.protocol.jwks}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  }).catch(() => { throw new VulyoNetworkError("Unable to load Vulyo signing keys."); });
  if (!response.ok) throw new VulyoNetworkError("Unable to load Vulyo signing keys.");
  const payload = (await response.json()) as { keys?: PublicSigningJwk[] };
  const keys = payload.keys ?? [];
  jwksCache.set(apiUrl, { expiresAt: Date.now() + JWKS_CACHE_MS, keys });
  return keys;
}

export const VULYO_ACCESS_COOKIE_MAX_AGE = VULYO_ACCESS_TOKEN_TTL_SECONDS;
