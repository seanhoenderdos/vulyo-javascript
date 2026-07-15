import { VULYO_TRANSACTION_COOKIE } from "@vulyo/core";
import { vulyoRoutes } from "@vulyo/core/routes";
import { NextRequest, NextResponse } from "next/server";
import { authorizationHeaders } from "./validation.js";
import { resolveVulyoAdapterOptions, type VulyoAdapterOptions } from "./config.js";
import { clearSessionCookies, setSessionCookies } from "./route-handler.js";

type TransactionPurpose = "sign_in" | "sign_up" | "step_up" | "link_account";
type TransactionCookie = {
  codeVerifier: string;
  failureReturnTo?: string;
  publishableKey?: string;
  purpose: TransactionPurpose;
  redirectUri: string;
  returnTo: string;
  state: string;
};

export function createVulyoCallbackHandler(options: VulyoAdapterOptions = {}) {
  return async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const oauthError = request.nextUrl.searchParams.get("error");
    const transaction = readTransaction(request);
    if (!transaction) {
      return clearSessionCookies(NextResponse.redirect(new URL("/sign-in?error=invalid_request", request.url)));
    }
    if (!state || state !== transaction.state) {
      return callbackFailure(request, transaction, "invalid_request");
    }
    if (oauthError || !code) {
      return callbackFailure(request, transaction, normalizeOAuthError(oauthError));
    }
    const resolved = resolveVulyoAdapterOptions(options);
    const response = await resolved.fetcher(`${resolved.apiUrl}${vulyoRoutes.api.auth.token}`, {
      method: "POST",
      cache: "no-store",
      headers: authorizationHeaders(resolved.secretKey),
      body: JSON.stringify({ code, codeVerifier: transaction.codeVerifier, redirectUri: transaction.redirectUri }),
    });
    if (!response.ok) return callbackFailure(request, transaction, "invalid_grant");
    const tokens = (await response.json()) as Parameters<typeof setSessionCookies>[1];
    const destination = new URL(transaction.returnTo, request.nextUrl.origin);
    const result = NextResponse.redirect(destination);
    setSessionCookies(result, tokens);
    result.cookies.delete(VULYO_TRANSACTION_COOKIE);
    return result;
  };
}

function callbackFailure(request: NextRequest, transaction: TransactionCookie, error: string) {
  const preserveSession = transaction.purpose === "link_account" || transaction.purpose === "step_up";
  const destination = preserveSession
    ? new URL(transaction.returnTo, request.nextUrl.origin)
    : new URL(transaction.failureReturnTo ?? (transaction.purpose === "sign_up" ? "/sign-up" : "/sign-in"), request.nextUrl.origin);
  destination.searchParams.set("vulyo_oauth_error", error);
  const response = NextResponse.redirect(destination);
  response.cookies.delete(VULYO_TRANSACTION_COOKIE);
  return preserveSession ? response : clearSessionCookies(response);
}

function normalizeOAuthError(value: string | null) {
  return value === "waitlist_required" || value === "legal_acceptance_required" ? value : "oauth_failed";
}

function readTransaction(request: NextRequest): TransactionCookie | null {
  try {
    const value = request.cookies.get(VULYO_TRANSACTION_COOKIE)?.value;
    return value ? JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TransactionCookie : null;
  } catch {
    return null;
  }
}
