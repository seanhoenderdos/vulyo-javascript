"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { vulyoRoutes } from "@vulyo/core/routes";
import { CheckCircle2, KeyRound, MonitorSmartphone, Trash2, Upload, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useVulyo } from "../provider.js";
import { resolveAuthVariables, toAuthCssVariables, type VulyoAppearance } from "./auth-appearance.js";
import { VulyoButton, VulyoCard, VulyoField, VulyoInput, VulyoStack } from "./primitives.js";
import { VulyoAuthStatus, VulyoTrustFooter } from "./auth-shell.js";

type SessionSummary = { id: string; deviceLabel?: string | null; expiresAt: string; lastSeenAt?: string | null; status: "active" | "revoked" | "expired"; userAgentSummary?: string | null };
type ConnectedProvider = { provider: "google" | "github"; email: string | null; emailVerified: boolean };
type AuthErrorPayload = { error?: string | { code?: string; message?: string } } | null;
type SensitiveAction = "delete_account" | "disconnect_github" | "disconnect_google";
type PendingSensitiveAction = { action: SensitiveAction; run: () => Promise<void> };

const stepUpCompleteParam = "vulyo_step_up";
const oauthFailureParam = "vulyo_oauth_error";

export type UserProfileProps = {
  appearance?: VulyoAppearance;
  initialPage?: "profile" | "security";
  afterDeleteUrl?: string;
};

