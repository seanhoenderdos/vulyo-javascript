import { vulyoRoutes } from "@vulyo/core/routes";

export type VulyoAdapterOptions = {
  apiUrl?: string;
  authUrl?: string;
  fetcher?: typeof fetch;
  publishableKey?: string;
  secretKey?: string;
};

export type ResolvedVulyoAdapterOptions = {
  apiUrl: string;
  authUrl: string;
  fetcher: typeof fetch;
  publishableKey: string;
  secretKey: string;
};

export function resolveVulyoAdapterOptions(options: VulyoAdapterOptions = {}): ResolvedVulyoAdapterOptions {
  const publishableKey = options.publishableKey ?? process.env.NEXT_PUBLIC_VULYO_PUBLISHABLE_KEY;
  const secretKey = options.secretKey ?? process.env.VULYO_SECRET_KEY;
  if (!publishableKey) throw new VulyoConfigurationError("NEXT_PUBLIC_VULYO_PUBLISHABLE_KEY is required.");
  if (!secretKey) throw new VulyoConfigurationError("VULYO_SECRET_KEY is required.");
  return {
    apiUrl: trimSlash(options.apiUrl ?? process.env.VULYO_API_URL ?? vulyoRoutes.external.apiUrl),
    authUrl: trimSlash(options.authUrl ?? process.env.NEXT_PUBLIC_VULYO_AUTH_URL ?? vulyoRoutes.external.authUrl),
    fetcher: options.fetcher ?? fetch,
    publishableKey,
    secretKey,
  };
}

export class VulyoConfigurationError extends Error {
  readonly code = "configuration_error";
}

export class VulyoNetworkError extends Error {
  readonly code = "network_error";
}

export class VulyoUnauthenticatedError extends Error {
  readonly code = "unauthenticated";
}

export class VulyoForbiddenError extends Error {
  readonly code = "forbidden";
}

function trimSlash(value: string) {
  return value.replace(/\/$/u, "");
}
