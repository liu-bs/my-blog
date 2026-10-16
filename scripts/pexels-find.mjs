#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromiumArgs, findChromium, sleep } from "./lib/cross-platform.mjs";

const DEBUG_PORT = 9444;
const OUT_DIR = path.resolve(".pexels");
const headful = process.argv.includes("--headful");
const queries = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (queries.length === 0) {
  console.error('usage: node scripts/pexels-find.mjs "quiet desk" "old bookstore"');
  console.error("       --headful  用真实窗口跑（Pexels 的 Cloudflare 会拦 headless）");
  process.exit(1);
}

const CHROME = await findChromium();

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();
  static async attach(wsUrl) {
    const c = new Cdp();
    c.#ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      c.#ws.addEventListener("open", res, { once: true });
      c.#ws.addEventListener("error", () => rej(new Error("CDP connect failed")), { once: true });
    });
    c.#ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = c.#pending.get(m.id);
        if (p) {
          c.#pending.delete(m.id);
          if (m.error) p.rej(new Error(JSON.stringify(m.error)));
          else p.res(m.result);
        }
      } else if (m.method) (c.#listeners.get(m.method) ?? []).forEach((f) => f(m.params));
    });
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.#id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.#ws.send(JSON.stringify(payload));
    return new Promise((res, rej) => this.#pending.set(id, { res, rej }));
  }
  on(method, fn) {
    const a = this.#listeners.get(method) ?? [];
    a.push(fn);
    this.#listeners.set(method, a);
  }
  close() {
    try {
      this.#ws.close();
    } catch {}
  }
}

const userDataDir = mkdtempSync(path.join(tmpdir(), "pexels-"));
mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    ...chromiumArgs({
      port: DEBUG_PORT,
      userDataDir,
      headful,
      windowSize: "1600,1200",
    }),
    "--lang=en-US",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let version = null;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (r.ok) {
      version = await r.json();
      break;
    }
  } catch {}
  await sleep(200);
}
if (!version) {
  chrome.kill();
  throw new Error("CDP not ready");
}

const cdp = await Cdp.attach(version.webSocketDebuggerUrl);
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
await cdp.send("Page.enable", {}, sessionId);
await cdp.send("Runtime.enable", {}, sessionId);

const evaluate = async (expr) => {
  const { result, exceptionDetails } = await cdp.send(
    "Runtime.evaluate",
    { expression: expr, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
  return result.value;
};

const collected = {};

for (const q of queries) {
  const url = `https://www.pexels.com/search/${encodeURIComponent(q)}/`;
  console.log(`\n=== "${q}" -> ${url}`);
  await cdp.send("Page.navigate", { url }, sessionId);
  await sleep(6000);

  const title = await evaluate(`document.title`);
  const bodyLen = await evaluate(`document.body.innerText.length`);
  console.log(`    title: ${title}`);
  console.log(`    body text length: ${bodyLen}`);

  const found = await evaluate(`(() => {
    const out = new Map();
    const push = (raw) => {
      if (!raw) return;
      const m = String(raw).match(/images\\.pexels\\.com\\/photos\\/(\\d+)\\/([^?"'\\s]+?)(?:\\.(?:jpe?g|png))?\\?/);
      const m2 = String(raw).match(/images\\.pexels\\.com\\/photos\\/(\\d+)\\/([^?"'\\s]+)/);
      const mm = m || m2;
      if (!mm) return;
      const id = mm[1];
      const slug = mm[2];
      if (!out.has(id)) out.set(id, { id, slug });
    };
    document.querySelectorAll('img').forEach((im) => {
      push(im.getAttribute('src'));
      push(im.getAttribute('srcset'));
    });
    document.querySelectorAll('a[href*="/photo/"]').forEach((a) => push(a.getAttribute('href')));
    return JSON.stringify([...out.values()].slice(0, 24));
  })()`);

  const items = JSON.parse(found || "[]");
  console.log(`    found ${items.length} candidates`);
  items.slice(0, 8).forEach((it) => console.log(`      ${it.id}  ${it.slug}`));
  collected[q] = items;
}

writeFileSync(path.join(OUT_DIR, "candidates.json"), JSON.stringify(collected, null, 2));
console.log(`\nsaved: ${path.join(OUT_DIR, "candidates.json")}`);

cdp.close();
chrome.kill();
await sleep(300);
try {
  rmSync(userDataDir, { recursive: true, force: true });
} catch {}
