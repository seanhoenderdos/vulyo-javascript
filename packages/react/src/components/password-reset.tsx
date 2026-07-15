"use client";

import { buildAuthorizationCallbackUrl } from "@vulyo/core";
import { passwordResetConfirmSchema, passwordResetRequestSchema } from "@vulyo/core/password-reset-forms";
import { vulyoRoutes } from "@vulyo/core/routes";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { useVulyo } from "../provider.js";
import { resolveAuthVariables, toAuthCssVariables, type VulyoAppearance } from "./auth-appearance.js";
import { AuthTextField } from "./auth-text-field.js";
import { VulyoButton, VulyoCard, VulyoStack } from "./primitives.js";

type PasswordResetBaseProps = {
  appearance?: VulyoAppearance;
  applicationName?: string;
  redirectUrl?: string;
  signInUrl?: string;
};

export type PasswordResetRequestProps = PasswordResetBaseProps;

export type PasswordResetProps = PasswordResetBaseProps & {
  authTransactionId?: string;
  authTransactionState?: string;
  token: string;
};

export function PasswordResetRequest({
  appearance,
  applicationName: applicationNameProp,
  redirectUrl = vulyoRoutes.app.home,
  signInUrl = vulyoRoutes.app.signIn,
}: PasswordResetRequestProps) {
  const { appConfig, request, usesSameOriginProxy } = useVulyo();
  const baseId = useId();
  const applicationName = applicationNameProp ?? appConfig?.branding.applicationName ?? "Vulyo";
  const mergedAppearance = useMemo(() => {
    const primaryColor = appConfig?.branding.primaryColor;
    if (!primaryColor) return appearance;

    return {
      ...appearance,
      variables: {
        colorFocus: primaryColor,
        colorPrimary: primaryColor,
        ...appearance?.variables,
      },
    };
  }, [appearance, appConfig?.branding.primaryColor]);
  const variables = useMemo(() => resolveAuthVariables(mergedAppearance), [mergedAppearance]);
  const elements = mergedAppearance?.elements ?? {};
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(undefined);
    setFormError(null);
    setMessage(null);
    setDevResetUrl(null);

    const validation = passwordResetRequestSchema.safeParse({ email, redirectUrl });
    if (!validation.success) {
      setEmailError(validation.error.issues.find((issue) => issue.path[0] === "email")?.message ?? "Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (usesSameOriginProxy) {
        const transaction = await request("transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "sign_in", provider: "password", redirectUrl }),
        });
        if (!transaction.ok) throw new Error("Unable to start password reset.");
      }
      const response = await request("password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(validation.data),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string; resetUrl?: string } | null;
      if (!response.ok) {
        setFormError(payload?.error ?? "Unable to request password reset.");
        return;
      }
      setMessage(payload?.message ?? "If an account exists, a password reset email has been sent.");
      setDevResetUrl(payload?.resetUrl ?? null);
    } catch {
      setFormError("We could not reach Vulyo. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ ...toAuthCssVariables(variables), background: variables.colorBackground, boxSizing: "border-box", color: variables.colorText, fontFamily: variables.fontFamily, width: "100%", ...elements.root }}>
      <VulyoCard style={{ boxSizing: "border-box", marginInline: "auto", maxWidth: 402, width: "100%", ...elements.card }}>
        <VulyoStack gap="lg">
          <header style={{ display: "grid", gap: 8, ...elements.header }}>
            <h2 style={{ color: variables.colorText, fontSize: 20, fontWeight: 700, letterSpacing: 0, lineHeight: 1.2, margin: 0, ...elements.title }}>
              Reset your password
            </h2>
            <p style={{ color: variables.colorMuted, fontSize: 13, lineHeight: 1.5, margin: 0, ...elements.subtitle }}>
              Enter the email you use for {applicationName}.
            </p>
          </header>

          {formError ? <Alert color={variables.colorDanger} borderColor={variables.colorDanger} style={elements.alert}>{formError}</Alert> : null}
          {message ? <Alert color={variables.colorText} borderColor={variables.colorBorder} style={elements.alert}>{message}{devResetUrl ? <> <a href={devResetUrl} style={{ color: variables.colorPrimary, fontWeight: 760 }}>Open reset link</a></> : null}</Alert> : null}

          <form noValidate onSubmit={submit} style={{ display: "grid", gap: 14, ...elements.form }}>
            <AuthTextField
              autoComplete="email"
              error={emailError}
              errorId={`${baseId}-email-error`}
              id={`${baseId}-email`}
              label="Email address"
              onValueChange={setEmail}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <VulyoButton disabled={isSubmitting} fullWidth style={elements.button} type="submit">
              {isSubmitting ? "Sending reset email..." : "Send reset email"}
            </VulyoButton>
          </form>

          <p style={{ color: variables.colorMuted, fontSize: 13, lineHeight: 1.5, margin: 0, textAlign: "center", ...elements.footer }}>
            Remembered it? <a href={signInUrl} style={{ color: variables.colorPrimary, fontWeight: 760, textDecoration: "none", ...elements.link }}>Sign in</a>
          </p>
        </VulyoStack>
      </VulyoCard>
    </div>
  );
}

export function PasswordReset({
  appearance,
  applicationName: applicationNameProp,
  authTransactionId,
  authTransactionState,
  redirectUrl = vulyoRoutes.app.home,
  signInUrl = vulyoRoutes.app.signIn,
  token,
}: PasswordResetProps) {
  const { appConfig, refreshSession, request, usesSameOriginProxy } = useVulyo();
  const baseId = useId();
  const applicationName = applicationNameProp ?? appConfig?.branding.applicationName ?? "Vulyo";
  const mergedAppearance = useMemo(() => {
    const primaryColor = appConfig?.branding.primaryColor;
    if (!primaryColor) return appearance;

    return {
      ...appearance,
      variables: {
        colorFocus: primaryColor,
        colorPrimary: primaryColor,
        ...appearance?.variables,
      },
    };
  }, [appearance, appConfig?.branding.primaryColor]);
  const variables = useMemo(() => resolveAuthVariables(mergedAppearance), [mergedAppearance]);
  const elements = mergedAppearance?.elements ?? {};
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(undefined);
    setFormError(null);

    const validation = passwordResetConfirmSchema.safeParse({
      authTransactionId,
      password,
      redirectUrl,
      state: authTransactionState,
      token,
    });
    if (!validation.success) {
      setPasswordError(validation.error.issues.find((issue) => issue.path[0] === "password")?.message ?? "Enter a valid password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await request("password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(validation.data),
      });
      const payload = (await response.json().catch(() => null)) as {
        authorizationCode?: string;
        error?: string;
        redirectUrl?: string;
        state?: string;
      } | null;
      if (!response.ok) {
        setFormError(payload?.error ?? "Unable to reset password.");
        return;
      }
      if (payload?.authorizationCode && payload.state && payload.redirectUrl) {
        window.location.assign(buildAuthorizationCallbackUrl({
          authorizationCode: payload.authorizationCode,
          redirectUrl: payload.redirectUrl,
          state: payload.state,
        }));
        return;
      }
      if (usesSameOriginProxy) await refreshSession();
      window.location.assign(payload?.redirectUrl ?? redirectUrl);
    } catch {
      setFormError("We could not reach Vulyo. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ ...toAuthCssVariables(variables), background: variables.colorBackground, boxSizing: "border-box", color: variables.colorText, fontFamily: variables.fontFamily, width: "100%", ...elements.root }}>
      <VulyoCard style={{ boxSizing: "border-box", marginInline: "auto", maxWidth: 402, width: "100%", ...elements.card }}>
        <VulyoStack gap="lg">
          <header style={{ display: "grid", gap: 8, ...elements.header }}>
            <h2 style={{ color: variables.colorText, fontSize: 20, fontWeight: 700, letterSpacing: 0, lineHeight: 1.2, margin: 0, ...elements.title }}>
              Set a new password
            </h2>
            <p style={{ color: variables.colorMuted, fontSize: 13, lineHeight: 1.5, margin: 0, ...elements.subtitle }}>
              Choose a new password for {applicationName}.
            </p>
          </header>

          {formError ? <Alert color={variables.colorDanger} borderColor={variables.colorDanger} style={elements.alert}>{formError}</Alert> : null}

          <form noValidate onSubmit={submit} style={{ display: "grid", gap: 14, ...elements.form }}>
            <AuthTextField
              autoComplete="new-password"
              error={passwordError}
              errorId={`${baseId}-password-error`}
              helpText="Use at least 8 characters."
              helpTextId={`${baseId}-password-help`}
              id={`${baseId}-password`}
              label="New password"
              minLength={8}
              onValueChange={setPassword}
              placeholder="Enter your new password"
              type="password"
              value={password}
            />
            <VulyoButton disabled={isSubmitting} fullWidth style={elements.button} type="submit">
              {isSubmitting ? "Resetting password..." : "Reset password"}
            </VulyoButton>
          </form>

          <p style={{ color: variables.colorMuted, fontSize: 13, lineHeight: 1.5, margin: 0, textAlign: "center", ...elements.footer }}>
            Already reset? <a href={signInUrl} style={{ color: variables.colorPrimary, fontWeight: 760, textDecoration: "none", ...elements.link }}>Sign in</a>
          </p>
        </VulyoStack>
      </VulyoCard>
    </div>
  );
}

function Alert({ borderColor, children, color, style }: { borderColor: string; children: ReactNode; color: string; style?: CSSProperties | undefined }) {
  return (
    <div role="alert" style={{ border: `1px solid ${borderColor}`, borderRadius: "var(--vulyo-radius, 6px)", color, fontSize: 13, lineHeight: 1.45, padding: "9px 11px", ...style }}>
      {children}
    </div>
  );
}
