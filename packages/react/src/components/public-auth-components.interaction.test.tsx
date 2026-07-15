// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { VulyoProvider, type VulyoAppConfig, type VulyoUser } from "../provider.js";
import { SignIn } from "./sign-in.js";
import { UserButton } from "./user-button.js";
import { UserProfile } from "./user-profile.js";
import { Waitlist } from "./waitlist.js";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

const config: VulyoAppConfig = {
  id: "app_test", instanceId: "ins_test", environment: "production", name: "Acme", publishableKey: "pk_test",
  branding: { applicationName: "Acme", logoUrl: null, logoAltText: "Acme logo", faviconUrl: null, primaryColor: "#16756f", supportEmail: null, termsUrl: null, privacyUrl: null },
  authMethods: { signIn: { email: true, phone: false, username: false, google: false, github: false }, signUp: { email: true, phone: false, username: false, google: false, github: false } },
  authProviders: { google: { provider: "google", enabled: false, configured: false }, github: { provider: "github", enabled: false, configured: false } },
};
const user: VulyoUser = { id: "user_test", appId: "app_test", appInstanceId: "ins_test", displayName: "Ada Lovelace", email: "ada@example.com", emailVerified: true };

function Provider({ children, signedIn = false, appConfig = config }: { children: React.ReactNode; signedIn?: boolean; appConfig?: VulyoAppConfig }) {
  return <VulyoProvider publishableKey="pk_test" initialState={{ appConfig, user: signedIn ? user : null }}>{children}</VulyoProvider>;
}

