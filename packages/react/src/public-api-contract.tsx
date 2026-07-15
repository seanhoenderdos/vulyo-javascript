import type { VulyoProviderProps } from "./provider.js";
import type { SignInProps } from "./components/sign-in.js";
import type { SignUpProps } from "./components/sign-up.js";
import type { WaitlistProps } from "./components/waitlist.js";
import type { UserButtonProps } from "./components/user-button.js";
import type { UserProfileProps } from "./components/user-profile.js";

const provider: VulyoProviderProps = { publishableKey: "pk_test", children: null };
const signIn: SignInProps = { signUpUrl: "/sign-up", waitlistUrl: "/waitlist" };
const signUp: SignUpProps = { signInUrl: "/sign-in" };
const waitlist: WaitlistProps = { signInUrl: "/sign-in" };
const userButton: UserButtonProps = { showName: true, userProfileMode: "modal" };
const userProfile: UserProfileProps = { initialPage: "security", afterDeleteUrl: "/" };
void [provider, signIn, signUp, waitlist, userButton, userProfile];

// @ts-expect-error Product policy must come from app-instance configuration.
const invalidSignIn: SignInProps = { applicationName: "Override" };
// @ts-expect-error Public providers may not bypass the first-party proxy with a direct API URL.
const invalidProvider: VulyoProviderProps = { publishableKey: "pk_test", children: null, apiUrl: "https://api.example" };
// @ts-expect-error Waitlist branding must come from app-instance configuration.
const invalidWaitlist: WaitlistProps = { logoUrl: "https://example.test/logo.png" };
// @ts-expect-error Enabled identifiers come from app-instance configuration.
const invalidSignUp: SignUpProps = { authMethods: { email: false } };
// @ts-expect-error User profile does not accept arbitrary product copy.
const invalidProfile: UserProfileProps = { title: "Account" };
void [invalidSignIn, invalidProvider, invalidWaitlist, invalidSignUp, invalidProfile];
