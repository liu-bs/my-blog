#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const passthrough = process.argv.slice(2);
const wantsServer = passthrough.includes("--server") || passthrough.includes("--port");
const args = [
  "experimental-analyze",

  ...(wantsServer ? passthrough.filter((a) => a !== "--server") : ["-o", ...passthrough]),
];

const child = spawn(process.execPath, [nextBin, ...args], { stdio: "inherit" });
child.on("close", (code) => process.exit(code ?? 0));