export function UserProfile({ afterDeleteUrl = "/", appearance, initialPage = "profile" }: UserProfileProps) {
  const { appConfig, appearance: providerAppearance, localize, navigate, request, updateCurrentUser, user } = useVulyo();
  const mergedAppearance = useMemo(() => ({
    ...providerAppearance, ...appearance,
    variables: { ...providerAppearance?.variables, ...appearance?.variables },
    elements: { ...providerAppearance?.elements, ...appearance?.elements },
  }), [appearance, providerAppearance]);
  const variables = resolveAuthVariables(mergedAppearance);
  const [page, setPage] = useState(initialPage);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [providerAction, setProviderAction] = useState<"google" | "github" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSteppingUp, setIsSteppingUp] = useState(false);
  const pendingSensitiveActionRef = useRef<PendingSensitiveAction | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDisplayName(user?.displayName ?? ""), [user?.displayName]);
  useEffect(() => setPage(initialPage), [initialPage]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.all([request("account"), request("account/sessions")]).then(async ([accountResponse, sessionResponse]) => {
      if (!active) return;
      if (accountResponse.ok) {
        const account = await accountResponse.json() as { hasPassword?: boolean; providers?: ConnectedProvider[]; user?: typeof user };
        setHasPassword(Boolean(account.hasPassword)); setProviders(account.providers ?? []);
        if (account.user) updateCurrentUser(account.user);
      }
      if (sessionResponse.ok) {
        const payload = await sessionResponse.json() as { activeSessionId: string; sessions: SessionSummary[] };
        setActiveSessionId(payload.activeSessionId); setSessions(payload.sessions);
      }
      if (!accountResponse.ok || !sessionResponse.ok) setError(localize("accountDetailsLoadPartial", "Some account details could not be loaded."));
    }).catch(() => { if (active) setError(localize("unableLoadAccount", "Unable to load your account details.")); });
    return () => { active = false; };
  }, [request, updateCurrentUser, user?.appInstanceId, user?.id]);
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const storageKey = getStepUpStorageKey(user.appInstanceId ?? user.appId, user.id);
    if (url.searchParams.has(oauthFailureParam)) {
      window.sessionStorage.removeItem(storageKey);
      url.searchParams.delete(oauthFailureParam);
      url.searchParams.delete(stepUpCompleteParam);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      setError(localize("oauthFailed", "Social authentication could not be completed. No account changes were made."));
      return;
    }
    if (url.searchParams.get(stepUpCompleteParam) !== "complete") return;
    const action = parseSensitiveAction(window.sessionStorage.getItem(storageKey));
    window.sessionStorage.removeItem(storageKey);
    url.searchParams.delete(stepUpCompleteParam);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (!action) return;
    void resumeSensitiveAction(action).catch((caught) => {
      setError(caught instanceof Error ? caught.message : localize("unableCompleteAction", "Unable to complete the requested action."));
    });
  }, [user?.appId, user?.appInstanceId, user?.id]);

  if (!user) return null;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null); setIsSaving(true);
    try {
      const response = await request("account/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: displayName.trim() || null }) });
      const payload = await response.json().catch(() => null) as AuthErrorPayload;
      if (!response.ok) throw new Error(readError(payload, localize("unableUpdateAccount", "Unable to update your account.")));
      setMessage(localize("profileSaved", "Profile saved."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableUpdateAccount", "Unable to update your account.")); } finally { setIsSaving(false); }
  }

  async function revokeSession(sessionId: string) {
    setError(null);
    const response = await request("account/sessions/revoke", { method: "DELETE", headers: { "x-vulyo-session-id": sessionId } });
    if (!response.ok) { setError(localize("unableEndSession", "Unable to end that session.")); return; }
    setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, status: "revoked" } : session));
    if (sessionId === activeSessionId) navigate("/");
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(null); setMessage(null); setIsUploadingAvatar(true);
    try {
      const form = new FormData(); form.set("avatar", file);
      const response = await request("account/avatar", { method: "POST", body: form });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string }; user?: typeof user } | null;
      if (!response.ok || !payload?.user) throw new Error(readError(payload, localize("unableUploadAvatar", "Unable to upload your avatar.")));
      updateCurrentUser(payload.user);
      setMessage(localize("avatarUpdated", "Avatar updated."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableUploadAvatar", "Unable to upload your avatar.")); }
    finally { setIsUploadingAvatar(false); }
  }

  async function connectProvider(provider: "google" | "github") {
    setError(null); setMessage(null); setProviderAction(provider);
    try {
      const redirectUrl = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
      const response = await request(`account/oauth/${provider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirectUrl }) });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string }; url?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(readError(payload, localize("unableConnectProvider", "Unable to connect {{provider}}.", { provider })));
      navigate(payload.url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableConnectProvider", "Unable to connect {{provider}}.", { provider })); setProviderAction(null); }
  }

  async function disconnectProvider(provider: "google" | "github") {
    setError(null); setMessage(null); setProviderAction(provider);
    try {
      const response = await request("account/providers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      const payload = await response.json().catch(() => null) as AuthErrorPayload;
      if (!response.ok) {
        if (readErrorCode(payload) === "forbidden") {
          pendingSensitiveActionRef.current = {
            action: provider === "google" ? "disconnect_google" : "disconnect_github",
            run: () => disconnectProvider(provider),
          };
          setNeedsStepUp(true);
          return;
        }
        throw new Error(readError(payload, localize("unableDisconnectProvider", "Unable to disconnect {{provider}}.", { provider })));
      }
      setProviders((current) => current.filter((item) => item.provider !== provider));
      setMessage(`${localize(provider, provider === "github" ? "GitHub" : "Google")} ${localize("disconnected", "disconnected")}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableDisconnectProvider", "Unable to disconnect {{provider}}.", { provider })); }
    finally { setProviderAction(null); }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null); setIsDeleting(true);
    try {
      const response = await request("account/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string } } | null;
      if (!response.ok) {
        if (readErrorCode(payload) === "forbidden") {
          pendingSensitiveActionRef.current = { action: "delete_account", run: performAccountDeletion };
          setNeedsStepUp(true);
          return;
        }
        throw new Error(readError(payload, localize("unableDeleteAccount", "Unable to delete your account.")));
      }
      setMessage(localize("accountDeletionStarted", "Account deletion has started."));
      setIsDeleteDialogOpen(false);
      navigate(afterDeleteUrl);
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableDeleteAccount", "Unable to delete your account.")); } finally { setIsDeleting(false); }
  }

  async function performAccountDeletion() {
    const response = await request("account/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
    const payload = await response.json().catch(() => null) as { error?: string | { code?: string; message?: string } } | null;
    if (!response.ok) throw new Error(readError(payload, localize("unableDeleteAccount", "Unable to delete your account.")));
    setMessage(localize("accountDeletionStarted", "Account deletion has started."));
    setIsDeleteDialogOpen(false);
    navigate(afterDeleteUrl);
  }

  async function submitStepUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setIsSteppingUp(true);
    try {
      const response = await request("account/step-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: stepUpPassword }) });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string } } | null;
      if (!response.ok) throw new Error(readError(payload, localize("verificationFailed", "Password verification failed.")));
      const pendingAction = pendingSensitiveActionRef.current;
      pendingSensitiveActionRef.current = null;
      setNeedsStepUp(false); setStepUpPassword("");
      if (pendingAction) await pendingAction.run();
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("verificationFailed", "Password verification failed.")); }
    finally { setIsSteppingUp(false); }
  }

  async function beginOAuthStepUp(provider: "google" | "github") {
    const pending = pendingSensitiveActionRef.current;
    const currentUser = user;
    if (!pending || !currentUser || typeof window === "undefined") return;
    setError(null); setProviderAction(provider); setIsSteppingUp(true);
    const storageKey = getStepUpStorageKey(currentUser.appInstanceId ?? currentUser.appId, currentUser.id);
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set(stepUpCompleteParam, "complete");
      const redirectUrl = `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
      window.sessionStorage.setItem(storageKey, pending.action);
      const response = await request(`account/oauth/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "step_up", redirectUrl }),
      });
      const payload = await response.json().catch(() => null) as AuthErrorPayload & { url?: string };
      if (!response.ok || !payload?.url) throw new Error(readError(payload, localize("verificationFailed", "Unable to verify with {{provider}}.", { provider })));
      navigate(payload.url);
    } catch (caught) {
      window.sessionStorage.removeItem(storageKey);
      setError(caught instanceof Error ? caught.message : localize("verificationFailed", "Unable to verify with {{provider}}.", { provider }));
      setProviderAction(null); setIsSteppingUp(false);
    }
  }

  async function resumeSensitiveAction(action: SensitiveAction) {
    if (action === "delete_account") return performAccountDeletion();
    return disconnectProvider(action === "disconnect_google" ? "google" : "github");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null); setIsChangingPassword(true);
    try {
      const response = await request("account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string }; user?: typeof user } | null;
      if (!response.ok) throw new Error(readError(payload, localize("unableChangePassword", "Unable to change your password.")));
      if (payload?.user) updateCurrentUser(payload.user);
      setCurrentPassword(""); setNewPassword(""); setMessage(localize("passwordChanged", "Password changed. Other sessions were signed out."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableChangePassword", "Unable to change your password.")); }
    finally { setIsChangingPassword(false); }
  }

  return <VulyoCard style={{ ...toAuthCssVariables(variables), marginInline: "auto", maxWidth: 620, width: "100%" }}>
    <VulyoStack gap="lg">
      <header style={{ display: "grid", gap: 5 }}><h2 style={{ fontSize: 20, margin: 0 }}>{localize("manageAccount", "Manage account")}</h2><p style={{ color: variables.colorMuted, fontSize: 13, margin: 0 }}>{localize("manageAccountSubtitle", "Manage your profile and account security.")}</p></header>
      <div aria-label={localize("accountSections", "Account sections")} role="tablist" style={{ borderBottom: `1px solid ${variables.colorBorder}`, display: "flex", gap: 6 }}>
        {(["profile", "security"] as const).map((item) => <VulyoButton aria-controls={`vulyo-${item}-panel`} aria-selected={page === item} id={`vulyo-${item}-tab`} key={item} onClick={() => setPage(item)} role="tab" type="button" variant="ghost" style={{ borderBottom: page === item ? `2px solid ${variables.colorPrimary}` : "2px solid transparent", borderRadius: 0 }}>{item === "profile" ? localize("profile", "Profile") : localize("security", "Security")}</VulyoButton>)}
      </div>
      {error ? <VulyoAuthStatus kind="error">{error}</VulyoAuthStatus> : null}
      {message ? <VulyoAuthStatus kind="success">{message}</VulyoAuthStatus> : null}
      {needsStepUp ? <form onSubmit={submitStepUp} style={{ border: `1px solid ${variables.colorBorder}`, borderRadius: 8, display: "grid", gap: 10, padding: 14 }}>
        <div><h3 style={{ fontSize: 15, margin: 0 }}>{localize("confirmIdentity", "Confirm it is you")}</h3><p style={{ color: variables.colorMuted, fontSize: 13, margin: "4px 0 0" }}>{localize("confirmIdentitySubtitle", "Enter your password to continue this security-sensitive action.")}</p></div>
        {hasPassword ? <><VulyoField>{localize("currentPassword", "Current password")}<VulyoInput autoComplete="current-password" onChange={(event) => setStepUpPassword(event.target.value)} type="password" value={stepUpPassword} /></VulyoField><VulyoButton disabled={!stepUpPassword || isSteppingUp} type="submit">{isSteppingUp ? localize("verifying", "Verifying...") : localize("continue", "Continue")}</VulyoButton></> : null}
        {providers.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{providers.map(({ provider }) => <VulyoButton disabled={isSteppingUp} key={provider} onClick={() => void beginOAuthStepUp(provider)} type="button" variant="secondary">{providerAction === provider ? localize("verifying", "Verifying...") : localize(provider === "github" ? "continueWithGithub" : "continueWithGoogle", `Continue with ${provider === "github" ? "GitHub" : "Google"}`)}</VulyoButton>)}</div> : null}
        <VulyoButton onClick={() => { pendingSensitiveActionRef.current = null; setNeedsStepUp(false); setStepUpPassword(""); }} type="button" variant="ghost">{localize("cancel", "Cancel")}</VulyoButton>
      </form> : null}

      {page === "profile" ? <section aria-labelledby="vulyo-profile-tab" id="vulyo-profile-panel" role="tabpanel">
        <form onSubmit={saveProfile} style={{ display: "grid", gap: 12 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
            <span aria-hidden="true" style={{ alignItems: "center", background: variables.colorPrimary, borderRadius: 999, color: variables.colorPrimaryText, display: "inline-flex", flex: "0 0 auto", fontSize: 18, fontWeight: 760, height: 52, justifyContent: "center", overflow: "hidden", width: 52 }}>
              {user.imageUrl ? <img alt="" src={user.imageUrl} style={{ height: "100%", objectFit: "cover", width: "100%" }} /> : (user.displayName ?? user.email).charAt(0).toUpperCase()}
            </span>
            <div style={{ display: "grid", gap: 4 }}>
              <VulyoButton disabled={isUploadingAvatar} onClick={() => avatarInputRef.current?.click()} type="button" variant="secondary"><Upload size={15} />{isUploadingAvatar ? localize("uploading", "Uploading...") : localize("uploadAvatar", "Upload avatar")}</VulyoButton>
              <span style={{ color: variables.colorMuted, fontSize: 12 }}>{localize("avatarHelp", "JPEG, PNG, or WebP up to 5 MB.")}</span>
              <input accept="image/jpeg,image/png,image/webp" aria-label={localize("chooseAvatar", "Choose avatar image")} hidden onChange={(event) => void uploadAvatar(event)} ref={avatarInputRef} type="file" />
            </div>
          </div>
          <VulyoField>{localize("displayName", "Display name")}<VulyoInput autoComplete="name" maxLength={120} onChange={(event) => setDisplayName(event.target.value)} placeholder={localize("addYourName", "Add your name")} value={displayName} /></VulyoField>
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}><CheckCircle2 color={variables.colorPrimary} size={17} /><span style={{ fontSize: 13 }}>{user.emailVerified ? localize("emailVerified", "Email verified") : localize("emailPending", "Email verification pending")}</span></div>
          <VulyoButton disabled={isSaving || displayName === (user.displayName ?? "")} type="submit">{isSaving ? localize("saving", "Saving...") : localize("saveProfile", "Save profile")}</VulyoButton>
        </form>
      </section> : <section aria-labelledby="vulyo-security-tab" id="vulyo-security-panel" role="tabpanel" style={{ display: "grid", gap: 20 }}>
        <section style={{ display: "grid", gap: 10 }}><div><h3 style={{ fontSize: 15, margin: 0 }}>{localize("signInMethods", "Sign-in methods")}</h3><p style={{ color: variables.colorMuted, fontSize: 13, margin: "4px 0 0" }}>{localize("signInMethodsSubtitle", "Methods connected to this account.")}</p></div>
          {hasPassword ? <p style={{ fontSize: 13, margin: 0 }}><KeyRound size={15} style={{ verticalAlign: "middle" }} /> {localize("passwordMethod", "Password")}</p> : null}
          {(["google", "github"] as const).map((providerName) => {
            const connected = providers.find((item) => item.provider === providerName);
            const readiness = appConfig?.authProviders[providerName];
            if (!connected && (!readiness?.enabled || !readiness.configured)) return null;
            return <div key={providerName} style={{ alignItems: "center", border: `1px solid ${variables.colorBorder}`, borderRadius: 8, display: "flex", gap: 10, justifyContent: "space-between", padding: 10 }}>
              <span style={{ fontSize: 13 }}><strong>{localize(providerName, providerName === "github" ? "GitHub" : "Google")}</strong>{connected?.email ? ` (${connected.email})` : ""}{connected?.emailVerified ? ` - ${localize("verified", "verified")}` : ""}</span>
              {connected
                ? <VulyoButton disabled={providerAction !== null} onClick={() => void disconnectProvider(providerName)} type="button" variant="ghost">{providerAction === providerName ? localize("disconnecting", "Disconnecting...") : localize("disconnect", "Disconnect")}</VulyoButton>
                : <VulyoButton disabled={providerAction !== null} onClick={() => void connectProvider(providerName)} type="button" variant="secondary">{providerAction === providerName ? localize("connecting", "Connecting...") : localize("connect", "Connect")}</VulyoButton>}
            </div>;
          })}
          <a href={vulyoRoutes.app.resetPassword} style={{ color: variables.colorPrimary, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>{localize("resetPassword", "Reset password")}</a>
        </section>
        {hasPassword ? <section style={{ borderTop: `1px solid ${variables.colorBorder}`, display: "grid", gap: 12, paddingTop: 18 }}><div><h3 style={{ fontSize: 15, margin: 0 }}>{localize("changePassword", "Change password")}</h3><p style={{ color: variables.colorMuted, fontSize: 13, margin: "4px 0 0" }}>{localize("changePasswordSubtitle", "Changing your password signs out every other device.")}</p></div><form onSubmit={changePassword} style={{ display: "grid", gap: 10 }}><VulyoField>{localize("currentPassword", "Current password")}<VulyoInput autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} type="password" value={currentPassword} /></VulyoField><VulyoField>{localize("newPassword", "New password")}<VulyoInput autoComplete="new-password" minLength={8} onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} /></VulyoField><VulyoButton disabled={!currentPassword || newPassword.length < 8 || isChangingPassword} type="submit">{isChangingPassword ? localize("changingPassword", "Changing...") : localize("changePassword", "Change password")}</VulyoButton></form></section> : null}
        <section style={{ borderTop: `1px solid ${variables.colorBorder}`, display: "grid", gap: 12, paddingTop: 18 }}><div><h3 style={{ fontSize: 15, margin: 0 }}>{localize("activeSessions", "Active sessions")}</h3><p style={{ color: variables.colorMuted, fontSize: 13, margin: "4px 0 0" }}>{localize("activeSessionsSubtitle", "End a session you no longer recognize.")}</p></div>
          {sessions.length === 0 ? <p style={{ color: variables.colorMuted, fontSize: 13, margin: 0 }}>{localize("noActiveSessions", "No active sessions found.")}</p> : sessions.map((session) => {
            const isCurrent = session.id === activeSessionId;
            const statusLabel = session.status === "active"
              ? localize("sessionActive", "Active")
              : session.status === "revoked" ? localize("sessionRevoked", "Revoked") : localize("sessionExpired", "Expired");
            return <div key={session.id} style={{ alignItems: "start", border: `1px solid ${variables.colorBorder}`, borderRadius: 8, display: "flex", gap: 12, justifyContent: "space-between", padding: 12 }}>
              <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                <span style={{ alignItems: "center", display: "inline-flex", fontSize: 13, fontWeight: 700, gap: 8 }}><MonitorSmartphone size={16} />{session.deviceLabel ?? session.userAgentSummary ?? localize("browserSession", "Browser session")}{isCurrent ? ` (${localize("thisDevice", "This device")})` : ""}</span>
                <span style={{ color: variables.colorMuted, fontSize: 12 }}>{statusLabel}</span>
                {session.lastSeenAt ? <span style={{ color: variables.colorMuted, fontSize: 12 }}>{localize("sessionLastSeen", "Last seen {{date}}", { date: formatSessionDate(session.lastSeenAt) })}</span> : null}
                <span style={{ color: variables.colorMuted, fontSize: 12 }}>{localize("sessionExpires", "Expires {{date}}", { date: formatSessionDate(session.expiresAt) })}</span>
              </div>
              {session.status === "active" ? <VulyoButton onClick={() => void revokeSession(session.id)} type="button" variant="ghost">{localize("endSession", "End session")}</VulyoButton> : null}
            </div>;
          })}
        </section>
        {appConfig?.account?.allowDeletion ? <section style={{ border: `1px solid ${variables.colorDanger}`, borderRadius: 8, display: "grid", gap: 10, padding: 14 }}><div><h3 style={{ color: variables.colorDanger, fontSize: 15, margin: 0 }}>{localize("deleteAccount", "Delete account")}</h3><p style={{ color: variables.colorMuted, fontSize: 13, margin: "4px 0 0" }}>{localize("deleteAccountSubtitle", "This permanently removes your account after the deletion job completes.")}</p></div><VulyoButton onClick={() => setIsDeleteDialogOpen(true)} type="button" variant="danger"><Trash2 size={15} />{localize("deleteAccount", "Delete account")}</VulyoButton></section> : null}
      </section>}
      <VulyoTrustFooter>{localize("securedBy", "Secured by Vulyo")}</VulyoTrustFooter>
    </VulyoStack>
    <Dialog.Root onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setConfirmation(""); }} open={isDeleteDialogOpen}>
      <Dialog.Portal>
        <Dialog.Overlay style={dialogOverlayStyle} />
        <Dialog.Content aria-describedby="vulyo-delete-account-description" style={{ ...deleteDialogStyle, ...toAuthCssVariables(variables) }}>
          <Dialog.Title style={{ color: variables.colorDanger, fontSize: 18, fontWeight: 760, margin: 0 }}>{localize("deleteAccount", "Delete account")}</Dialog.Title>
          <Dialog.Description id="vulyo-delete-account-description" style={{ color: variables.colorMuted, fontSize: 13, lineHeight: 1.55, margin: 0 }}>{localize("deleteAccountSubtitle", "This permanently removes your account after the deletion job completes. Type DELETE to confirm.")}</Dialog.Description>
          <Dialog.Close asChild><VulyoButton aria-label={localize("closeDeleteAccount", "Close delete account dialog")} style={dialogCloseStyle} type="button" variant="secondary"><X size={17} /></VulyoButton></Dialog.Close>
          <form onSubmit={deleteAccount} style={{ display: "grid", gap: 12 }}>
            <VulyoField>{localize("deleteConfirmation", "Type DELETE to confirm")}<VulyoInput autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} placeholder="DELETE" value={confirmation} /></VulyoField>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><Dialog.Close asChild><VulyoButton type="button" variant="secondary">{localize("cancel", "Cancel")}</VulyoButton></Dialog.Close><VulyoButton disabled={confirmation !== "DELETE" || isDeleting} type="submit" variant="danger"><Trash2 size={15} />{isDeleting ? localize("deleting", "Deleting...") : localize("deleteAccount", "Delete account")}</VulyoButton></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </VulyoCard>;
}

