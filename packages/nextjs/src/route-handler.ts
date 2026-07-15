import {
  VULYO_CSRF_COOKIE,
  VULYO_REFRESH_COOKIE,
  VULYO_SESSION_COOKIE,
  VULYO_TRANSACTION_COOKIE,
  createAuthTransactionMaterial,
} from "@vulyo/core";
import { vulyoRoutes } from "@vulyo/core/routes";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";
import { authorizationHeaders, refreshVulyoSession, validateVulyoAccessToken, VULYO_ACCESS_COOKIE_MAX_AGE } from "./validation.js";
import { resolveVulyoAdapterOptions, type VulyoAdapterOptions } from "./config.js";

const proxyEndpoints = {
  config: { method: "GET", platformPath: vulyoRoutes.api.apps.config, auth: "public" },
  session: { method: "GET", platformPath: null, auth: "session" },
  transactions: { method: "POST", platformPath: vulyoRoutes.api.auth.transactions, auth: "transaction" },
  "sign-in": { method: "POST", platformPath: vulyoRoutes.api.auth.signIn, auth: "exchange" },
  "sign-up": { method: "POST", platformPath: vulyoRoutes.api.auth.signUp, auth: "public" },
  "verify-email": { method: "POST", platformPath: vulyoRoutes.api.auth.emailVerificationConfirm, auth: "public" },
  "password-reset/request": { method: "POST", platformPath: vulyoRoutes.api.auth.passwordResetRequest, auth: "public" },
  "password-reset/confirm": { method: "POST", platformPath: vulyoRoutes.api.auth.passwordResetConfirm, auth: "public" },
  account: { method: "GET", platformPath: vulyoRoutes.api.auth.account, auth: "session" },
  "account/avatar": { method: "POST", platformPath: vulyoRoutes.api.auth.accountAvatar, auth: "session" },
  "account/oauth/google": { method: "POST", platformPath: null, auth: "session" },
  "account/oauth/github": { method: "POST", platformPath: null, auth: "session" },
  "account/password": { method: "POST", platformPath: vulyoRoutes.api.auth.accountPassword, auth: "session" },
  "account/providers": { method: "DELETE", platformPath: vulyoRoutes.api.auth.accountProviders, auth: "session" },
  "account/delete": { method: "DELETE", platformPath: vulyoRoutes.api.auth.account, auth: "session" },
  "account/update": { method: "PATCH", platformPath: vulyoRoutes.api.auth.account, auth: "session" },
  "account/sessions": { method: "GET", platformPath: vulyoRoutes.api.auth.accountSessions, auth: "session" },
  "account/sessions/revoke": { method: "DELETE", platformPath: vulyoRoutes.api.auth.accountSessions, auth: "session" },
  "account/step-up": { method: "POST", platformPath: vulyoRoutes.api.auth.accountStepUp, auth: "session" },
  "sign-out": { method: "POST", platformPath: vulyoRoutes.api.auth.revoke, auth: "signout" },
  waitlist: { method: "POST", platformPath: vulyoRoutes.api.waitlist.join, auth: "public" },
  "waitlist/accept": { method: "POST", platformPath: vulyoRoutes.api.waitlist.acceptInvitation, auth: "public" },
} as const;

type ProxyEndpoint = keyof typeof proxyEndpoints;
type TransactionCookie = {
  codeVerifier: string;
  expiresAt: string;
  failureReturnTo: string;
  publishableKey: string;
  purpose: "sign_in" | "sign_up" | "step_up" | "link_account";
  redirectUri: string;
  returnTo: string;
  state: string;
  transactionId: string;
};

export type VulyoRouteHandlerOptions = VulyoAdapterOptions & { proxyPath?: string };

export function createVulyoRouteHandlers(options: VulyoRouteHandlerOptions = {}) {
  const handler = (request: NextRequest) => handleVulyoProxyRequest(request, options);
  return { GET: handler, POST: handler, PATCH: handler, DELETE: handler };
}

