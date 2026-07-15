"use client";

import type { AppBrandingSettings, PublicAuthProviderState } from "@vulyo/core/app-settings";
import type { AuthMethodSettings } from "@vulyo/core/applications";
import { vulyoRoutes } from "@vulyo/core/routes";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { VulyoAppearance } from "./components/auth-appearance.js";

export type VulyoUser = { id: string; appId: string; appInstanceId?: string; email: string; emailVerified: boolean; displayName: string | null; imageUrl?: string | null };
export type VulyoLocalization = {
  acceptLegal: string; accountDeletionStarted: string; accountDetailsLoadPartial: string; accountMenu: string;
  accountProfile: string; accountSections: string; activeSessions: string;
  activeSessionsSubtitle: string; addYourName: string;
  acceptingInvitation: string; alreadyHaveAccess: string; alreadyHaveAccount: string; avatarHelp: string; avatarUpdated: string;
  authenticationFailed: string; browserSession: string; byContinuing: string; cancel: string; changePassword: string;
  changePasswordSubtitle: string; changingPassword: string; confirmIdentity: string; confirmIdentitySubtitle: string;
  chooseAvatar: string; chooseUsername: string; closeAccountProfile: string; conjunctionAnd: string; connect: string;
  connecting: string; continue: string;
  continueWithGithub: string; continueWithGoogle: string; continuing: string; createAccount: string;
  createInvitedAccountSubtitle: string; development: string; emailAddress: string; emailPlaceholder: string;
  emailOrPhone: string; emailOrPhonePlaceholder: string; emailOrUsername: string; emailOrUsernamePlaceholder: string;
  emailUsernameOrPhone: string; emailUsernameOrPhonePlaceholder: string;
  forgotPassword: string; github: string; google: string; hidePassword: string; invitationAccepted: string;
  invitationInvalid: string; legalAgreementPrefix: string; passwordMethod: string;
  currentPassword: string; deleteAccount: string; deleteAccountSubtitle: string; deleteConfirmation: string; deleting: string; disconnect: string;
  disconnected: string; disconnecting: string; displayName: string; emailPending: string; emailVerified: string; endSession: string; ended: string;
  joinWaitlist: string; joinWaitlistSubtitle: string; joiningWaitlist: string; manageAccountSubtitle: string; newPassword: string;
  noAccount: string; noActiveSessions: string; openAccountMenu: string; or: string; passwordHelp: string; passwordPlaceholder: string;
  password: string; passwordChanged: string; profile: string; profileSaved: string; resetPassword: string; saveProfile: string;
  saving: string; securedBy: string; security: string; showPassword: string; signIn: string; signInMethods: string;
  signInMethodsSubtitle: string; signInSubtitle: string; signInTitle: string; signingOut: string; signOut: string;
  signUpSubtitle: string; signUpTitle: string; terms: string; phoneNumber: string; phonePlaceholder: string;
  privacyPolicy: string; unableChangePassword: string; unableCompleteAction: string; unableConnectProvider: string;
  unableDeleteAccount: string; unableDisconnectProvider: string; unableEndSession: string; unableLoadAccount: string;
  unableReach: string; unableSignOut: string; unableUpdateAccount: string; unableUploadAvatar: string; username: string;
  verificationCode: string;
  verificationCodeInvalid: string; verificationFailed: string; verifyEmail: string; yourAccount: string;
  manageAccount: string; manageProfileSecurity: string; securityCheck: string; thisDevice: string; unableToJoinWaitlist: string;
  uploadAvatar: string; uploading: string; verified: string; verifying: string; waitlistDisabled: string; waitlistJoined: string;
  waitlistJoinedSubtitle: string;
  oauthFailed: string; sessionActive: string; sessionExpired: string; sessionExpires: string; sessionLastSeen: string; sessionRevoked: string;
  closeDeleteAccount: string;
};
export type VulyoEntitlements = { features: string[]; plan: string | null };
export type VulyoInitialState = {
  appConfig?: VulyoAppConfig | null;
  entitlements?: VulyoEntitlements | null;
  user?: VulyoUser | null;
};
export type VulyoProxyOperation =
  | "account" | "account/avatar" | "account/delete" | "account/oauth/github" | "account/oauth/google" | "account/password" | "account/providers" | "account/sessions" | "account/sessions/revoke" | "account/step-up" | "account/update" | "config"
  | "password-reset/confirm" | "password-reset/request" | "session" | "sign-in" | "sign-out"
  | "sign-up" | "transactions" | "verify-email" | "waitlist" | "waitlist/accept";

