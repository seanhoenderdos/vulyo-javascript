"use client";

import { AuthForm } from "./auth-form.js";
import type { VulyoAppearance } from "./auth-appearance.js";
import { useVulyo } from "../provider.js";
import { useEffect } from "react";

export type SignInProps = {
  appearance?: VulyoAppearance;
  signUpUrl?: string;
  waitlistUrl?: string;
  forceRedirectUrl?: string;
  fallbackRedirectUrl?: string;
};

export function SignIn({ appearance, fallbackRedirectUrl, forceRedirectUrl, signUpUrl, waitlistUrl }: SignInProps) {
  const { isLoaded, isSignedIn, navigate, resolveAfterSignInUrl } = useVulyo();
  const redirectUrl = resolveAfterSignInUrl({ ...(fallbackRedirectUrl ? { fallback: fallbackRedirectUrl } : {}), ...(forceRedirectUrl ? { force: forceRedirectUrl } : {}) });
  useEffect(() => { if (isLoaded && isSignedIn) navigate(redirectUrl); }, [isLoaded, isSignedIn, navigate, redirectUrl]);
  return (
    <AuthForm
      type="sign-in"
      redirectUrl={redirectUrl}
      {...(appearance ? { appearance } : {})}
      {...(signUpUrl ? { signUpUrl } : {})}
      {...(waitlistUrl ? { waitlistUrl } : {})}
    />
  );
}
