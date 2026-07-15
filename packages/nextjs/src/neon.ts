import { auth, type VulyoServerOptions } from "./server.js";

export async function getNeonAuthClaims(options?: VulyoServerOptions) {
  const session = await auth(options);
  if (!session.isAuthenticated || !session.claims) {
    throw new Error("Authentication required to create Neon auth claims.");
  }

  return {
    sub: session.claims.sub,
    app_id: session.claims.app_id,
    session_id: session.claims.sid,
    email: session.user.email,
    role: "authenticated",
    plan: session.entitlements.plan,
    features: session.entitlements.features,
  };
}
