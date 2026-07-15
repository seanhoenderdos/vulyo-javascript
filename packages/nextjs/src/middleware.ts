import { VULYO_REFRESH_COOKIE, VULYO_SESSION_COOKIE } from "@vulyo/core";
import { vulyoRoutes } from "@vulyo/core/routes";
import type { NextRequest } from "next/server.js";
import { NextResponse } from "next/server.js";
import { type VulyoAdapterOptions } from "./config.js";
import { clearSessionCookies, setSessionCookies } from "./route-handler.js";
import { refreshVulyoSession, shouldRefreshVulyoSession, validateVulyoAccessToken } from "./validation.js";

export type VulyoMiddlewareOptions = VulyoAdapterOptions & {
  publicRoutes?: string[];
  signInUrl?: string;
};

export async function validateVulyoRequest(request: NextRequest, options: VulyoMiddlewareOptions = {}) {
  const accessToken = request.cookies.get(VULYO_SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(VULYO_REFRESH_COOKIE)?.value;
  let validated = accessToken ? await validateVulyoAccessToken(accessToken, options).catch(() => null) : null;
  let replacement: Awaited<ReturnType<typeof refreshVulyoSession>> = null;
  if (refreshToken && (!validated || shouldRefreshVulyoSession(validated.expiresAt))) {
    replacement = await refreshVulyoSession(refreshToken, options).catch(() => null);
    validated = replacement?.accessToken
      ? await validateVulyoAccessToken(replacement.accessToken, options).catch(() => null)
      : null;
  }
  return { session: validated, replacement };
}

export function vulyoMiddleware(options: VulyoMiddlewareOptions = {}) {
  const publicRoutes = options.publicRoutes ?? [vulyoRoutes.app.home, vulyoRoutes.app.signIn, vulyoRoutes.app.signUp];
  const signInUrl = options.signInUrl ?? vulyoRoutes.app.signIn;
  return async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    if (publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return NextResponse.next();

    const result = await validateVulyoRequest(request, options);
    if (!result.session) {
      const url = request.nextUrl.clone();
      url.pathname = signInUrl;
      url.searchParams.set(vulyoRoutes.searchParams.redirectUrl, `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return clearSessionCookies(NextResponse.redirect(url));
    }

    const requestHeaders = new Headers(request.headers);
    if (result.replacement) {
      requestHeaders.set("cookie", replaceCookieHeader(requestHeaders.get("cookie") ?? "", VULYO_SESSION_COOKIE, result.replacement.accessToken));
    }
    requestHeaders.set("x-vulyo-user-id", result.session.claims.sub);
    requestHeaders.set("x-vulyo-session-id", result.session.claims.sid);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (result.replacement) setSessionCookies(response, result.replacement);
    return response;
  };
}

function replaceCookieHeader(value: string, name: string, nextValue: string) {
  const cookies = value.split(";").map((entry) => entry.trim()).filter(Boolean);
  const filtered = cookies.filter((entry) => !entry.startsWith(`${name}=`));
  filtered.push(`${name}=${nextValue}`);
  return filtered.join("; ");
}