export type VulyoContextValue = {
  /** @internal Billing preview transport until the billing launch packet moves behind the adapter. */
  apiUrl: string;
  appConfig: VulyoAppConfig | null;
  appearance: VulyoAppearance | undefined;
  authUrl: string;
  entitlements: VulyoEntitlements | null;
  isConfigLoaded: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  localization: Partial<VulyoLocalization>;
  localize: (key: keyof VulyoLocalization, fallback: string, values?: Record<string, string>) => string;
  navigate: (to: string) => void;
  proxyUrl: string;
  publishableKey: string;
  refreshConfig: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateCurrentUser: (nextUser: VulyoUser) => void;
  request: (operation: VulyoProxyOperation, init?: RequestInit) => Promise<Response>;
  resolveAfterSignInUrl: (input?: { fallback?: string; force?: string }) => string;
  resolveAfterSignUpUrl: (input?: { fallback?: string; force?: string }) => string;
  user: VulyoUser | null;
  usesSameOriginProxy: boolean;
};

const VulyoContext = createContext<VulyoContextValue | null>(null);

export type VulyoAppConfig = {
  id: string; instanceId?: string; environment?: "development" | "production"; name: string; publishableKey: string;
  branding: AppBrandingSettings;
  authMethods: { signIn: AuthMethodSettings; signUp: AuthMethodSettings };
  authProviders: { google: PublicAuthProviderState; github: PublicAuthProviderState };
  account?: { allowDeletion: boolean; allowEmailChange: boolean };
  access?: { mode: "open" | "waitlist"; turnstileSiteKey?: string | null };
  legal?: { acceptanceRequired: boolean; privacyUrl: string | null; termsUrl: string | null; termsVersion: string | null };
};

export type VulyoProviderProps = {
  publishableKey: string;
  children: React.ReactNode;
  proxyUrl?: string;
  authUrl?: string;
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
  appearance?: VulyoAppearance;
  localization?: Partial<VulyoLocalization>;
  navigate?: (to: string) => void;
  initialState?: VulyoInitialState;
};

export function VulyoProvider({
  afterSignInUrl = "/", afterSignUpUrl = "/", appearance, authUrl = vulyoRoutes.external.authUrl,
  children, initialState, localization = {}, navigate, proxyUrl = "/api/vulyo", publishableKey,
}: VulyoProviderProps) {
  const normalizedProxyUrl = normalizeProxyUrl(proxyUrl);
  const sequence = useRef(0);
  const [isLoaded, setIsLoaded] = useState(initialState?.user !== undefined);
  const [isConfigLoaded, setIsConfigLoaded] = useState(initialState?.appConfig !== undefined);
  const [appConfig, setAppConfig] = useState<VulyoAppConfig | null>(initialState?.appConfig ?? null);
  const [entitlements, setEntitlements] = useState<VulyoEntitlements | null>(initialState?.entitlements ?? null);
  const [user, setUser] = useState<VulyoUser | null>(initialState?.user ?? null);

  const resolvedNavigate = useCallback((to: string) => {
    if (navigate) navigate(to);
    else if (typeof window !== "undefined") window.location.assign(to);
  }, [navigate]);

  const request = useCallback(async (operation: VulyoProxyOperation, init: RequestInit = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("x-vulyo-publishable-key", publishableKey);
    if (method !== "GET" && method !== "HEAD") {
      const csrf = readBrowserCookie("__vulyo_csrf");
      if (csrf) headers.set("x-csrf-token", csrf);
    }
    const directPlatform = /^https?:\/\//u.test(normalizedProxyUrl);
    const endpoint = directPlatform ? directPlatformPath(operation) : `${normalizedProxyUrl}/${operation}`;
    return fetch(directPlatform ? new URL(endpoint, `${normalizedProxyUrl}/`).toString() : endpoint, {
      ...init, method, headers, credentials: directPlatform ? "include" : "same-origin", cache: "no-store",
    });
  }, [normalizedProxyUrl, publishableKey]);

  const refreshConfig = useCallback(async () => {
    const response = await request("config");
    if (!response.ok) throw new Error("Unable to load Vulyo application configuration.");
    setAppConfig(((await response.json()) as { app: VulyoAppConfig }).app);
  }, [request]);

  const refreshSession = useCallback(async () => {
    const response = await request("session");
    if (!response.ok) { setUser(null); setEntitlements(null); return; }
    const payload = (await response.json()) as { entitlements?: VulyoEntitlements | null; user: VulyoUser | null };
    setUser(payload.user);
    setEntitlements(payload.entitlements ?? null);
  }, [request]);

  useEffect(() => {
    const current = ++sequence.current;
    const controller = new AbortController();
    setIsLoaded(initialState?.user !== undefined);
    setIsConfigLoaded(initialState?.appConfig !== undefined);
    const config = initialState?.appConfig !== undefined ? Promise.resolve() : request("config", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { app: VulyoAppConfig };
      if (sequence.current === current) setAppConfig(payload.app);
    });
    const session = initialState?.user !== undefined ? Promise.resolve() : request("session", { signal: controller.signal }).then(async (response) => {
      const payload = response.ok
        ? await response.json() as { entitlements?: VulyoEntitlements | null; user: VulyoUser | null }
        : { entitlements: null, user: null };
      if (sequence.current === current) {
        setUser(payload.user);
        setEntitlements(payload.entitlements ?? null);
      }
    });
    void Promise.allSettled([config, session]).then(() => {
      if (sequence.current === current) { setIsLoaded(true); setIsConfigLoaded(true); }
    });
    return () => { controller.abort(); };
  }, [initialState?.appConfig, initialState?.user, publishableKey, request]);

  const value = useMemo<VulyoContextValue>(() => ({
    apiUrl: vulyoRoutes.external.apiUrl, appConfig, appearance, authUrl, entitlements, isConfigLoaded, isLoaded, isSignedIn: Boolean(user), localization,
    localize: (key, fallback, values) => interpolate(localization[key] ?? fallback, values),
    navigate: resolvedNavigate, proxyUrl: normalizedProxyUrl, publishableKey, refreshConfig, refreshSession, request,
    resolveAfterSignInUrl: ({ fallback, force } = {}) => force ?? afterSignInUrl ?? fallback ?? "/",
    resolveAfterSignUpUrl: ({ fallback, force } = {}) => force ?? afterSignUpUrl ?? fallback ?? "/",
    updateCurrentUser: setUser, user, usesSameOriginProxy: !/^https?:\/\//u.test(normalizedProxyUrl),
  }), [appConfig, appearance, authUrl, entitlements, isConfigLoaded, isLoaded, localization, normalizedProxyUrl, publishableKey, refreshConfig, refreshSession, request, resolvedNavigate, user, afterSignInUrl, afterSignUpUrl]);
  return <VulyoContext.Provider value={value}>{children}</VulyoContext.Provider>;
}

