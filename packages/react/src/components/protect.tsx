"use client";

import { useVulyo } from "../provider.js";

export function Protect({
  feature,
  fallback = null,
  children,
}: {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { entitlements, isLoaded, isSignedIn } = useVulyo();
  const allowed = Boolean(isLoaded && isSignedIn && entitlements?.features.includes(feature));
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
