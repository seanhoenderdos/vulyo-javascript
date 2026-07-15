import { VulyoProvider } from "@vulyo/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <VulyoProvider
          publishableKey={process.env.NEXT_PUBLIC_VULYO_PUBLISHABLE_KEY ?? "pk_test_demo"}
          proxyUrl="/api/vulyo"
        >
          {children}
        </VulyoProvider>
      </body>
    </html>
  );
}
