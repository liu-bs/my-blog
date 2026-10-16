#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromiumArgs, findChromium, sleep } from "./lib/cross-platform.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const DEBUG_PORT = 9333;
const SHOT_DIR = path.resolve(".e2e-shots");

const EMAIL_PREFIX = process.env.E2E_EMAIL_PREFIX ?? "e2e-test-";
const TITLE_PREFIX = process.env.E2E_TITLE_PREFIX ?? "E2E-TEST-";
const PASSWORD = "E2eTest!23456";

const T_REGISTER = "\u6ce8\u518c";
const T_LOGIN = "\u767b\u5f55";
const T_PUBLISH = "\u53d1\u5e03";
const T_LIKE = "\u70b9\u8d5e";
const T_FAVORITE = "\u6536\u85cf";
const T_COMMENT_BODY = "E2E comment body";

const stamp = Date.now().toString(36);
const AUTHOR = {
  email: `${EMAIL_PREFIX}author-${stamp}@example.com`,
  username: `e2e_author_${stamp}`.slice(0, 30),
  firstName: "E2E-Author",
};
const VIEWER = {
  email: `${EMAIL_PREFIX}viewer-${stamp}@example.com`,
  username: `e2e_viewer_${stamp}`.slice(0, 30),
  firstName: "E2E-Viewer",
};
const TITLE = `${TITLE_PREFIX}${stamp}`;
const BODY = [
  "# E2E heading",
  "",
  "**bold** and `code`",
  "",
  "<script>alert(1)</script>",
  "",
  "<img src=x onerror=alert(2)>",
  "",
  "```js",
  "const a = 1;",
  "```",
].join("\n");

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
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = c.#pending.get(msg.id);
        if (p) {
          c.#pending.delete(msg.id);
          if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
          else p.res(msg.result);
        }
      } else if (msg.method) {
        (c.#listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
      }
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
    const arr = this.#listeners.get(method) ?? [];
    arr.push(fn);
    this.#listeners.set(method, arr);
  }

  close() {
    try {
      this.#ws.close();
    } catch {}
  }
}

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` - ${detail}` : ""}`);
};
const skip = (name, why) => console.log(`  [SKIP] ${name} - ${why}`);

async function main() {
  const browserPath = await findChromium();

  const userDataDir = mkdtempSync(path.join(tmpdir(), "e2e-w-"));
  mkdirSync(SHOT_DIR, { recursive: true });

  console.log(`browser: ${browserPath}`);
  console.log(`target : ${BASE}`);
  console.log(`author : ${AUTHOR.email}`);
  console.log(`viewer : ${VIEWER.email}`);
  console.log(`post   : ${TITLE}\n`);

  const chrome = spawn(
    browserPath,
    [...chromiumArgs({ port: DEBUG_PORT, userDataDir, windowSize: "1440,1000" }), "about:blank"],
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
  if (!version) throw new Error("CDP not ready");

  const cdp = await Cdp.attach(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

  let consoleErrors = [];
  let pageExceptions = [];
  cdp.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error")
      consoleErrors.push((p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" "));
  });
  cdp.on("Runtime.exceptionThrown", (p) =>
    pageExceptions.push(
      p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "?",
    ),
  );

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails).slice(0, 300));
    return result.value;
  };

  const goto = async (url, wait = 1500) => {
    consoleErrors = [];
    pageExceptions = [];
    const wantPath = new URL(url).pathname;
    for (let attempt = 0; attempt < 3; attempt++) {
      await cdp.send("Page.navigate", { url }, sessionId);
      await new Promise((res) => {
        const t = setTimeout(res, 20000);
        cdp.on("Page.loadEventFired", () => {
          clearTimeout(t);
          res();
        });
      });
      await sleep(wait);

      const nowPath = await evaluate(`location.pathname`);
      if (nowPath === wantPath) return;
      console.log(`    (goto ${wantPath} -> landed on ${nowPath}, retrying)`);
    }
  };

  const shot = async (name) => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
    writeFileSync(path.join(SHOT_DIR, `${name}.png`), Buffer.from(data, "base64"));
  };

  const waitFor = async (expression, timeoutMs = 15000, label = expression) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await evaluate(expression)) return true;
      await sleep(300);
    }
    console.log(`    (timeout waiting: ${label})`);
    return false;
  };

  const waitForSelector = async (selector, timeoutMs = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return true;
      await sleep(250);
    }
    return false;
  };

  const fillSel = async (selector, value) => {
    if (!(await waitForSelector(selector, 10000))) {
      throw new Error(`element not found: ${selector}`);
    }
    const ok = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!ok) throw new Error(`element not found: ${selector}`);
  };

  const fillAny = async (candidates, value) => {
    for (const sel of candidates) {
      if (await waitForSelector(sel, 10000)) {
        await fillSel(sel, value);
        return sel;
      }
    }
    throw new Error(`none of the candidates exist: ${candidates.join(" | ")}`);
  };

  const EMAIL_SEL = ["input[name=email]", "#email", "input[type=email]"];
  const PASS_SEL = ["input[name=password]", "#password", "input[type=password]"];

  const register = async (user) => {
    await goto(`${BASE}/register`, 2500);
    const probe = await evaluate(`(() => JSON.stringify({
      url: location.href,
      path: location.pathname,
      title: document.title,
      inputs: [...document.querySelectorAll('input')].map(e => e.name || e.id || e.type),
      textareas: document.querySelectorAll('textarea').length,
      bodyHead: document.body.innerText.slice(0, 200),
    }))()`);
    console.log(`    [register probe] ${probe}`);
    await fillAny(["input[name=firstName]", "#firstName"], user.firstName);
    await fillAny(["input[name=username]", "#username"], user.username);
    await fillAny(EMAIL_SEL, user.email);
    await fillAny(PASS_SEL, PASSWORD);
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')]
        .find((e) => (e.innerText || '').includes(${JSON.stringify(T_REGISTER)}));
      if (b) { b.click(); return true; } return false;
    })()`);
    await sleep(3000);

    const p = await evaluate(`location.pathname`);
    if (p.includes("register") || p.includes("login")) {
      await goto(`${BASE}/login`);
      await fillAny(EMAIL_SEL, user.email);
      await fillAny(PASS_SEL, PASSWORD);
      await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')]
          .find((e) => (e.innerText || '').includes(${JSON.stringify(T_LOGIN)}));
        if (b) { b.click(); return true; } return false;
      })()`);
      await sleep(3000);
    }
    return await evaluate(`location.pathname`);
  };

  const logout = async () => {
    await goto(`${BASE}/`, 2000);

    const opened = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(
        (e) => e.hasAttribute('aria-expanded') && e.hasAttribute('aria-controls'));
      if (!b) return false;
      b.click();
      return true;
    })()`);
    if (!opened) {
      skip("logout", "user menu button not found (may already be logged out)");
      return;
    }
    await sleep(1000);

    const clicked = await evaluate(`(() => {
      const panelId = document.querySelector('button[aria-controls][aria-expanded]')?.getAttribute('aria-controls');
      const scopes = [panelId ? document.getElementById(panelId) : null, document].filter(Boolean);
      for (const scope of scopes) {
        const btn = [...scope.querySelectorAll('button, a')].find((e) =>
          /\\u9000\\u51fa/.test(e.innerText || ''));
        if (btn) { btn.click(); return true; }
      }
      return false;
    })()`);
    if (!clicked) skip("logout", "logout item not found in menu");
    await sleep(3000);
  };

  console.log("1) register test author");
  const authorPath = await register(AUTHOR);
  record("author registered/logged in", !authorPath.includes("register"), authorPath);

  console.log("\n2) write and publish a post");
  await goto(`${BASE}/write`, 2500);
  const onWrite = await evaluate(`location.pathname`);
  record("logged-in user can open /write", onWrite === "/write", onWrite);

  if (onWrite === "/write") {
    await shot("w2-write-page");
    await fillAny(["input#title", "input[name=title]"], TITLE);

    await fillSel("textarea#content, textarea[name=content], textarea", BODY);
    await sleep(1800);
    await shot("w3-write-filled");

    const previewHasScript = await evaluate(
      `!!document.querySelector('.post-content script, .post-content iframe, .post-content object')`,
    );
    record("preview has no <script>/<iframe>/<object> (sanitized)", !previewHasScript);
    const previewHasOnerror = await evaluate(
      `!!document.querySelector('.post-content [onerror], .post-content [onclick]')`,
    );
    record("preview has no inline event handlers (sanitized)", !previewHasOnerror);

    const clickedPublish = await evaluate(`(() => {
      const b = document.querySelector('button[name=intent][value=publish]')
        || [...document.querySelectorAll('button')]
             .find((e) => (e.innerText || '').includes(${JSON.stringify(T_PUBLISH)}));
      if (!b) return false;
      b.click();
      return true;
    })()`);
    record("publish button found and clicked", clickedPublish);

    const published = await waitFor(
      `location.pathname.startsWith('/posts/')`,
      30000,
      "navigate to post detail after publish",
    );
    record(
      "publish succeeded (redirected to detail)",
      published,
      await evaluate(`location.pathname`),
    );

    if (!published) {
      const diag = await evaluate(`(() => {
        const errs = [...document.querySelectorAll('[role=alert], .text-state-error')]
          .map((e) => (e.innerText || '').trim()).filter(Boolean);
        const invalid = [...document.querySelectorAll('[aria-invalid=true], [aria-invalid="true"]')]
          .map((e) => e.name || e.id).filter(Boolean);
        return JSON.stringify({
          errors: errs.slice(0, 5),
          invalidFields: invalid.slice(0, 5),
          titleValue: (document.querySelector('input#title') || {}).value,
          categoryValue: (document.querySelector('select#category') || {}).value,
          contentLen: ((document.querySelector('textarea#content, textarea[name=content]') || {}).value || '').length,
          toast: [...document.querySelectorAll('[data-sonner-toast], li[data-sonner-toast]')]
            .map((e) => (e.innerText || '').trim()).slice(0, 3),
        });
      })()`);
      console.log(`    diag: ${diag}`);
      await shot("w4-publish-failed");
    }
    await shot("w4-published");
  } else {
    skip("write path", "could not open /write");
  }

  const detailPath = await evaluate(`location.pathname`);
  const postUrl = `${BASE}${detailPath}`;

  console.log("\n3) logout and register second user");
  await logout();
  const afterLogout = await evaluate(`location.pathname`);
  record("logout returned to public page", !afterLogout.includes("write"), afterLogout);

  const viewerPath = await register(VIEWER);
  record("viewer registered/logged in", !viewerPath.includes("register"), viewerPath);

  console.log("\n4) viewer interactions (view / like / favorite / comment)");
  await goto(postUrl, 3000);
  const seenTitle = await evaluate(`document.body.innerText.includes(${JSON.stringify(TITLE)})`);
  record("published post is visible to another user", seenTitle);
  await shot("w5-detail-as-viewer");

  const bodyScriptLeak = await evaluate(
    `!!document.querySelector('#post-content script, #post-content iframe, #post-content [onerror]')`,
  );
  record("server-rendered post body has no script/handler (sanitized)", !bodyScriptLeak);

  const liked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')]
      .find((e) => (e.innerText || '').includes(${JSON.stringify(T_LIKE)}));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await sleep(2500);
  const likeCount = await evaluate(`(() => {
    const m = document.body.innerText.match(/(\\d+)\\s*$/m);
    const t = document.body.innerText.match(/${T_LIKE}\\s*\\u00b7\\s*(\\d+)/);
    return t ? Number(t[1]) : null;
  })()`);
  record("like action worked", liked && likeCount !== null && likeCount >= 1, `likes=${likeCount}`);

  const faved = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')]
      .find((e) => (e.innerText || '').includes(${JSON.stringify(T_FAVORITE)}));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await sleep(2000);
  record(
    "favorite action worked (no exception)",
    faved && pageExceptions.length === 0,
    pageExceptions[0] ?? "",
  );

  await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(3000);
  const commentInputExists = await evaluate(
    `!!document.querySelector('textarea#comment-content, textarea[name=comment]')`,
  );
  if (commentInputExists) {
    await fillSel("textarea#comment-content, textarea[name=comment]", T_COMMENT_BODY);
    await sleep(400);
    const posted = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')]
        .find((e) => /\\u53d1\\u8868|\\u63d0\\u4ea4|\\u8bc4\\u8bba/.test((e.innerText || '').trim()));
      if (!b) return false;
      b.click();
      return true;
    })()`);
    await sleep(3000);
    const hasComment = await evaluate(
      `document.body.innerText.includes(${JSON.stringify(T_COMMENT_BODY)})`,
    );
    record("comment posted successfully", posted && hasComment);
    await shot("w7-commented");
  } else {
    skip("comment section", "textarea not mounted (IntersectionObserver/scroll)");
  }

  console.log("\n5) authenticated pages for viewer");
  await goto(`${BASE}/write`, 2500);
  record("viewer can open own /write", (await evaluate(`location.pathname`)) === "/write");
  await goto(`${BASE}/profile`, 2500);
  record("viewer can open /profile", (await evaluate(`location.pathname`)) === "/profile");
  await shot("w8-profile");
  await goto(`${BASE}/settings`, 2500);
  record("viewer can open /settings", (await evaluate(`location.pathname`)) === "/settings");
  await shot("w9-settings");

  console.log("\n6) author re-login and manage own post");
  await logout();
  await goto(`${BASE}/login`);
  await fillAny(EMAIL_SEL, AUTHOR.email);
  await fillAny(PASS_SEL, PASSWORD);
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')]
      .find((e) => (e.innerText || '').includes(${JSON.stringify(T_LOGIN)}));
    if (b) { b.click(); return true; } return false;
  })()`);
  await sleep(3000);

  await goto(postUrl, 3000);
  const hasDelete = await evaluate(
    `[...document.querySelectorAll('button, a')].some((e) => /\\u5220\\u9664/.test(e.innerText || ''))`,
  );
  record("author sees delete control on own post", hasDelete);

  console.log("\n7) summary");
  const failures = results.filter((r) => !r.ok);
  console.log(
    `\ntotal ${results.length}, PASS ${results.length - failures.length}, FAIL ${failures.length}`,
  );
  if (failures.length) {
    console.log("\nfailed:");
    failures.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  }
  console.log("\ntest data created (for cleanup):");
  console.log(`  author ${AUTHOR.email}`);
  console.log(`  viewer ${VIEWER.email}`);
  console.log(`  post title prefix ${TITLE_PREFIX}`);
  console.log(`screenshots: ${SHOT_DIR}`);

  cdp.close();
  chrome.kill();
  await sleep(400);
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error("write-path E2E failed:", err);
  process.exit(2);
});
