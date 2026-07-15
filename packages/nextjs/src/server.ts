import { VULYO_SESSION_COOKIE } from "@vulyo/core";
import { cookies } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { cache } from "react";
import { vulyoRoutes } from "@vulyo/core/routes";
import { type VulyoAdapterOptions } from "./config.js";
import { validateVulyoAccessToken } from "./validation.js";

export type VulyoServerOptions = VulyoAdapterOptions;

const validateCurrentRequest = cache(async (token: string, options: VulyoServerOptions | undefined) =>
  validateVulyoAccessToken(token, options),
);

export async function auth(options?: VulyoServerOptions) {
  const token = (await cookies()).get(VULYO_SESSION_COOKIE)?.value;
  if (!token) return unauthenticated();
  const validated = await validateCurrentRequest(token, options).catch(() => null);
  if (!validated) return unauthenticated();
  return {
    isAuthenticated: true as const,
    userId: validated.claims.sub,
    sessionId: validated.claims.sid,
    claims: validated.claims,
    entitlements: validated.entitlements,
    user: validated.user,
  };
}

export async function currentUser(options?: VulyoServerOptions) {
  const session = await auth(options);
  if (!session.isAuthenticated) return null;
  return session.user;
}

export async function requireAuth(options?: VulyoServerOptions & { signInUrl?: string }) {
  const session = await auth(options);
  if (!session.isAuthenticated) redirect(options?.signInUrl ?? vulyoRoutes.app.signIn);
  return session;
}

export async function hasFeature(featureKey: string, options?: VulyoServerOptions) {
  const session = await auth(options);
  return Boolean(session.isAuthenticated && session.entitlements.features.includes(featureKey));
}

function unauthenticated() {
  return { isAuthenticated: false as const, userId: null, sessionId: null, claims: null, entitlements: null, user: null };
}
