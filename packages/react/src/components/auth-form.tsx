"use client";

import { type AuthFieldErrors, type AuthMode, validateAuthFormValues } from "@vulyo/core/auth-forms";
import { vulyoRoutes } from "@vulyo/core/routes";
import { Eye, EyeClosed, Github } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { useVulyo, type VulyoAppConfig } from "../provider.js";
import { resolveAuthVariables, toAuthCssVariables, type VulyoAppearance } from "./auth-appearance.js";
import { AuthTextField } from "./auth-text-field.js";
import { VulyoButton, VulyoCard, VulyoStack } from "./primitives.js";
import { VulyoAuthBrand, VulyoAuthHeader, VulyoDevelopmentBadge, VulyoTrustFooter } from "./auth-shell.js";

export type { AuthMode } from "@vulyo/core/auth-forms";
export type { VulyoAppearance, VulyoAuthElement, VulyoAuthVariables } from "./auth-appearance.js";

export type VulyoLegalLink = {
  href: string;
  label: string;
};

export type VulyoOAuthProvider = {
  enabled?: boolean;
  href: string;
  label?: string;
  provider: "github" | "google";
};

export type VulyoAuthIdentifierOptions = {
  email?: boolean;
  phone?: boolean;
  username?: boolean;
};

type AuthFormBaseProps = {
  appearance?: VulyoAppearance;
  applicationName?: string;
  authMethods?: VulyoAuthIdentifierOptions;
  developmentMode?: boolean;
  developmentModeLabel?: string;
  forgotPasswordUrl?: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  legalLinks?: VulyoLegalLink[];
  logoAltText?: string;
  logoUrl?: string | null;
  oauthProviders?: VulyoOAuthProvider[];
  redirectUrl?: string | undefined;
  signInUrl?: string;
  signUpUrl?: string;
  subtitle?: string;
  title?: string;
  waitlistUrl?: string;
};

export type AuthFormProps = AuthFormBaseProps & ({ type: AuthMode; mode?: never } | { mode: AuthMode; type?: never });

const authEndpointByMode: Record<AuthMode, string> = {
  "sign-in": vulyoRoutes.api.auth.signIn,
  "sign-up": vulyoRoutes.api.auth.signUp,
};

type AuthResponsePayload = {
  verificationRequired?: boolean;
  verificationUrl?: string;
};

function getDefaultTitle(type: AuthMode, applicationName: string) {
  return type === "sign-in" ? `Sign in to ${applicationName}` : `Create your ${applicationName} account`;
}

function getDefaultSubtitle(type: AuthMode) {
  return type === "sign-in" ? "Welcome back. Continue with your email and password." : "Start with a secure account scoped to this app.";
}

function getConfigLegalLinks(config: VulyoAppConfig | null, labels: { privacy: string; terms: string }): VulyoLegalLink[] {
  const links: VulyoLegalLink[] = [];
  if (config?.legal?.termsUrl) links.push({ href: config.legal.termsUrl, label: labels.terms });
  if (config?.legal?.privacyUrl) links.push({ href: config.legal.privacyUrl, label: labels.privacy });
  return links;
}

function getConfigOAuthProviders(input: {
  appConfig: VulyoAppConfig | null;
  proxyUrl: string;
  publishableKey: string;
  redirectUrl: string | undefined;
  failureUrl: string;
  purpose: "sign_in" | "sign_up";
}): VulyoOAuthProvider[] {
  const providers = input.appConfig?.authProviders;
  if (!providers) return [];

  const enabledProviders: VulyoOAuthProvider[] = [];
  if (providers.google.enabled) {
    const search = new URLSearchParams({
      failure_url: input.failureUrl,
      publishable_key: input.publishableKey,
      purpose: input.purpose,
      redirect_url: input.redirectUrl ?? "/",
    });
    enabledProviders.push({
      provider: "google",
      href: `${input.proxyUrl}/oauth/google?${search.toString()}`,
    });
  }
  if (providers.github.enabled) {
    const search = new URLSearchParams({
      failure_url: input.failureUrl,
      publishable_key: input.publishableKey,
      purpose: input.purpose,
      redirect_url: input.redirectUrl ?? "/",
    });
    enabledProviders.push({
      provider: "github",
      href: `${input.proxyUrl}/oauth/github?${search.toString()}`,
    });
  }

  return enabledProviders;
}

