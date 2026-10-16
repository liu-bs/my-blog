import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return { loaded: false, path: envPath };
  const { config } = await import("dotenv");
  config({ path: envPath, override: false, quiet: true });
  return { loaded: true, path: envPath };
}

export async function requireDatabaseUrl(scriptName) {
  await loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      [
        "缺少 DATABASE_URL。",
        `  1) 在项目根创建 .env.local 并写入 DATABASE_URL=...`,
        `  2) 或直接注入环境变量后重跑：${scriptName}`,
        `  （dotenv 会自动加载 .env.local，不需要 --env-file）`,
      ].join("\n"),
    );
    process.exit(1);
  }
  return url;
}

function chromiumCandidates() {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const out = [];

  if (process.platform === "win32") {
    for (const base of [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
    ]) {
      if (!base) continue;
      out.push(
        path.join(base, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
      );
    }
    return out;
  }

  if (process.platform === "darwin") {
    out.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      path.join(home, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    );
    return out;
  }

  out.push(
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/opt/google/chrome/chrome",
  );
  return out;
}

export async function findChromium() {
  const explicit = process.env.CHROME_PATH ?? process.env.CHROMIUM_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  for (const p of chromiumCandidates()) {
    if (p && existsSync(p)) return p;
  }

  const names =
    process.platform === "win32"
      ? ["chrome.exe", "msedge.exe"]
      : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const name of names) {
    for (const dir of pathDirs) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }

  throw new Error(
    [
      "未找到 Chrome / Chromium / Edge。",
      "  装一个，或用环境变量指定：",
      "    macOS/Linux:  CHROME_PATH=/path/to/chrome node scripts/e2e-check.mjs",
      "    Windows:      set CHROME_PATH=C:\\path\\to\\chrome.exe && node scripts/e2e-check.mjs",
    ].join("\n"),
  );
}

export function chromiumArgs({ port, userDataDir, headful = false, windowSize = "1440,900" }) {
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    `--window-size=${windowSize}`,
  ];
  if (!headful) args.unshift("--headless=new", "--disable-gpu");

  if (process.platform === "linux") args.push("--no-sandbox", "--disable-dev-shm-usage");
  return args;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
