import { vulyoRoutes } from "@vulyo/core/routes";
import { SignIn, SignedIn, SignedOut, UserButton, UserProfile } from "@vulyo/nextjs";

export default function HomePage() {
  return (
    <main>
      <h1>Example customer app</h1>
      <SignedOut>
        <SignIn forceRedirectUrl={vulyoRoutes.app.home} signUpUrl={vulyoRoutes.app.signUp} />
      </SignedOut>
      <SignedIn>
        <UserButton showName userProfileUrl="/account" />
        <section id="account">
          <UserProfile />
        </section>
      </SignedIn>
    </main>
  );
}
