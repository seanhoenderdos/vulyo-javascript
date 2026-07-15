import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const packages = ["packages/core", "packages/react", "packages/nextjs"];

for (const packageDirectory of packages) {
  execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", "await import('./dist/index.js')"],
    {
      cwd: resolve(packageDirectory),
      stdio: "inherit",
    },
  );
}

console.log("Verified runtime imports for all public Vulyo packages.");
