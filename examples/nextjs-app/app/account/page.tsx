import { UserButton, UserProfile } from "@vulyo/nextjs";

export default function AccountPage() {
  return (
    <main>
      <UserButton showName userProfileUrl="/account" />
      <UserProfile />
    </main>
  );
}
