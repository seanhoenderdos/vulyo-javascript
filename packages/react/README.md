# `@vulyo/react`

Accessible, customizable authentication components and hooks for Vulyo React applications.

```bash
pnpm add @vulyo/react
```

```tsx
import { SignIn, VulyoProvider } from "@vulyo/react";

export function AuthPage() {
  return (
    <VulyoProvider publishableKey="pk_test_..." proxyUrl="/api/vulyo">
      <SignIn />
    </VulyoProvider>
  );
}
```

The primary components are `SignIn`, `SignUp`, `UserButton`, `UserProfile`, and `Waitlist`. Supporting exports include `Protect`, `SignedIn`, `SignedOut`, password recovery, `useAuth`, and `useUser`.

Authentication policy, enabled providers, legal links, and product branding are loaded from the Vulyo application identified by the publishable key. Visual styling can be adjusted with the provider's `appearance` prop.

See the [repository README](https://github.com/seanhoenderdos/vulyo-javascript#readme) for setup and support.