export async function handleVulyoProxyRequest(request: NextRequest, options: VulyoRouteHandlerOptions = {}) {
  const proxyPath = normalizeProxyPath(options.proxyPath ?? "/api/vulyo");
  const relativePath = request.nextUrl.pathname.slice(proxyPath.length).replace(/^\/+|\/+$/gu, "");
  if (request.method === "GET" && (relativePath === "oauth/google" || relativePath === "oauth/github")) {
    return startOAuth(request, options, proxyPath, relativePath === "oauth/google" ? "google" : "github");
  }
  const endpoint = getEndpoint(request.nextUrl.pathname, proxyPath);
  if (!endpoint) return errorResponse("invalid_request", "Unsupported Vulyo proxy operation.", 404);
  const definition = proxyEndpoints[endpoint];
  if (request.method !== definition.method) return errorResponse("invalid_request", "Method not allowed.", 405);

  const resolved = resolveVulyoAdapterOptions(options);
  if (request.method !== "GET") {
    const csrfError = validateMutationBoundary(request);
    if (csrfError) return csrfError;
  }

  if (endpoint === "config") {
    const response = await platformFetch(request, resolved, definition.platformPath!, { method: "GET" });
    ensureCsrfCookie(request, response);
    return response;
  }
  if (endpoint === "transactions") return createTransaction(request, resolved, proxyPath);
  if (endpoint === "sign-in") return exchangePasswordSignIn(request, resolved);
  if (endpoint === "sign-up") return beginPasswordSignUp(request, resolved);
  if (endpoint === "verify-email") return exchangeEmailVerification(request, resolved);
  if (endpoint === "password-reset/request") return beginPasswordReset(request, resolved);
  if (endpoint === "password-reset/confirm") return exchangePasswordReset(request, resolved);
  if (endpoint === "session") return sessionResponse(request, resolved);
  if (endpoint === "sign-out") return signOut(request, resolved);

  const accessToken = request.cookies.get(VULYO_SESSION_COOKIE)?.value;
  if (definition.auth === "session") {
    if (!accessToken || !(await validateVulyoAccessToken(accessToken, resolved))) {
      return clearSessionCookies(errorResponse("unauthenticated", "Sign in to continue.", 401));
    }
  }
  if (endpoint === "account/oauth/google" || endpoint === "account/oauth/github") {
    return prepareOAuthLink(request, resolved, proxyPath, endpoint === "account/oauth/google" ? "google" : "github", accessToken!);
  }
  const platformPath = definition.platformPath;
  if (!platformPath) return errorResponse("invalid_request", "Unsupported Vulyo proxy operation.", 400);
  const path = endpoint === "account/sessions/revoke"
    ? `${platformPath}?session_id=${encodeURIComponent(request.nextUrl.searchParams.get("session_id") ?? request.headers.get("x-vulyo-session-id") ?? "")}`
    : platformPath;
  const proxied = await platformFetch(request, resolved, path, {
    method: request.method,
    ...(definition.auth === "session" && accessToken ? { accessToken } : {}),
  });
  if (endpoint !== "account/password" || !proxied.ok) return proxied;
  const payload = await proxied.json() as { accessToken?: string; expiresIn?: number; user?: unknown };
  if (!payload.accessToken) return errorResponse("invalid_grant", "Password changed, but the session could not be rotated.", 500);
  const response = NextResponse.json({ ok: true, user: payload.user });
  response.cookies.set(VULYO_SESSION_COOKIE, payload.accessToken, cookieOptions(true, payload.expiresIn || VULYO_ACCESS_COOKIE_MAX_AGE));
  return response;
}

