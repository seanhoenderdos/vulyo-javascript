import { currentUser, Protect, requireAuth } from "@vulyo/nextjs";

export default async function DashboardPage() {
  await requireAuth();
  const user = await currentUser();

  return (
    <main>
      <h1>Dashboard</h1>
      <p>{user?.email}</p>
      <Protect feature="advanced_reports" fallback={<p>Upgrade to access advanced reports.</p>}>
        <section>Advanced reports</section>
      </Protect>
    </main>
  );
}