export function useVulyo() {
  const context = useContext(VulyoContext);
  if (!context) throw new Error("Vulyo hooks must be used inside <VulyoProvider>.");
  return context;
}

function normalizeProxyUrl(value: string) {
  const normalized = value.replace(/\/+$/u, "");
  return normalized || "/api/vulyo";
}

function readBrowserCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const entry = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

function directPlatformPath(operation: VulyoProxyOperation) {
  const routes: Record<VulyoProxyOperation, string> = {
    account: vulyoRoutes.api.auth.account,
    "account/avatar": vulyoRoutes.api.auth.accountAvatar,
    "account/oauth/google": vulyoRoutes.api.auth.transactions,
    "account/oauth/github": vulyoRoutes.api.auth.transactions,
    "account/password": vulyoRoutes.api.auth.accountPassword,
    "account/providers": vulyoRoutes.api.auth.accountProviders,
    "account/delete": vulyoRoutes.api.auth.account,
    "account/sessions": vulyoRoutes.api.auth.accountSessions,
    "account/sessions/revoke": vulyoRoutes.api.auth.accountSessions,
    "account/step-up": vulyoRoutes.api.auth.accountStepUp,
    "account/update": vulyoRoutes.api.auth.account,
    config: vulyoRoutes.api.apps.config,
    "password-reset/confirm": vulyoRoutes.api.auth.passwordResetConfirm,
    "password-reset/request": vulyoRoutes.api.auth.passwordResetRequest,
    session: vulyoRoutes.api.auth.session,
    "sign-in": vulyoRoutes.api.auth.signIn,
    "sign-out": vulyoRoutes.api.auth.signOut,
    "sign-up": vulyoRoutes.api.auth.signUp,
    transactions: vulyoRoutes.api.auth.transactions,
    "verify-email": vulyoRoutes.api.auth.emailVerificationConfirm,
    waitlist: vulyoRoutes.api.waitlist.join,
    "waitlist/accept": vulyoRoutes.api.waitlist.acceptInvitation,
  };
  return routes[operation];
}

function interpolate(value: string, variables?: Record<string, string>) {
  if (!variables) return value;
  return Object.entries(variables).reduce((result, [key, replacement]) => result.replaceAll(`{{${key}}}`, replacement), value);
}