async function createTransaction(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>, proxyPath: string) {
  const input = await readJson(request);
  return createTransactionForRequest(request, resolved, proxyPath, {
    provider: input.provider === "google" || input.provider === "github" ? input.provider : "password",
    purpose: input.purpose === "sign_up" ? "sign_up" : input.purpose === "link_account" ? "link_account" : input.purpose === "step_up" ? "step_up" : "sign_in",
    returnTo: safeLocalPath(input.redirectUrl, "/"),
  });
}

async function createTransactionForRequest(
  request: NextRequest,
  resolved: ReturnType<typeof resolveVulyoAdapterOptions>,
  proxyPath: string,
  input: { provider: "password" | "google" | "github"; purpose: "sign_in" | "sign_up" | "step_up" | "link_account"; returnTo: string; failureReturnTo?: string; accessToken?: string; legalTermsVersion?: string },
) {
  const material = createAuthTransactionMaterial();
  const callbackUrl = `${request.nextUrl.origin}${proxyPath}/callback`;
  const response = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.transactions}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
      ...(input.accessToken ? { authorization: `Bearer ${input.accessToken}` } : {}),
    },
    body: JSON.stringify({
      purpose: input.purpose,
      provider: input.provider,
      redirectUri: callbackUrl,
      codeChallenge: material.pkceChallenge,
      codeChallengeMethod: "S256",
      legalAcceptance: input.legalTermsVersion ? { accepted: true, termsVersion: input.legalTermsVersion } : undefined,
    }),
  });
  const payloadPromise = response.ok
    ? response.clone().json() as Promise<{ transactionId: string; state: string; expiresAt: string }>
    : null;
  const result = await clonePlatformResponse(response);
  if (!response.ok) return result;
  const payload = await payloadPromise!;
  setTransactionCookie(result, {
    codeVerifier: material.codeVerifier,
    expiresAt: payload.expiresAt,
    failureReturnTo: input.failureReturnTo ?? input.returnTo,
    publishableKey: resolved.publishableKey,
    purpose: input.purpose,
    redirectUri: callbackUrl,
    returnTo: input.returnTo,
    state: payload.state,
    transactionId: payload.transactionId,
  });
  return result;
}

async function prepareOAuthLink(
  request: NextRequest,
  resolved: ReturnType<typeof resolveVulyoAdapterOptions>,
  proxyPath: string,
  provider: "google" | "github",
  accessToken: string,
) {
  const input = await readJson(request);
  const purpose = input.purpose === "step_up" ? "step_up" : "link_account";
  const created = await createTransactionForRequest(request, resolved, proxyPath, {
    provider,
    purpose,
    returnTo: safeLocalPath(input.redirectUrl, "/"),
    accessToken,
  });
  if (!created.ok) return created;
  const transaction = readTransactionFromResponse(created);
  if (!transaction) return errorResponse("invalid_request", "Unable to start account linking.", 400);
  const platformPath = provider === "google" ? vulyoRoutes.api.oauth.googleStart : vulyoRoutes.api.oauth.githubStart;
  const location = new URL(`${resolved.authUrl}${platformPath}`);
  location.searchParams.set(vulyoRoutes.searchParams.publishableKey, resolved.publishableKey);
  location.searchParams.set(vulyoRoutes.searchParams.redirectUrl, transaction.redirectUri);
  location.searchParams.set("auth_transaction_id", transaction.transactionId);
  location.searchParams.set("auth_transaction_state", transaction.state);
  const response = NextResponse.json({ url: location.toString() });
  const cookie = created.cookies.get(VULYO_TRANSACTION_COOKIE);
  if (cookie) response.cookies.set(cookie);
  return response;
}