describe("public component interactions", () => {
  it("moves focus through the account menu and dismisses with Escape", async () => {
    const interaction = userEvent.setup();
    render(<Provider signedIn><UserButton showName /></Provider>);
    const trigger = screen.getByRole("button", { name: "Open account menu" });
    await interaction.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("menu"));
    await interaction.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: /Manage account/u }));
    await interaction.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Sign out" }));
    await interaction.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("exposes accessible validation and has no axe violations in the sign-in default state", async () => {
    const interaction = userEvent.setup();
    const rendered = render(<Provider><SignIn /></Provider>);
    await interaction.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Enter your email address, username, or phone number.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect((await axe(rendered.container)).violations).toEqual([]);
  });

  it("requires an unchecked, versioned legal acceptance during sign-up", async () => {
    const interaction = userEvent.setup();
    const legalConfig: VulyoAppConfig = {
      ...config,
      legal: {
        acceptanceRequired: true,
        privacyUrl: "https://acme.test/privacy",
        termsUrl: "https://acme.test/terms",
        termsVersion: "2026-07",
      },
    };
    const { SignUp } = await import("./sign-up.js");
    const rendered = render(<Provider appConfig={legalConfig}><SignUp /></Provider>);
    const acceptance = screen.getByRole("checkbox", { name: "Accept Terms and Privacy Policy" });
    expect((acceptance as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("https://acme.test/terms");
    await interaction.type(screen.getByRole("textbox", { name: "Email address" }), "person@example.com");
    await interaction.type(screen.getByPlaceholderText("Enter your password"), "password123");
    await interaction.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toContain("Accept the Terms");
    expect((await axe(rendered.container)).violations).toEqual([]);
  });

  it("does not start social sign-up until the current legal version is accepted", async () => {
    const interaction = userEvent.setup();
    const legalConfig: VulyoAppConfig = {
      ...config,
      authProviders: {
        ...config.authProviders,
        google: { provider: "google", enabled: true, configured: true },
      },
      legal: {
        acceptanceRequired: true,
        privacyUrl: "https://acme.test/privacy",
        termsUrl: "https://acme.test/terms",
        termsVersion: "2026-07",
      },
    };
    const { SignUp } = await import("./sign-up.js");
    render(<Provider appConfig={legalConfig}><SignUp /></Provider>);
    const google = screen.getByRole("link", { name: "Continue with Google" });

    await interaction.click(google);
    expect(screen.getByRole("alert").textContent).toContain("Accept the Terms");
    expect(google.getAttribute("href")).not.toContain("legal_terms_version");

    await interaction.click(screen.getByRole("checkbox", { name: "Accept Terms and Privacy Policy" }));
    const acceptedGoogle = screen.getByRole("link", { name: "Continue with Google" }).getAttribute("href") ?? "";
    expect(acceptedGoogle).toContain("legal_terms_version=2026-07");
    expect(acceptedGoogle).toContain("failure_url=%2Fsign-up");
  });

  it("redirects an already signed-in user with the provider-level after-sign-in setting", async () => {
    const navigate = vi.fn();
    render(
      <VulyoProvider afterSignInUrl="/account" navigate={navigate} publishableKey="pk_test" initialState={{ appConfig: config, user }}>
        <SignIn />
      </VulyoProvider>,
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/account"));
  });

  it("routes a denied OAuth account creation to the configured waitlist", async () => {
    const navigate = vi.fn();
    window.history.replaceState({}, "", "/register?vulyo_oauth_error=waitlist_required");
    const { SignUp } = await import("./sign-up.js");
    render(
      <VulyoProvider navigate={navigate} publishableKey="pk_test" initialState={{ appConfig: config, user: null }}>
        <SignUp waitlistUrl="/waitlist" />
      </VulyoProvider>,
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/waitlist"));
  });

  it("uses a connected OAuth identity for step-up and resumes the sensitive action once", async () => {
    const interaction = userEvent.setup();
    const navigate = vi.fn();
    let disconnectAttempts = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/account") && (!init?.method || init.method === "GET")) {
        return Response.json({ hasPassword: false, providers: [{ provider: "google", email: user.email, emailVerified: true }], user });
      }
      if (url.endsWith("/account/sessions")) return Response.json({ activeSessionId: "session_1", sessions: [] });
      if (url.endsWith("/account/providers")) {
        disconnectAttempts += 1;
        return disconnectAttempts === 1
          ? Response.json({ error: { code: "forbidden", message: "Confirm your identity." } }, { status: 403 })
          : Response.json({ ok: true });
      }
      if (url.endsWith("/account/oauth/google")) return Response.json({ url: "https://accounts.google.test/authorize" });
      return Response.json({ error: { code: "invalid_request", message: "Unexpected request." } }, { status: 400 });
    });
    vi.stubGlobal("fetch", fetcher);
    const oauthConfig: VulyoAppConfig = {
      ...config,
      authProviders: { ...config.authProviders, google: { provider: "google", enabled: true, configured: true } },
    };
    const first = render(
      <VulyoProvider navigate={navigate} publishableKey="pk_test" initialState={{ appConfig: oauthConfig, user }}>
        <UserProfile initialPage="security" />
      </VulyoProvider>,
    );

    await interaction.click(await screen.findByRole("button", { name: "Disconnect" }));
    await interaction.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(navigate).toHaveBeenCalledWith("https://accounts.google.test/authorize");
    expect(window.sessionStorage.getItem("vulyo:step-up:ins_test:user_test")).toBe("disconnect_google");
    first.unmount();

    window.history.replaceState({}, "", "/account?vulyo_step_up=complete");
    render(
      <VulyoProvider navigate={navigate} publishableKey="pk_test" initialState={{ appConfig: oauthConfig, user }}>
        <UserProfile initialPage="security" />
      </VulyoProvider>,
    );
    await waitFor(() => expect(disconnectAttempts).toBe(2));
    expect(window.sessionStorage.getItem("vulyo:step-up:ins_test:user_test")).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("does not resume a sensitive action after a failed OAuth step-up", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/account") && (!init?.method || init.method === "GET")) {
        return Response.json({ hasPassword: false, providers: [{ provider: "google", email: user.email, emailVerified: true }], user });
      }
      if (url.endsWith("/account/sessions")) return Response.json({ activeSessionId: "session_1", sessions: [] });
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetcher);
    window.sessionStorage.setItem("vulyo:step-up:ins_test:user_test", "delete_account");
    window.history.replaceState({}, "", "/account?vulyo_step_up=complete&vulyo_oauth_error=oauth_failed");

    render(<Provider signedIn><UserProfile initialPage="security" /></Provider>);

    expect((await screen.findByRole("alert")).textContent).toContain("No account changes were made");
    expect(window.sessionStorage.getItem("vulyo:step-up:ins_test:user_test")).toBeNull();
    expect(window.location.search).toBe("");
    expect(fetcher.mock.calls.some(([input, init]) => String(input).endsWith("/account") && init?.method === "DELETE")).toBe(false);
  });

  it("shows session lifecycle details and gates account deletion behind a dialog confirmation", async () => {
    const interaction = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/account")) return Response.json({ hasPassword: true, providers: [], user });
      if (url.endsWith("/account/sessions")) return Response.json({
        activeSessionId: "session_1",
        sessions: [{
          id: "session_1",
          deviceLabel: "Chrome on Windows",
          expiresAt: "2026-07-20T10:00:00.000Z",
          lastSeenAt: "2026-07-12T10:00:00.000Z",
          status: "active",
        }],
      });
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetcher);
    const accountConfig = { ...config, account: { allowDeletion: true, allowEmailChange: true } };
    render(<Provider appConfig={accountConfig} signedIn><UserProfile initialPage="security" /></Provider>);

    expect(await screen.findByText(/Chrome on Windows.*This device/u)).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText(/^Last seen /u)).toBeTruthy();
    expect(screen.getByText(/^Expires /u)).toBeTruthy();

    await interaction.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog", { name: "Delete account" });
    const confirmButton = within(dialog).getByRole("button", { name: "Delete account" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    await interaction.type(within(dialog).getByRole("textbox", { name: "Type DELETE to confirm" }), "DELETE");
    expect(confirmButton.disabled).toBe(false);
    expect((await axe(dialog)).violations).toEqual([]);
    await interaction.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete account" })).toBeNull();
  });

  it("keeps the waitlist and signed-in profile free of detectable accessibility violations", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/account")) return Response.json({ hasPassword: true, providers: [], user });
      if (url.endsWith("/account/sessions")) return Response.json({ activeSessionId: "session_1", sessions: [] });
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetcher);

    const waitlist = render(<Provider appConfig={{ ...config, access: { mode: "waitlist", turnstileSiteKey: null } }}><Waitlist /></Provider>);
    expect((await axe(waitlist.container)).violations).toEqual([]);
    waitlist.unmount();

    const profile = render(<Provider signedIn><UserProfile /></Provider>);
    await screen.findByRole("button", { name: "Save profile" });
    expect((await axe(profile.container)).violations).toEqual([]);
  });
});
