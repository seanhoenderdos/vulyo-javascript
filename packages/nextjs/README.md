# `@vulyo/nextjs`

The first-party Vulyo adapter for the Next.js App Router.

```bash
pnpm add @vulyo/nextjs
```

```tsx
import { VulyoProvider } from "@vulyo/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <VulyoProvider publishableKey={process.env.NEXT_PUBLIC_VULYO_PUBLISHABLE_KEY!}>
          {children}
        </VulyoProvider>
      </body>
    </html>
  );
}
```

This package re-exports Vulyo's React authentication components and adds App Router proxy handlers, OAuth callback handling, middleware, server-side session validation, and Neon-compatible auth claims.

Use the runnable [`examples/nextjs-app`](https://github.com/seanhoenderdos/vulyo-javascript/tree/main/examples/nextjs-app) for the complete route and middleware setup.
