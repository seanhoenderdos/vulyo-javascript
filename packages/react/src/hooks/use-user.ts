"use client";

import { useVulyo } from "../provider.js";

export function useUser() {
  const { isLoaded, user } = useVulyo();
  return { isLoaded, user };
}
