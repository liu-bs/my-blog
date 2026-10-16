#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  ".next",
  "tsconfig.tsbuildinfo",
  ...(process.argv.includes("--all") ? [".e2e-shots", "debug.log"] : []),
];

let removed = 0;
for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) continue;
  try {
    rmSync(abs, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
    console.log(`removed ${rel}`);
    removed++;
  } catch (err) {
    console.warn(`failed to remove ${rel}: ${err?.code ?? err}`);
  }
}

if (removed === 0) console.log("nothing to clean");