export function AuthForm(props: AuthFormProps) {
  const {
    appearance,
    applicationName: applicationNameProp,
    authMethods: authMethodsProp,
    developmentMode: developmentModeProp,
    developmentModeLabel = "Development",
    forgotPasswordUrl = vulyoRoutes.app.resetPassword,
    identifierLabel,
    identifierPlaceholder,
    legalLinks: legalLinksProp,
    logoAltText: logoAltTextProp,
    logoUrl: logoUrlProp,
    oauthProviders: oauthProvidersProp,
    redirectUrl,
    signInUrl = vulyoRoutes.app.signIn,
    signUpUrl = vulyoRoutes.app.signUp,
    subtitle,
    title,
    waitlistUrl,
  } = props;
  const type = props.type ?? props.mode;
  const {
    appConfig, appearance: providerAppearance, localize, navigate, proxyUrl, publishableKey, refreshSession, request,
    resolveAfterSignInUrl, resolveAfterSignUpUrl, usesSameOriginProxy,
  } = useVulyo();
  const baseId = useId();
  const mergedAppearance = useMemo(() => {
    const inherited = { ...providerAppearance, ...appearance, variables: { ...providerAppearance?.variables, ...appearance?.variables }, elements: { ...providerAppearance?.elements, ...appearance?.elements } };
    const primaryColor = appConfig?.branding.primaryColor;
    if (!primaryColor) return inherited;

    return {
      ...inherited,
      variables: {
        colorFocus: primaryColor,
        colorPrimary: primaryColor,
        ...inherited.variables,
      },
    };
  }, [appearance, providerAppearance, appConfig?.branding.primaryColor]);
  const variables = useMemo(() => resolveAuthVariables(mergedAppearance), [mergedAppearance]);
  const elements = mergedAppearance?.elements ?? {};
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  const emailErrorId = `${baseId}-email-error`;
  const passwordHelpId = `${baseId}-password-help`;
  const passwordErrorId = `${baseId}-password-error`;
  const emailInputId = `${baseId}-email`;
  const phoneInputId = `${baseId}-phone`;
  const passwordInputId = `${baseId}-password`;
  const usernameInputId = `${baseId}-username`;
  const configAuthMethods = type === "sign-in" ? appConfig?.authMethods.signIn : appConfig?.authMethods.signUp;
  const applicationName = applicationNameProp ?? appConfig?.branding.applicationName ?? "Vulyo";
  const developmentMode = developmentModeProp ?? appConfig?.environment === "development";
  const authMethods = authMethodsProp ?? configAuthMethods ?? { email: true, phone: false, username: false };
  const legalLinks = legalLinksProp ?? getConfigLegalLinks(appConfig, {
    privacy: localize("privacyPolicy", "Privacy Policy"),
    terms: localize("terms", "Terms"),
  });
  const logoAltText = logoAltTextProp ?? appConfig?.branding.logoAltText ?? undefined;
  const logoUrl = logoUrlProp !== undefined ? logoUrlProp : (appConfig?.branding.logoUrl ?? null);
  const redirectOverride = redirectUrl ? { force: redirectUrl } : undefined;
  const resolvedRedirectUrl = type === "sign-in"
    ? resolveAfterSignInUrl(redirectOverride)
    : resolveAfterSignUpUrl(redirectOverride);
  const oauthProviders = oauthProvidersProp ?? getConfigOAuthProviders({
    proxyUrl,
    publishableKey,
    appConfig,
    redirectUrl: resolvedRedirectUrl,
    failureUrl: type === "sign-up" ? signUpUrl : signInUrl,
    purpose: type === "sign-up" ? "sign_up" : "sign_in",
  });
  const resolvedTitle = title ?? localize(type === "sign-in" ? "signInTitle" : "signUpTitle", getDefaultTitle(type, applicationName), { applicationName });
  const resolvedSubtitle = subtitle ?? localize(type === "sign-in" ? "signInSubtitle" : "signUpSubtitle", getDefaultSubtitle(type));
  const resolvedIdentifierLabel = type === "sign-in"
    ? identifierLabel ?? (authMethods.username && authMethods.phone
      ? localize("emailUsernameOrPhone", "Email address, username, or phone number")
      : authMethods.username
        ? localize("emailOrUsername", "Email address or username")
        : authMethods.phone
          ? localize("emailOrPhone", "Email address or phone number")
          : localize("emailAddress", "Email address"))
    : localize("emailAddress", "Email address");
  const resolvedIdentifierPlaceholder = type === "sign-in"
    ? identifierPlaceholder ?? (authMethods.username && authMethods.phone
      ? localize("emailUsernameOrPhonePlaceholder", "Enter your email, username, or phone")
      : authMethods.username
        ? localize("emailOrUsernamePlaceholder", "Enter your email address or username")
        : authMethods.phone
          ? localize("emailOrPhonePlaceholder", "Enter your email address or phone")
          : localize("emailPlaceholder", "Enter your email address"))
    : localize("emailPlaceholder", "Enter your email address");
  const alternateAction =
    type === "sign-in"
      ? { href: signUpUrl, label: localize("createAccount", "Create account"), prompt: localize("noAccount", "No account yet?") }
      : { href: signInUrl, label: localize("signIn", "Sign in"), prompt: localize("alreadyHaveAccount", "Already have an account?") };
  const visibleOAuthProviders = oauthProviders.filter((provider) => provider.enabled !== false);
  const legalAcceptanceRequired = type === "sign-up" && appConfig?.legal?.acceptanceRequired === true;
  const acceptedTermsVersion = legalAcceptanceRequired && legalAccepted ? appConfig?.legal?.termsVersion : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const oauthError = url.searchParams.get("vulyo_oauth_error");
    if (!oauthError) return;
    if (oauthError === "waitlist_required" && waitlistUrl) {
      navigate(waitlistUrl);
      return;
    }
    setFormError(oauthError === "legal_acceptance_required"
      ? localize("acceptLegal", "Accept the Terms and Privacy Policy to create your account.")
      : localize("oauthFailed", "Social sign-in could not be completed. Try again."));
    url.searchParams.delete("vulyo_oauth_error");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [localize, navigate, waitlistUrl]);

  function validateFieldState(nextEmail: string, nextPassword: string) {
    const validation = validateAuthFormValues({ type, email: nextEmail, password: nextPassword });
    return validation.ok ? {} : validation.fieldErrors;
  }

  function updateEmail(nextEmail: string) {
    setEmail(nextEmail);
    if (hasSubmitted) {
      setFieldErrors(validateFieldState(nextEmail, password));
    }
  }

  function updatePassword(nextPassword: string) {
    setPassword(nextPassword);
    if (hasSubmitted) {
      setFieldErrors(validateFieldState(email, nextPassword));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setFormError(null);

    const validation = validateAuthFormValues({ type, email, password });
    setFieldErrors(validation.fieldErrors);
    if (!validation.ok) {
      return;
    }
    if (legalAcceptanceRequired && !legalAccepted) {
      setFormError(localize("acceptLegal", "Accept the Terms and Privacy Policy to create your account."));
      return;
    }

    setIsSubmitting(true);
    try {
      if (usesSameOriginProxy) {
        const transaction = await request("transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: type === "sign-up" ? "sign_up" : "sign_in", provider: "password", redirectUrl: resolvedRedirectUrl }),
        });
        if (!transaction.ok) throw new Error(localize("authenticationFailed", "Unable to start authentication."));
      }
      const response = await request(type, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validation.data.email,
          legalAcceptance: legalAcceptanceRequired
            ? { accepted: true, termsVersion: appConfig!.legal!.termsVersion }
            : undefined,
          password: validation.data.password,
          phoneNumber: type === "sign-up" && authMethods.phone ? phoneNumber : undefined,
          redirectUrl: resolvedRedirectUrl,
          username: type === "sign-up" && authMethods.username ? username : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string | { code?: string; message?: string } } | null;
        if (typeof payload?.error === "object" && payload.error.code === "waitlist_required") {
          navigate(waitlistUrl ?? vulyoRoutes.app.waitlist);
          return;
        }
        setFormError(typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? localize("authenticationFailed", "Authentication failed. Check your details and try again."));
        return;
      }

      const payload = (await response.json().catch(() => null)) as AuthResponsePayload | null;
      if (type === "sign-up" && payload?.verificationRequired && payload.verificationUrl) {
        if (usesSameOriginProxy) setVerificationPending(true);
        else navigate(payload.verificationUrl);
        return;
      }

      await refreshSession();
      navigate((payload as { redirectUrl?: string } | null)?.redirectUrl ?? resolvedRedirectUrl);
    } catch {
      setFormError(localize("unableReach", "We could not reach Vulyo. Check your connection and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!/^\d{6}$/u.test(verificationCode)) {
      setFormError(localize("verificationCodeInvalid", "Enter the 6-digit verification code."));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await request("verify-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode, email, redirectUrl: resolvedRedirectUrl }),
      });
      const payload = await response.json().catch(() => null) as { error?: string | { message?: string }; redirectUrl?: string } | null;
      if (!response.ok) {
        setFormError(typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? localize("verificationFailed", "Verification failed. Try again."));
        return;
      }
      await refreshSession();
      navigate(payload?.redirectUrl ?? resolvedRedirectUrl);
    } catch {
      setFormError(localize("unableReach", "We could not reach Vulyo. Check your connection and try again."));
    } finally { setIsSubmitting(false); }
  }

  return (
    <div
      style={{
        ...toAuthCssVariables(variables),
        background: variables.colorBackground,
        boxSizing: "border-box",
        color: variables.colorText,
        fontFamily: variables.fontFamily,
        width: "100%",
        ...elements.root,
      }}
    >
      <VulyoCard style={{ boxSizing: "border-box", marginInline: "auto", maxWidth: 402, overflow: "hidden", padding: 0, width: "100%", ...elements.card }}>
        <VulyoStack gap={0}>
          <div style={{ display: "grid", gap: 18, padding: "28px 38px 26px", ...elements.body }}>
            <VulyoAuthBrand applicationName={applicationName} logoAltText={logoAltText} logoUrl={logoUrl} markStyle={elements.brandMark} style={elements.brand} />
            {developmentMode ? <VulyoDevelopmentBadge style={elements.developmentBadge}>{localize("development", developmentModeLabel)}</VulyoDevelopmentBadge> : null}
            <VulyoAuthHeader subtitle={resolvedSubtitle} subtitleStyle={elements.subtitle} title={resolvedTitle} titleStyle={elements.title} style={elements.header} />

            {formError ? (
            <div
              role="alert"
              style={{
                background: "rgba(180, 35, 24, 0.08)",
                border: `1px solid ${variables.colorDanger}`,
                borderRadius: "var(--vulyo-radius, 8px)",
                color: variables.colorDanger,
                fontSize: 13,
                lineHeight: 1.45,
                padding: "11px 12px",
                ...elements.alert,
              }}
            >
              {formError}
            </div>
            ) : null}

            {verificationPending ? (
              <form noValidate onSubmit={verifyEmail} style={{ display: "grid", gap: 14 }}>
                <AuthTextField autoComplete="one-time-code" errorId={`${baseId}-verification-error`} id={`${baseId}-verification-code`} label={localize("verificationCode", "Verification code")} onValueChange={setVerificationCode} placeholder="000000" type="text" value={verificationCode} />
                <VulyoButton disabled={isSubmitting} fullWidth type="submit">{isSubmitting ? localize("verifying", "Verifying...") : localize("verifyEmail", "Verify email")}</VulyoButton>
              </form>
            ) : null}

            {!verificationPending && visibleOAuthProviders.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: visibleOAuthProviders.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr" }}>
                {visibleOAuthProviders.map((provider) => (
                <a
                  href={acceptedTermsVersion ? `${provider.href}&legal_terms_version=${encodeURIComponent(acceptedTermsVersion)}` : provider.href}
                  key={provider.provider}
                  onClick={(event) => {
                    if (legalAcceptanceRequired && !legalAccepted) {
                      event.preventDefault();
                      setFormError(localize("acceptLegal", "Accept the Terms and Privacy Policy to create your account."));
                    }
                  }}
                  style={{
                    alignItems: "center",
                    background: variables.colorCard,
                    border: `1px solid ${variables.colorBorder}`,
                    borderRadius: "var(--vulyo-radius, 8px)",
                    boxShadow: "var(--vulyo-social-button-shadow, 0 1px 2px rgba(15, 23, 42, 0.08))",
                    color: variables.colorText,
                    display: "inline-flex",
                    fontSize: 12,
                    fontWeight: 620,
                    gap: 7,
                    justifyContent: "center",
                    lineHeight: 1.2,
                    minHeight: 30,
                    padding: "0.28rem 0.7rem",
                    textDecoration: "none",
                    transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease",
                    ...elements.socialButton,
                  }}
                >
                    <OAuthProviderIcon provider={provider.provider} />
                    {provider.label ?? (provider.provider === "github"
                      ? localize("continueWithGithub", "Continue with GitHub")
                      : localize("continueWithGoogle", "Continue with Google"))}
                </a>
                ))}
              </div>
              <div style={{ alignItems: "center", color: variables.colorMuted, display: "grid", fontSize: 13, gap: 14, gridTemplateColumns: "1fr auto 1fr", marginTop: 10 }}>
                <span style={{ borderTop: `1px solid ${variables.colorBorder}` }} />
                <span>{localize("or", "or")}</span>
                <span style={{ borderTop: `1px solid ${variables.colorBorder}` }} />
              </div>
            </div>
            ) : null}

            {!verificationPending ? <form noValidate onSubmit={submit} style={{ display: "grid", gap: 14, ...elements.form }}>
            <AuthTextField
              autoComplete="email"
              error={fieldErrors.email}
              errorId={emailErrorId}
              fieldStyle={elements.field}
              id={emailInputId}
              inputStyle={elements.input}
              label={resolvedIdentifierLabel}
              labelStyle={elements.label}
              onValueChange={updateEmail}
              placeholder={resolvedIdentifierPlaceholder}
              type={type === "sign-in" ? "text" : "email"}
              value={email}
            />

            {type === "sign-up" && authMethods.username ? (
              <AuthTextField
                autoComplete="username"
                errorId={`${baseId}-username-error`}
                fieldStyle={elements.field}
                id={usernameInputId}
                inputStyle={elements.input}
                label={localize("username", "Username")}
                labelStyle={elements.label}
                onValueChange={setUsername}
                placeholder={localize("chooseUsername", "Choose a username")}
                type="text"
                value={username}
              />
            ) : null}

            {type === "sign-up" && authMethods.phone ? (
              <AuthTextField
                autoComplete="tel"
                errorId={`${baseId}-phone-error`}
                fieldStyle={elements.field}
                id={phoneInputId}
                inputStyle={elements.input}
                label={localize("phoneNumber", "Phone number")}
                labelStyle={elements.label}
                onValueChange={setPhoneNumber}
                placeholder={localize("phonePlaceholder", "Enter your phone number")}
                type="tel"
                value={phoneNumber}
              />
            ) : null}

            <AuthTextField
              autoComplete={type === "sign-up" ? "new-password" : "current-password"}
              endAdornment={
                <VulyoButton
                  aria-label={isPasswordVisible ? localize("hidePassword", "Hide password") : localize("showPassword", "Show password")}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  type="button"
                  variant="ghost"
                  style={{
                    alignItems: "center",
                    background: "transparent",
                    border: 0,
                    color: variables.colorMuted,
                    height: 28,
                    minHeight: 28,
                    padding: 0,
                    width: 28,
                    ...elements.passwordToggle,
                  }}
                >
                  {isPasswordVisible ? <EyeClosed aria-hidden="true" size={17} strokeWidth={2.1} /> : <Eye aria-hidden="true" size={17} strokeWidth={2.1} />}
                </VulyoButton>
              }
              error={fieldErrors.password}
              errorId={passwordErrorId}
              fieldStyle={elements.field}
              helpText={type === "sign-up" ? localize("passwordHelp", "Use at least 8 characters.") : undefined}
              helpTextId={passwordHelpId}
              id={passwordInputId}
              inputStyle={elements.input}
              label={localize("password", "Password")}
              labelStyle={elements.label}
              minLength={8}
              onValueChange={updatePassword}
              placeholder={localize("passwordPlaceholder", "Enter your password")}
              type={isPasswordVisible ? "text" : "password"}
              value={password}
            />

            {type === "sign-in" ? (
              <a href={forgotPasswordUrl} style={{ color: variables.colorPrimary, fontSize: 12, fontWeight: 700, justifySelf: "end", textDecoration: "none", ...elements.link }}>
                {localize("forgotPassword", "Forgot password?")}
              </a>
            ) : null}
            {type === "sign-in" && waitlistUrl ? (
              <a href={waitlistUrl} style={{ color: variables.colorPrimary, fontSize: 12, fontWeight: 650, justifySelf: "center", textDecoration: "none" }}>{localize("joinWaitlist", "Join the waitlist")}</a>
            ) : null}

            {legalAcceptanceRequired ? (
              <label
                style={{ alignItems: "flex-start", color: variables.colorMuted, display: "flex", fontSize: 12, gap: 9, lineHeight: 1.5, ...elements.legal }}
              >
                <input
                  aria-label={localize("acceptLegal", "Accept Terms and Privacy Policy")}
                  checked={legalAccepted}
                  onChange={(event) => {
                    setLegalAccepted(event.currentTarget.checked);
                    if (event.currentTarget.checked) setFormError(null);
                  }}
                  required
                  style={{ accentColor: variables.colorPrimary, flex: "0 0 auto", height: 15, margin: "2px 0 0", width: 15 }}
                  type="checkbox"
                />
                <span>
                  {localize("legalAgreementPrefix", "I agree to the")}{" "}
                  {legalLinks.map((link, index) => (
                    <span key={link.href}>
                      {index > 0 ? ` ${localize("conjunctionAnd", "and")} ` : null}
                      <a href={link.href} rel="noreferrer" style={{ color: variables.colorPrimary, fontWeight: 700, textDecoration: "none", ...elements.link }} target="_blank">
                        {link.label}
                      </a>
                    </span>
                  ))}
                  .
                </span>
              </label>
            ) : null}

            <VulyoButton disabled={isSubmitting} fullWidth style={elements.button} type="submit">
              {isSubmitting ? localize("continuing", "Continuing...") : localize("continue", "Continue")}
            </VulyoButton>
            </form> : null}

            {!legalAcceptanceRequired && legalLinks.length > 0 ? (
            <p style={{ color: variables.colorMuted, fontSize: 12, lineHeight: 1.55, margin: 0, ...elements.legal }}>
              {localize("byContinuing", "By continuing, you agree to")}{" "}
              {legalLinks.map((link, index) => (
                <span key={link.href}>
                  {index > 0 ? ` ${localize("conjunctionAnd", "and")} ` : null}
                  <a href={link.href} style={{ color: variables.colorPrimary, fontWeight: 700, textDecoration: "none", ...elements.link }}>
                    {link.label}
                  </a>
                </span>
              ))}
              .
            </p>
            ) : null}
          </div>

          <p style={{ background: "rgba(15, 23, 42, 0.025)", borderTop: `1px solid ${variables.colorBorder}`, color: variables.colorMuted, fontSize: 13, lineHeight: 1.5, margin: 0, padding: "13px 24px", textAlign: "center", ...elements.footer }}>
            {alternateAction.prompt}{" "}
            <a href={alternateAction.href} style={{ color: variables.colorPrimary, fontWeight: 700, textDecoration: "none", ...elements.link }}>
              {alternateAction.label}
            </a>
          </p>
          <VulyoTrustFooter style={{ background: "rgba(15, 23, 42, 0.025)", borderTop: `1px solid ${variables.colorBorder}`, fontWeight: 600, lineHeight: 1.5, padding: "12px 24px", textAlign: "center", ...elements.securityFooter }}>
            {localize("securedBy", "Secured by Vulyo")}
          </VulyoTrustFooter>
        </VulyoStack>
      </VulyoCard>
    </div>
  );
}

function OAuthProviderIcon({ provider }: { provider: VulyoOAuthProvider["provider"] }) {
  if (provider === "github") {
    return <Github aria-hidden="true" size={14} strokeWidth={2.1} />;
  }

  return (
    <svg aria-hidden="true" height="14" viewBox="0 0 18 18" width="14" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.204c0-.638-.057-1.252-.164-1.84H9v3.48h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.91c1.702-1.567 2.682-3.874 2.682-6.614Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.182l-2.91-2.258c-.806.54-1.837.86-3.046.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.322 0 2.508.454 3.44 1.346l2.582-2.58C13.463.892 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