async function startOAuth(
  request: NextRequest,
  options: VulyoRouteHandlerOptions,
  proxyPath: string,
  provider: "google" | "github",
) {
  const resolved = resolveVulyoAdapterOptions(options);
  const purpose = request.nextUrl.searchParams.get("purpose") === "sign_up" ? "sign_up" : "sign_in";
  const legalTermsVersion = request.nextUrl.searchParams.get("legal_terms_version")?.trim() || undefined;
  const created = await createTransactionForRequest(request, resolved, proxyPath, {
    provider,
    purpose,
    returnTo: safeLocalPath(request.nextUrl.searchParams.get("redirect_url"), "/"),
    failureReturnTo: safeLocalPath(request.nextUrl.searchParams.get("failure_url"), purpose === "sign_up" ? "/sign-up" : "/sign-in"),
    ...(legalTermsVersion ? { legalTermsVersion } : {}),
  });
  if (!created.ok) return created;
  const transaction = readTransactionFromResponse(created);
  if (!transaction) return errorResponse("invalid_request", "Unable to start social authentication.", 400);
  const platformPath = provider === "google" ? vulyoRoutes.api.oauth.googleStart : vulyoRoutes.api.oauth.githubStart;
  const location = new URL(`${resolved.authUrl}${platformPath}`);
  location.searchParams.set(vulyoRoutes.searchParams.publishableKey, resolved.publishableKey);
  location.searchParams.set(vulyoRoutes.searchParams.redirectUrl, transaction.redirectUri);
  location.searchParams.set("auth_transaction_id", transaction.transactionId);
  location.searchParams.set("auth_transaction_state", transaction.state);
  const redirect = NextResponse.redirect(location);
  const cookie = created.cookies.get(VULYO_TRANSACTION_COOKIE);
  if (cookie) redirect.cookies.set(cookie);
  return redirect;
}

async function exchangePasswordSignIn(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  const transaction = readTransactionCookie(request);
  if (!transaction || new Date(transaction.expiresAt) <= new Date()) {
    return errorResponse("invalid_request", "Start a new sign-in attempt.", 400);
  }
  const input = await readJson(request);
  const signIn = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.signIn}`, {
    method: "POST",
    cache: "no-store",
    headers: publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
    body: JSON.stringify({ ...input, authTransactionId: transaction.transactionId, state: transaction.state }),
  });
  if (!signIn.ok) return clonePlatformResponse(signIn);
  const signInPayload = (await signIn.json()) as { authorizationCode?: string };
  if (!signInPayload.authorizationCode) return errorResponse("invalid_grant", "Authentication could not be completed.", 400);
  return exchangeGrant(resolved, transaction, signInPayload.authorizationCode);
}

async function beginPasswordSignUp(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  const transaction = readTransactionCookie(request);
  if (!transaction || transaction.purpose !== "sign_up" || new Date(transaction.expiresAt) <= new Date()) {
    return errorResponse("invalid_request", "Start a new sign-up attempt.", 400);
  }
  const input = await readJson(request);
  const signUp = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.signUp}`, {
    method: "POST",
    cache: "no-store",
    headers: publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
    body: JSON.stringify({
      ...input,
      authTransactionId: transaction.transactionId,
      redirectUrl: transaction.redirectUri,
      state: transaction.state,
    }),
  });
  return clonePlatformResponse(signUp);
}

async function beginPasswordReset(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  const transaction = readPasswordTransaction(request);
  if (!transaction) return errorResponse("invalid_request", "Start a new password reset attempt.", 400);
  const input = await readJson(request);
  const reset = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.passwordResetRequest}`, {
    method: "POST",
    cache: "no-store",
    headers: publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
    body: JSON.stringify({
      ...input,
      authTransactionId: transaction.transactionId,
      redirectUrl: transaction.redirectUri,
      state: transaction.state,
    }),
  });
  return clonePlatformResponse(reset);
}

async function exchangePasswordReset(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  const transaction = readPasswordTransaction(request);
  if (!transaction) return errorResponse("invalid_request", "Start a new password reset attempt.", 400);
  const input = await readJson(request);
  const reset = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.passwordResetConfirm}`, {
    method: "POST",
    cache: "no-store",
    headers: publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
    body: JSON.stringify({
      ...input,
      authTransactionId: transaction.transactionId,
      redirectUrl: transaction.redirectUri,
      state: transaction.state,
    }),
  });
  if (!reset.ok) return clonePlatformResponse(reset);
  const payload = (await reset.json()) as { authorizationCode?: string };
  if (!payload.authorizationCode) return errorResponse("invalid_grant", "Password reset could not be completed.", 400);
  return exchangeGrant(resolved, transaction, payload.authorizationCode);
}

