import { SignIn } from "@vulyo/nextjs";

export default function SignInPage() {
  return (
    <main>
      <SignIn forceRedirectUrl="/dashboard" signUpUrl="/sign-up" />
    </main>
  );
}
