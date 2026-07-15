"use client";

import { useVulyo } from "../provider.js";

export function useAuth() {
  const { isLoaded, isSignedIn, publishableKey, refreshSession } = useVulyo();
  return { isLoaded, isSignedIn, publishableKey, refreshSession };
}
