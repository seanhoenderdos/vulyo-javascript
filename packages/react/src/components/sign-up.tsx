"use client";

import { AuthForm } from "./auth-form.js";
import type { VulyoAppearance } from "./auth-appearance.js";
import { useVulyo } from "../provider.js";
import { useEffect } from "react";

export type SignUpProps = {
  appearance?: VulyoAppearance;
  signInUrl?: string;
  waitlistUrl?: string;
  forceRedirectUrl?: string;
  fallbackRedirectUrl?: string;
};

export function SignUp({ appearance, fallbackRedirectUrl, forceRedirectUrl, signInUrl, waitlistUrl }: SignUpProps) {
  const { isLoaded, isSignedIn, navigate, resolveAfterSignUpUrl } = useVulyo();
  const redirectUrl = resolveAfterSignUpUrl({ ...(fallbackRedirectUrl ? { fallback: fallbackRedirectUrl } : {}), ...(forceRedirectUrl ? { force: forceRedirectUrl } : {}) });
  useEffect(() => { if (isLoaded && isSignedIn) navigate(redirectUrl); }, [isLoaded, isSignedIn, navigate, redirectUrl]);
  return (
    <AuthForm
      type="sign-up"
      redirectUrl={redirectUrl}
      {...(appearance ? { appearance } : {})}
      {...(signInUrl ? { signInUrl } : {})}
      {...(waitlistUrl ? { waitlistUrl } : {})}
    />
  );
}