function readPasswordTransaction(request: NextRequest) {
  const transaction = readTransactionCookie(request);
  return transaction
    && transaction.purpose === "sign_in"
    && new Date(transaction.expiresAt) > new Date()
    ? transaction
    : null;
}

async function exchangeEmailVerification(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  const transaction = readTransactionCookie(request);
  if (!transaction || new Date(transaction.expiresAt) <= new Date()) return errorResponse("invalid_request", "Start a new sign-up attempt.", 400);
  const input = await readJson(request);
  const verification = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.emailVerificationConfirm}`, {
    method: "POST", cache: "no-store", headers: publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
    body: JSON.stringify({ ...input, redirectUrl: transaction.redirectUri, authTransactionId: transaction.transactionId, state: transaction.state }),
  });
  if (!verification.ok) return clonePlatformResponse(verification);
  const payload = (await verification.json()) as { authorizationCode?: string };
  if (!payload.authorizationCode) return errorResponse("invalid_grant", "Email verification could not be completed.", 400);
  return exchangeGrant(resolved, transaction, payload.authorizationCode);
}

async function exchangeGrant(resolved: ReturnType<typeof resolveVulyoAdapterOptions>, transaction: TransactionCookie, authorizationCode: string) {
  const tokenResponse = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.token}`, {
    method: "POST",
    cache: "no-store",
    headers: authorizationHeaders(resolved.secretKey),
    body: JSON.stringify({
      code: authorizationCode,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
    }),
  });
  if (!tokenResponse.ok) return clonePlatformResponse(tokenResponse);
  const tokens = (await tokenResponse.json()) as TokenPayload;
  const response = NextResponse.json({ user: tokens.user, redirectUrl: transaction.returnTo });
  setSessionCookies(response, tokens);
  response.cookies.delete(VULYO_TRANSACTION_COOKIE);
  return response;
}

