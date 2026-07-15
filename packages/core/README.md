# `@vulyo/core`

Framework-neutral contracts and verification utilities used by Vulyo's JavaScript SDKs.

```bash
pnpm add @vulyo/core
```

```ts
import { verifySessionTokenWithJwks } from "@vulyo/core";
```

Use this package when building an adapter or validating Vulyo session claims without React. Most React and Next.js applications should install `@vulyo/react` or `@vulyo/nextjs` instead.

Public exports include auth form schemas, PKCE transaction helpers, cookie names, hosted-auth routes, and RS256 token verification. It does not contain Vulyo backend, database, payment, or secret-management code.

See the [repository README](https://github.com/seanhoenderdos/vulyo-javascript#readme) for setup and support.
