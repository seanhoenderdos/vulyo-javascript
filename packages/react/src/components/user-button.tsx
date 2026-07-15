"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, CircleUserRound, LogOut, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useVulyo } from "../provider.js";
import { resolveAuthVariables, toAuthCssVariables, type VulyoAppearance } from "./auth-appearance.js";
import { VulyoAuthStatus } from "./auth-shell.js";
import { VulyoButton } from "./primitives.js";
import { UserProfile } from "./user-profile.js";

export type UserButtonProps = {
  appearance?: VulyoAppearance;
  afterSignOutUrl?: string;
  showName?: boolean;
  userProfileMode?: "modal" | "path";
  userProfileUrl?: string;
};

export function UserButton({ appearance, afterSignOutUrl = "/", showName = false, userProfileMode = "modal", userProfileUrl }: UserButtonProps) {
  const { appearance: providerAppearance, localize, navigate, refreshSession, request, user } = useVulyo();
  const mergedAppearance = useMemo(() => ({
    ...providerAppearance, ...appearance,
    variables: { ...providerAppearance?.variables, ...appearance?.variables },
    elements: { ...providerAppearance?.elements, ...appearance?.elements },
  }), [appearance, providerAppearance]);
  const variables = resolveAuthVariables(mergedAppearance);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (userProfileMode === "path" && !userProfileUrl) throw new Error("userProfileUrl is required when userProfileMode is path.");
  if (!user) return null;
  const initial = (user.displayName ?? user.email).trim().charAt(0).toUpperCase();

  async function signOut() {
    setError(null); setIsSigningOut(true);
    try {
      const response = await request("sign-out", { method: "POST" });
      if (!response.ok) throw new Error(localize("unableSignOut", "Unable to sign out right now."));
      await refreshSession();
      navigate(afterSignOutUrl);
    } catch (caught) { setError(caught instanceof Error ? caught.message : localize("unableSignOut", "Unable to sign out right now.")); }
    finally { setIsSigningOut(false); }
  }

  function manageAccount() {
    if (userProfileMode === "path") navigate(userProfileUrl!);
    else setIsProfileOpen(true);
  }

  return <div style={{ ...toAuthCssVariables(variables), display: "inline-block" }}>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <VulyoButton aria-label={localize("openAccountMenu", "Open account menu")} style={triggerStyle} type="button" variant="secondary">
          <span aria-hidden="true" style={avatarStyle}>{user.imageUrl ? <img alt="" src={user.imageUrl} style={{ borderRadius: "inherit", height: "100%", objectFit: "cover", width: "100%" }} /> : initial}</span>
          {showName ? <span style={nameStyle}>{user.displayName ?? user.email}</span> : null}
          <ChevronDown aria-hidden="true" size={15} strokeWidth={1.8} />
        </VulyoButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content aria-label={localize("accountMenu", "Account menu")} collisionPadding={8} sideOffset={8} style={{ ...menuStyle, ...toAuthCssVariables(variables) }}>
          <DropdownMenu.Label style={identityStyle}><strong style={nameStyle}>{user.displayName ?? localize("yourAccount", "Your account")}</strong><span style={emailStyle}>{user.email}</span></DropdownMenu.Label>
          <DropdownMenu.Item onSelect={manageAccount} style={menuItemStyle}><CircleUserRound size={16} />{localize("manageAccount", "Manage account")}</DropdownMenu.Item>
          <DropdownMenu.Item disabled={isSigningOut} onSelect={() => void signOut()} style={menuItemStyle}><LogOut size={16} />{isSigningOut ? localize("signingOut", "Signing out...") : localize("signOut", "Sign out")}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    {error ? <VulyoAuthStatus kind="error" style={{ fontSize: 12, marginTop: 6 }}>{error}</VulyoAuthStatus> : null}
    <Dialog.Root onOpenChange={setIsProfileOpen} open={isProfileOpen}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content aria-describedby="vulyo-account-dialog-description" style={{ ...dialogStyle, ...toAuthCssVariables(variables) }}>
          <Dialog.Title style={visuallyHidden}>{localize("accountProfile", "Account profile")}</Dialog.Title>
          <Dialog.Description id="vulyo-account-dialog-description" style={visuallyHidden}>{localize("manageProfileSecurity", "Manage your profile and security.")}</Dialog.Description>
          <Dialog.Close asChild><VulyoButton aria-label={localize("closeAccountProfile", "Close account profile")} style={closeStyle} type="button" variant="secondary"><X size={17} /></VulyoButton></Dialog.Close>
          <UserProfile appearance={mergedAppearance} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}

const triggerStyle: React.CSSProperties = { alignItems: "center", background: "var(--vulyo-card-background, #fff)", border: "1px solid var(--vulyo-border-color, #d7dee9)", borderRadius: 999, color: "var(--vulyo-text-color, #111827)", cursor: "pointer", display: "inline-flex", gap: 8, minHeight: 34, padding: "4px 8px 4px 4px" };
const avatarStyle: React.CSSProperties = { alignItems: "center", background: "var(--vulyo-primary-color, #16756f)", borderRadius: 999, color: "#fff", display: "inline-flex", fontSize: 12, fontWeight: 760, height: 26, justifyContent: "center", width: 26 };
const nameStyle: React.CSSProperties = { fontSize: 13, fontWeight: 650, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const menuStyle: React.CSSProperties = { background: "var(--vulyo-card-background, #fff)", border: "1px solid var(--vulyo-border-color, #d7dee9)", borderRadius: 8, boxShadow: "0 12px 28px rgba(15,23,42,.14)", display: "grid", gap: 4, minWidth: 228, padding: 6, zIndex: 110 };
const identityStyle: React.CSSProperties = { borderBottom: "1px solid var(--vulyo-border-color, #d7dee9)", display: "grid", gap: 2, padding: "8px 10px 10px" };
const emailStyle: React.CSSProperties = { color: "var(--vulyo-muted-color, #64748b)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const menuItemStyle: React.CSSProperties = { alignItems: "center", borderRadius: 6, color: "var(--vulyo-text-color, #111827)", cursor: "pointer", display: "flex", fontSize: 13, fontWeight: 620, gap: 8, outline: "none", padding: "8px 10px", userSelect: "none" };
const overlayStyle: React.CSSProperties = { background: "rgba(15,23,42,.45)", inset: 0, position: "fixed", zIndex: 100 };
const dialogStyle: React.CSSProperties = { left: "50%", maxHeight: "calc(100vh - 40px)", maxWidth: 620, overflow: "auto", position: "fixed", top: "50%", transform: "translate(-50%, -50%)", width: "calc(100% - 40px)", zIndex: 101 };
const closeStyle: React.CSSProperties = { alignItems: "center", background: "#fff", border: "1px solid #d7dee9", borderRadius: 6, cursor: "pointer", display: "inline-flex", height: 32, justifyContent: "center", position: "absolute", right: 12, top: 12, width: 32, zIndex: 2 };
const visuallyHidden: React.CSSProperties = { clip: "rect(0 0 0 0)", clipPath: "inset(50%)", height: 1, overflow: "hidden", position: "absolute", whiteSpace: "nowrap", width: 1 };
