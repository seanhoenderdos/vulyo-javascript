# Vulyo JavaScript SDKs

Official JavaScript SDKs for adding Vulyo authentication to React and Next.js applications.

## Packages

| Package | Use it for |
| --- | --- |
| [`@vulyo/core`](packages/core) | Framework-neutral auth contracts, routes, PKCE helpers, and session-token verification |
| [`@vulyo/react`](packages/react) | `SignIn`, `SignUp`, `UserButton`, `UserProfile`, `Waitlist`, hooks, and appearance controls |
| [`@vulyo/nextjs`](packages/nextjs) | Next.js App Router handlers, middleware, callbacks, server helpers, and Neon claim helpers |

## Quick start

```bash
pnpm add @vulyo/nextjs
```

Add the keys from your Vulyo application to `.env.local`:

```dotenv
NEXT_PUBLIC_VULYO_PUBLISHABLE_KEY=pk_test_...
VULYO_SECRET_KEY=sk_test_...
```

Wrap your app and render a component:

```tsx
import { SignIn, VulyoProvider } from "@vulyo/nextjs";

export default function Page() {
  return (
    <VulyoProvider publishableKey={process.env.NEXT_PUBLIC_VULYO_PUBLISHABLE_KEY!}>
      <SignIn />
    </VulyoProvider>
  );
}
```

The complete App Router setup is in [`examples/nextjs-app`](examples/nextjs-app).

## Repository scope

This repository contains the public client SDKs and examples. Vulyo's hosted authentication service, dashboard, payment processing, data stores, secrets, and operational tooling are maintained separately.

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Changes to published packages use [Changesets](https://github.com/changesets/changesets). Releases are published from GitHub Actions with npm provenance.

## Support and security

Use [GitHub Issues](https://github.com/seanhoenderdos/vulyo-javascript/issues) for reproducible SDK bugs. Report security concerns privately as described in [SECURITY.md](SECURITY.md).

Licensed under the [MIT License](LICENSE).
