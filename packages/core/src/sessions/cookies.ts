export const VULYO_SESSION_COOKIE = "__vulyo_session";
export const VULYO_REFRESH_COOKIE = "__vulyo_refresh";
export const VULYO_CSRF_COOKIE = "__vulyo_csrf";
export const VULYO_TRANSACTION_COOKIE = "__vulyo_transaction";

export function buildSessionCookie(token: string, maxAgeSeconds: number, secure: boolean) {
  const parts = [
    `${VULYO_SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
