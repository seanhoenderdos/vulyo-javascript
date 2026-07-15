import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packages = ["packages/core", "packages/react", "packages/nextjs"];
const forbiddenPaths = [
  /(?:^|\/)\.env(?:\.|$)/u,
  /(?:^|\/)src\/(?:billing|email|entitlements|security|webhooks|workspaces)(?:\/|$)/u,
  /(?:^|\/)apps(?:\/|$)/u,
  /(?:^|\/)workers(?:\/|$)/u,
];
const forbiddenText = [
  "PAYSTACK_SECRET_KEY",
  "DATABASE_URL",
  "RESEND_API_KEY",
  "VULYO_SECRET_ENCRYPTION_KEY",
  "api/webhooks/paystack",
];

for (const packageDirectory of packages) {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: resolve(packageDirectory),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const [manifest] = JSON.parse(output);
  if (!manifest?.files?.length) throw new Error(`${packageDirectory} produced an empty package.`);

  for (const entry of manifest.files) {
    const normalized = entry.path.replaceAll("\\", "/");
    if (forbiddenPaths.some((pattern) => pattern.test(normalized))) {
      throw new Error(`${packageDirectory} would publish forbidden path: ${normalized}`);
    }
  }

  const packageJson = readFileSync(resolve(packageDirectory, "package.json"), "utf8");
  for (const value of forbiddenText) {
    if (packageJson.includes(value)) throw new Error(`${packageDirectory} manifest contains forbidden text: ${value}`);
  }
}

console.log("Verified public contents for @vulyo/core, @vulyo/react, and @vulyo/nextjs.");
