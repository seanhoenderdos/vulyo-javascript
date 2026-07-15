import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = findAncestorWithFile(appRoot, "pnpm-workspace.yaml") ?? appRoot;

const nextConfig: NextConfig = {
  transpilePackages: ["@vulyo/core", "@vulyo/react", "@vulyo/nextjs"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;

function findAncestorWithFile(start: string, file: string) {
  let directory = start;
  while (true) {
    if (existsSync(resolve(directory, file))) return directory;
    const parent = dirname(directory);
    if (parent === directory || directory === parse(directory).root) return null;
    directory = parent;
  }
}
