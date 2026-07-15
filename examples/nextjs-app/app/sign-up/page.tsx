import { SignUp } from "@vulyo/nextjs";

export default function SignUpPage() {
  return (
    <main>
      <SignUp forceRedirectUrl="/dashboard" signInUrl="/sign-in" />
    </main>
  );
}