function readError(payload: AuthErrorPayload, fallback: string) {
  return typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? fallback;
}

function readErrorCode(payload: AuthErrorPayload) {
  return typeof payload?.error === "object" ? payload.error.code : null;
}

function getStepUpStorageKey(appInstanceId: string, userId: string) {
  return `vulyo:step-up:${appInstanceId}:${userId}`;
}

function parseSensitiveAction(value: string | null): SensitiveAction | null {
  return value === "delete_account" || value === "disconnect_github" || value === "disconnect_google" ? value : null;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const dialogOverlayStyle: React.CSSProperties = { background: "rgba(15,23,42,.45)", inset: 0, position: "fixed", zIndex: 120 };
const deleteDialogStyle: React.CSSProperties = { background: "var(--vulyo-card-background, #fff)", border: "1px solid var(--vulyo-border-color, #d7dee9)", borderRadius: 8, boxShadow: "0 20px 48px rgba(15,23,42,.2)", display: "grid", gap: 16, left: "50%", maxWidth: 440, padding: 20, position: "fixed", top: "50%", transform: "translate(-50%, -50%)", width: "calc(100% - 32px)", zIndex: 121 };
const dialogCloseStyle: React.CSSProperties = { height: 32, padding: 0, position: "absolute", right: 12, top: 12, width: 32 };