async function sessionResponse(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  let accessToken = request.cookies.get(VULYO_SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(VULYO_REFRESH_COOKIE)?.value;
  let validated = accessToken ? await validateVulyoAccessToken(accessToken, resolved) : null;
  let tokens: TokenPayload | null = null;
  if (!validated && refreshToken) {
    tokens = await refreshVulyoSession(refreshToken, resolved) as TokenPayload | null;
    accessToken = tokens?.accessToken;
    validated = accessToken ? await validateVulyoAccessToken(accessToken, resolved) : null;
  }
  if (!validated) {
    const response = clearSessionCookies(NextResponse.json({ entitlements: null, user: null }));
    ensureCsrfCookie(request, response);
    return response;
  }
  const response = NextResponse.json({ entitlements: validated.entitlements, user: validated.user });
  if (tokens) setSessionCookies(response, tokens);
  ensureCsrfCookie(request, response);
  return response;
}

async function signOut(request: NextRequest, resolved: ReturnType<typeof resolveVulyoAdapterOptions>) {
  const refreshToken = request.cookies.get(VULYO_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.revoke}`, {
      method: "POST",
      cache: "no-store",
      headers: authorizationHeaders(resolved.secretKey),
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }
  return clearSessionCookies(NextResponse.json({ ok: true }));
}

async function platformFetch(
  request: NextRequest,
  resolved: ReturnType<typeof resolveVulyoAdapterOptions>,
  path: string,
  input: { method: string; accessToken?: string },
) {
  const body = input.method === "GET" ? undefined : await request.arrayBuffer();
  const contentType = request.headers.get("content-type") ?? "application/json";
  const response = await resolved.fetcher(`${resolved.apiUrl}${path}`, {
    method: input.method,
    cache: "no-store",
    headers: {
      ...publicPlatformHeaders(resolved.publishableKey, request.nextUrl.origin, request),
      "content-type": contentType,
      ...(input.accessToken ? { authorization: `Bearer ${input.accessToken}` } : {}),
    },
    ...(body?.byteLength ? { body } : {}),
  });
  return clonePlatformResponse(response);
}

function validateMutationBoundary(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) return errorResponse("forbidden", "Request origin is not allowed.", 403);
  const csrfCookie = request.cookies.get(VULYO_CSRF_COOKIE)?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) return errorResponse("forbidden", "CSRF validation failed.", 403);
  return null;
}

function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.get(VULYO_CSRF_COOKIE)?.value) return;
  response.cookies.set(VULYO_CSRF_COOKIE, randomBytes(32).toString("base64url"), cookieOptions(false, 24 * 60 * 60));
}

function setTransactionCookie(response: NextResponse, value: TransactionCookie) {
  response.cookies.set(VULYO_TRANSACTION_COOKIE, Buffer.from(JSON.stringify(value)).toString("base64url"), cookieOptions(true, 10 * 60));
}

function readTransactionCookie(request: NextRequest): TransactionCookie | null {
  try {
    const value = request.cookies.get(VULYO_TRANSACTION_COOKIE)?.value;
    return value ? JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TransactionCookie : null;
  } catch {
    return null;
  }
}

function readTransactionFromResponse(response: NextResponse): TransactionCookie | null {
  try {
    const value = response.cookies.get(VULYO_TRANSACTION_COOKIE)?.value;
    return value ? JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TransactionCookie : null;
  } catch {
    return null;
  }
}

type TokenPayload = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: unknown;
};

export function setSessionCookies(response: NextResponse, tokens: TokenPayload) {
  response.cookies.set(VULYO_SESSION_COOKIE, tokens.accessToken, cookieOptions(true, tokens.expiresIn || VULYO_ACCESS_COOKIE_MAX_AGE));
  const refreshMaxAge = Math.max(0, Math.floor((new Date(tokens.refreshTokenExpiresAt).getTime() - Date.now()) / 1000));
  response.cookies.set(VULYO_REFRESH_COOKIE, tokens.refreshToken, cookieOptions(true, refreshMaxAge));
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [VULYO_SESSION_COOKIE, VULYO_REFRESH_COOKIE, VULYO_TRANSACTION_COOKIE]) response.cookies.delete(name);
  return response;
}

function cookieOptions(httpOnly: boolean, maxAge: number) {
  return { httpOnly, maxAge, path: "/", sameSite: "lax" as const, secure: true };
}

function publicPlatformHeaders(publishableKey: string, origin: string, request: Request) {
  const userAgent = request.headers.get("user-agent")?.trim();
  return {
    accept: "application/json",
    "content-type": "application/json",
    origin,
    ...(userAgent ? { "user-agent": userAgent } : {}),
    "x-vulyo-publishable-key": publishableKey,
  };
}

async function clonePlatformResponse(response: Response) {
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { "cache-control": "private, no-store", "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

function getEndpoint(pathname: string, proxyPath: string): ProxyEndpoint | null {
  const value = pathname.slice(proxyPath.length).replace(/^\/+|\/+$/gu, "") || "config";
  return value in proxyEndpoints ? value as ProxyEndpoint : null;
}

function normalizeProxyPath(value: string) {
  const normalized = `/${value.replace(/^\/+|\/+$/gu, "")}`;
  return normalized === "/" ? "/api/vulyo" : normalized;
}

function safeLocalPath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001f\\]/u.test(value)) return fallback;
  return value;
}

async function readJson(request: NextRequest) {
  return request.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "private, no-store" } });
}
