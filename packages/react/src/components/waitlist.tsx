"use client";

import { waitlistJoinSchema } from "@vulyo/core/waitlist";
import { vulyoRoutes } from "@vulyo/core/routes";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useVulyo } from "../provider.js";
import { resolveAuthVariables, toAuthCssVariables, type VulyoAppearance } from "./auth-appearance.js";
import { AuthTextField } from "./auth-text-field.js";
import {
  VulyoAuthBrand,
  VulyoAuthHeader,
  VulyoAuthStatus,
  VulyoDevelopmentBadge,
  VulyoTrustFooter,
} from "./auth-shell.js";
import { VulyoButton, VulyoCard, VulyoStack } from "./primitives.js";

export type WaitlistProps = {
  appearance?: VulyoAppearance;
  signInUrl?: string;
  signUpUrl?: string;
};

export function Waitlist({ appearance, signInUrl = vulyoRoutes.app.signIn, signUpUrl = vulyoRoutes.app.signUp }: WaitlistProps) {
  const { appConfig, appearance: providerAppearance, localize, request } = useVulyo();
  const id = useId();
  const applicationName = appConfig?.branding.applicationName ?? "Vulyo";
  const logoUrl = appConfig?.branding.logoUrl ?? null;
  const logoAltText = appConfig?.branding.logoAltText ?? undefined;
  const developmentMode = appConfig?.environment === "development";
  const source = "component" as const;
  const waitlistEnabled = appConfig?.access?.mode === "waitlist";
  const mergedAppearance = useMemo(() => {
    const inherited = {
      ...providerAppearance,
      ...appearance,
      elements: { ...providerAppearance?.elements, ...appearance?.elements },
      variables: { ...providerAppearance?.variables, ...appearance?.variables },
    };
    const primaryColor = appConfig?.branding.primaryColor;
    return primaryColor
      ? { ...inherited, variables: { colorFocus: primaryColor, colorPrimary: primaryColor, ...inherited.variables } }
      : inherited;
  }, [appConfig?.branding.primaryColor, appearance, providerAppearance]);
  const variables = useMemo(() => resolveAuthVariables(mergedAppearance), [mergedAppearance]);
  const elements = mergedAppearance.elements ?? {};
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [invitationState, setInvitationState] = useState<"idle" | "accepting" | "accepted" | "invalid">("idle");
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (!waitlistEnabled || typeof window === "undefined") return;
    const token = new URL(window.location.href).searchParams.get(vulyoRoutes.searchParams.waitlistToken);
    if (!token) return;
    let active = true;
    setInvitationState("accepting");
    void request("waitlist/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then((response) => {
      if (active) setInvitationState(response.ok ? "accepted" : "invalid");
    }).catch(() => {
      if (active) setInvitationState("invalid");
    });
    return () => { active = false; };
  }, [request, waitlistEnabled]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(undefined);
    setFormError(null);
    const parsed = waitlistJoinSchema.safeParse({ email, source });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? localize("emailPlaceholder", "Enter a valid email address."));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await request("waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, ...(turnstileToken ? { turnstileToken } : {}) }),
      });
      const payload = await response.json().catch(() => null) as { error?: string | { code?: string; message?: string } } | null;
      if (!response.ok) {
        if (typeof payload?.error === "object" && payload.error.code === "turnstile_required") setTurnstileRequired(true);
        setTurnstileToken(null);
        throw new Error(typeof payload?.error === "string"
          ? payload.error
          : payload?.error?.message ?? localize("unableToJoinWaitlist", "Unable to join the waitlist."));
      }
      setIsComplete(true);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : localize("unableToJoinWaitlist", "Unable to join the waitlist."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = invitationState === "accepted"
    ? localize("invitationAccepted", "Invitation accepted")
    : isComplete
      ? localize("waitlistJoined", "You're on the waitlist")
      : localize("joinWaitlist", "Join the waitlist");
  const subtitle = invitationState === "accepted"
    ? localize("createInvitedAccountSubtitle", "Create your account with the invited email address.")
    : isComplete
      ? localize("waitlistJoinedSubtitle", "We'll let you know when your spot is ready.")
      : localize("joinWaitlistSubtitle", "Enter your email address and we'll let you know when access is ready.");

  if (appConfig && !waitlistEnabled) {
    return <VulyoAuthStatus>{localize("waitlistDisabled", "Waitlist access is not enabled for this application.")}</VulyoAuthStatus>;
  }

  return <div style={{
    ...toAuthCssVariables(variables),
    background: variables.colorBackground,
    boxSizing: "border-box",
    color: variables.colorText,
    fontFamily: variables.fontFamily,
    width: "100%",
    ...elements.root,
  }}>
    <VulyoCard style={{ boxSizing: "border-box", marginInline: "auto", maxWidth: 402, overflow: "hidden", padding: 0, width: "100%", ...elements.card }}>
      <VulyoStack gap={0}>
        <div style={{ display: "grid", gap: 18, padding: "28px 38px 26px", ...elements.body }}>
          <VulyoAuthBrand applicationName={applicationName} logoAltText={logoAltText} logoUrl={logoUrl} markStyle={elements.brandMark} style={elements.brand} />
          {developmentMode ? <VulyoDevelopmentBadge style={elements.developmentBadge}>{localize("development", "Development")}</VulyoDevelopmentBadge> : null}
          <VulyoAuthHeader subtitle={subtitle} subtitleStyle={elements.subtitle} title={title} titleStyle={elements.title} style={elements.header} />
          {invitationState === "accepting" ? <VulyoAuthStatus>{localize("acceptingInvitation", "Accepting your invitation...")}</VulyoAuthStatus> : null}
          {invitationState === "invalid" ? <VulyoAuthStatus kind="error">{localize("invitationInvalid", "This invitation is invalid or expired.")}</VulyoAuthStatus> : null}
          {formError ? <VulyoAuthStatus kind="error">{formError}</VulyoAuthStatus> : null}
          {!isComplete && invitationState !== "accepted" ? <form noValidate onSubmit={submit} style={{ display: "grid", gap: 14, ...elements.form }}>
            <AuthTextField
              autoComplete="email"
              error={emailError}
              errorId={`${id}-email-error`}
              id={`${id}-email`}
              label={localize("emailAddress", "Email address")}
              onValueChange={setEmail}
              placeholder={localize("emailPlaceholder", "you@example.com")}
              type="email"
              value={email}
            />
            {turnstileRequired && appConfig?.access?.turnstileSiteKey
              ? <Turnstile ariaLabel={localize("securityCheck", "Security check")} onToken={setTurnstileToken} siteKey={appConfig.access.turnstileSiteKey} />
              : null}
            <VulyoButton disabled={isSubmitting || (turnstileRequired && !turnstileToken)} fullWidth type="submit">
              {isSubmitting ? localize("joiningWaitlist", "Joining...") : localize("joinWaitlist", "Join the waitlist")}
            </VulyoButton>
          </form> : null}
          {invitationState === "accepted" ? <a href={signUpUrl} style={{ color: variables.colorPrimary, fontWeight: 700, textAlign: "center", ...elements.link }}>{localize("createAccount", "Create account")}</a> : null}
        </div>
        <div style={{ borderTop: `1px solid ${variables.colorBorder}`, color: variables.colorMuted, fontSize: 13, padding: "16px 24px", textAlign: "center", ...elements.footer }}>
          {localize("alreadyHaveAccess", "Already have access?")} <a href={signInUrl} style={{ color: variables.colorPrimary, fontWeight: 700, textDecoration: "none", ...elements.link }}>{localize("signIn", "Sign in")}</a>
        </div>
        <VulyoTrustFooter style={{ borderTop: `1px solid ${variables.colorBorder}`, padding: "15px 24px", ...elements.securityFooter }}>
          {localize("securedBy", "Secured by Vulyo")}
        </VulyoTrustFooter>
      </VulyoStack>
    </VulyoCard>
  </div>;
}

type TurnstileWindow = Window & {
  turnstile?: {
    render: (element: HTMLElement, options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }) => string;
    remove: (id: string) => void;
  };
};

function Turnstile({ ariaLabel, onToken, siteKey }: { ariaLabel: string; onToken: (token: string | null) => void; siteKey: string }) {
  const elementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widgetId: string | null = null;
    let active = true;
    const render = () => {
      const api = (window as TurnstileWindow).turnstile;
      if (!active || !api || !elementRef.current || widgetId) return;
      widgetId = api.render(elementRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-vulyo-turnstile="true"]');
    if (existing) {
      if ((window as TurnstileWindow).turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.vulyoTurnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.append(script);
    }
    return () => {
      active = false;
      if (widgetId) (window as TurnstileWindow).turnstile?.remove(widgetId);
      onToken(null);
    };
  }, [onToken, siteKey]);
  return <div aria-label={ariaLabel} ref={elementRef} />;
}
