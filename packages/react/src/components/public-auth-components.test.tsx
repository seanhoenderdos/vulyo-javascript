import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VulyoProvider, type VulyoAppConfig, type VulyoUser } from "../provider.js";
import { SignIn } from "./sign-in.js";
import { SignUp } from "./sign-up.js";
import { UserButton } from "./user-button.js";
import { UserProfile } from "./user-profile.js";
import { Waitlist } from "./waitlist.js";

const signedInUser: VulyoUser = {
  appId: "app_test",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
  emailVerified: true,
  id: "user_test",
};

const appConfig: VulyoAppConfig = {
  id: "app_test", instanceId: "ins_test", environment: "production", name: "Acme", publishableKey: "pk_test_component",
  branding: { applicationName: "Acme", logoUrl: null, logoAltText: null, faviconUrl: null, primaryColor: "#16756f", supportEmail: null, termsUrl: null, privacyUrl: null },
  authMethods: { signIn: { email: true, phone: false, username: false, google: true, github: true }, signUp: { email: true, phone: false, username: false, google: true, github: true } },
  authProviders: {
    google: { enabled: true, provider: "google", configured: true },
    github: { enabled: true, provider: "github", configured: true },
  },
  access: { mode: "waitlist", turnstileSiteKey: null },
};

function renderComponent(component: React.ReactNode, initialUser?: VulyoUser | null, config = appConfig) {
  return renderToStaticMarkup(
    <VulyoProvider proxyUrl="https://app.example.test/api/vulyo" publishableKey="pk_test_component" initialState={{ appConfig: config, ...(initialUser === undefined ? {} : { user: initialUser }) }}>
      {component}
    </VulyoProvider>,
  );
}

describe("public authentication components", () => {
  it("renders the SignIn social and password experience", () => {
    const html = renderComponent(
      <SignIn />,
    );

    expect(html).toContain("Sign in to Acme");
    expect(html).toContain("Continue with Google</a>");
    expect(html).toContain("Continue with GitHub</a>");
    expect(html).toContain("publishable_key=pk_test_component");
    expect(html).toContain("https://app.example.test/api/vulyo/oauth/google?");
    expect(html).toContain("Forgot password?");
    expect(html).toContain("Secured by Vulyo");
  });

  it("renders the SignUp experience without development-only text by default", () => {
    const html = renderComponent(<SignUp />);

    expect(html).toContain("Create your Acme account");
    expect(html).toContain("Continue");
    expect(html).toContain("purpose=sign_up");
    expect(html).not.toContain("Development");
  });

  it("renders the signed-in account menu and profile", () => {
    const userButton = renderComponent(<UserButton showName userProfileUrl="/account" />, signedInUser);
    const userProfile = renderComponent(<UserProfile initialPage="security" />, signedInUser);

    expect(userButton).toContain("Ada Lovelace");
    expect(userButton).toContain('aria-haspopup="menu"');
    expect(userButton).toContain('aria-expanded="false"');
    expect(userProfile).toContain("Active sessions");
    expect(userProfile).toContain("Reset password");
  });

  it("renders a branded Waitlist with its development badge only when requested", () => {
    const productionHtml = renderComponent(<Waitlist signInUrl="/sign-in" />);
    const developmentHtml = renderComponent(<Waitlist />, undefined, { ...appConfig, environment: "development" });

    expect(productionHtml).toContain("Join the waitlist");
    expect(productionHtml).toContain("Already have access?");
    expect(productionHtml).not.toContain("Development");
    expect(developmentHtml).toContain("Development");
  });

  it("applies typed localization to configured providers and combined identifiers", () => {
    const html = renderToStaticMarkup(
      <VulyoProvider
        localization={{
          emailOrUsername: "Account handle",
          emailOrUsernamePlaceholder: "Enter your handle",
          continueWithGithub: "Continue with CodeHub",
          continueWithGoogle: "Continue with SearchID",
        }}
        proxyUrl="https://app.example.test/api/vulyo"
        publishableKey="pk_test_component"
        initialState={{
          appConfig: {
            ...appConfig,
            authMethods: { ...appConfig.authMethods, signIn: { ...appConfig.authMethods.signIn, username: true } },
          },
        }}
      >
        <SignIn />
      </VulyoProvider>,
    );

    expect(html).toContain("Account handle");
    expect(html).toContain("Enter your handle");
    expect(html).toContain("Continue with SearchID");
    expect(html).toContain("Continue with CodeHub");
  });
});
