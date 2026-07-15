export const vulyoRoutes = {
  app: {
    home: "/",
    signIn: "/sign-in",
    signUp: "/sign-up",
    waitlist: "/waitlist",
    verifyEmail: "/verify-email",
    resetPassword: "/reset-password",
  },
  api: {
    auth: {
      account: "/api/v1/account",
      accountAvatar: "/api/v1/account/avatar",
      accountPassword: "/api/v1/account/password",
      accountProviders: "/api/v1/account/providers",
      accountStepUp: "/api/v1/account/step-up",
      accountSessions: "/api/v1/account/sessions",
      emailVerificationConfirm: "/api/v1/auth/email-verification/confirm",
      introspect: "/api/v1/auth/introspect",
      passwordResetConfirm: "/api/v1/auth/password-reset/confirm",
      passwordResetRequest: "/api/v1/auth/password-reset/request",
      refresh: "/api/v1/auth/refresh",
      revoke: "/api/v1/auth/revoke",
      session: "/api/v1/auth/session",
      signIn: "/api/v1/auth/sign-in",
      signUp: "/api/v1/auth/sign-up",
      signOut: "/api/v1/auth/sign-out",
      token: "/api/v1/auth/token",
      transactions: "/api/v1/auth/transactions",
    },
    apps: { config: "/api/v1/apps/config" },
    oauth: {
      googleCallback: "/api/v1/oauth/google/callback",
      googleStart: "/api/v1/oauth/google/start",
      githubCallback: "/api/v1/oauth/github/callback",
      githubStart: "/api/v1/oauth/github/start",
    },
    protocol: {
      discovery: "/.well-known/openid-configuration",
      jwks: "/.well-known/jwks.json",
    },
    waitlist: {
      acceptInvitation: "/api/v1/waitlist/invitations/accept",
      join: "/api/v1/waitlist",
    },
  },
  external: {
    apiUrl: "https://api.vulyo.com",
    authUrl: "https://auth.vulyo.com",
  },
  searchParams: {
    authTransactionId: "auth_transaction_id",
    authTransactionState: "auth_transaction_state",
    email: "email",
    error: "error",
    publishableKey: "publishable_key",
    redirectUrl: "redirect_url",
    token: "token",
    waitlistToken: "waitlist_token",
  },
} as const;

export function buildUrl(baseUrl: string, path: string, searchParams?: Record<string, string | null | undefined>) {
  const url = new URL(path, baseUrl);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value != null) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
