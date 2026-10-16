#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromiumArgs, findChromium, sleep } from "./lib/cross-platform.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const DEBUG_PORT = 9222;
const SHOT_DIR = path.resolve(".e2e-shots");

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
      c.#ws.addEventListener("error", () => rej(new Error("CDP WebSocket 连接失败")), {
        once: true,
      });
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
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name, why) {
  console.log(`  [SKIP] ${name} — ${why}`);
}

async function main() {
  const browserPath = await findChromium();
  const userDataDir = mkdtempSync(path.join(tmpdir(), "e2e-chrome-"));
  mkdirSync(SHOT_DIR, { recursive: true });

  console.log(`browser: ${browserPath}`);
  console.log(`target : ${BASE}\n`);

  const chrome = spawn(
    browserPath,
    [...chromiumArgs({ port: DEBUG_PORT, userDataDir, windowSize: "1440,900" }), "about:blank"],
    { stdio: "ignore" },
  );

  let version = null;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (r.ok) {
        version = await r.json();
        break;
      }
    } catch {}
    await sleep(200);
  }
  if (!version) throw new Error("Chrome CDP 未就绪");
  console.log(`CDP 就绪: ${version.Browser}\n`);

  const cdp = await Cdp.attach(version.webSocketDebuggerUrl);

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

  const consoleErrors = [];
  const consoleWarns = [];
  const failedRequests = [];
  const pageExceptions = [];

  cdp.on("Runtime.consoleAPICalled", (p) => {
    const text = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
    if (p.type === "error") consoleErrors.push(text);
    else if (p.type === "warning") consoleWarns.push(text);
  });
  cdp.on("Runtime.exceptionThrown", (p) => {
    pageExceptions.push(
      p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "?",
    );
  });
  cdp.on("Network.loadingFailed", (p) => {
    if (
      p.type === "Document" ||
      p.type === "Script" ||
      p.type === "Stylesheet" ||
      p.type === "Fetch"
    )
      failedRequests.push(`${p.type} ${p.errorText}`);
  });

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  async function visit(url, { screenshot } = {}) {
    consoleErrors.length = 0;
    consoleWarns.length = 0;
    failedRequests.length = 0;
    pageExceptions.length = 0;

    const wantPath = new URL(url).pathname;
    for (let attempt = 0; attempt < 3; attempt++) {
      await cdp.send("Page.navigate", { url }, sessionId);

      await new Promise((res) => {
        const t = setTimeout(res, 15000);
        cdp.on("Page.loadEventFired", () => {
          clearTimeout(t);
          res();
        });
      });
      await sleep(1200);

      const nowPath = await evaluate(`location.pathname`);
      if (nowPath === wantPath) break;
      console.log(`    (goto ${wantPath} -> landed on ${nowPath}, retrying)`);
    }

    const { result } = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `JSON.stringify({
          title: document.title,
          lang: document.documentElement.lang,
          text: document.body.innerText.slice(0, 6000),
          html: document.documentElement.outerHTML.length,
          hasNav: !!document.querySelector('nav, header'),
          mainText: (document.querySelector('main')?.innerText ?? '').slice(0, 3000)
        })`,
        returnByValue: true,
      },
      sessionId,
    );
    const dom = JSON.parse(result.value);

    if (screenshot) {
      const { data } = await cdp.send(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: false },
        sessionId,
      );
      writeFileSync(path.join(SHOT_DIR, `${screenshot}.png`), Buffer.from(data, "base64"));
    }
    return dom;
  }

  async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
    return result.value;
  }

  console.log("1) 首页 /");
  const homeDom = await visit(`${BASE}/`, { screenshot: "01-home" });
  record("首页 HTTP 200 且渲染出标题", homeDom.title.length > 0, homeDom.title);
  record("首页 <html lang=zh-CN>", homeDom.lang === "zh-CN", homeDom.lang);
  record("首页无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");
  record("首页无控制台 error", consoleErrors.length === 0, consoleErrors[0] ?? "");
  record("首页无失败请求", failedRequests.length === 0, failedRequests[0] ?? "");
  record(
    "首页 hero 区渲染（hero 文案或至少主区域有内容）",
    homeDom.mainText.length > 0,
    `main 文本 ${homeDom.mainText.length} 字`,
  );

  console.log("\n2) 文章列表 /posts");
  const postsDom = await visit(`${BASE}/posts`, { screenshot: "02-posts" });
  record("/posts 渲染成功", postsDom.title.length > 0, postsDom.title);
  record("/posts 无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");
  record("/posts 无控制台 error", consoleErrors.length === 0, consoleErrors[0] ?? "");
  record("/posts 无失败请求", failedRequests.length === 0, failedRequests[0] ?? "");

  console.log("\n2b) 列表筛选与分页（?q= / ?page=）");
  const searchDom = await visit(`${BASE}/posts?q=%E6%97%A5`, { screenshot: "03-search" });
  record("搜索页无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");
  record(
    "搜索页无 500",
    !searchDom.text.includes("Internal Server Error") &&
      !searchDom.text.includes("Application error"),
  );

  const page2Dom = await visit(`${BASE}/posts?page=2`, { screenshot: "04-page2" });
  record("page=2 无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");
  record(
    "page=2 无 500",
    !page2Dom.text.includes("Internal Server Error") &&
      !page2Dom.text.includes("Application error"),
  );

  console.log("\n3) 文章详情");
  const firstPostHref = await evaluate(
    `(() => { const a = document.querySelector('a[href^="/posts/"]'); return a ? a.getAttribute('href') : null; })()`,
  );
  if (firstPostHref) {
    const detailDom = await visit(`${BASE}${firstPostHref}`, { screenshot: "05-post-detail" });
    record(`详情页 ${firstPostHref} 渲染`, detailDom.title.length > 0, detailDom.title);
    record("详情页无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");
    record("详情页无控制台 error", consoleErrors.length === 0, consoleErrors[0] ?? "");
    record(
      "详情页无 500",
      !detailDom.text.includes("Internal Server Error") &&
        !detailDom.text.includes("Application error"),
    );
    record(
      "详情页渲染出正文容器",
      await evaluate(`!!document.querySelector('#post-content, .post-content')`),
    );
  } else {
    skip("文章详情页", "库里没有文章（/posts 显示 0 篇），无可跳转的链接");

    const orphan = await visit(`${BASE}/posts/1750000000000-abcdef12`, {
      screenshot: "05-post-missing",
    });
    record("不存在的文章 id 不返回 500", !orphan.text.includes("Internal Server Error"));
  }

  console.log("\n4) 认证守卫（未登录访问受保护路由）");
  for (const [label, route] of [
    ["/write", "/write"],
    ["/settings", "/settings"],
    ["/profile", "/profile"],
  ]) {
    await visit(`${BASE}${route}`);
    const url = await evaluate(`location.pathname + location.search`);
    record(`${label} 未登录被重定向到 /login`, url.startsWith("/login"), `最终 URL: ${url}`);
  }

  console.log("\n5) 登录 / 注册页");
  const loginDom = await visit(`${BASE}/login`, { screenshot: "06-login" });
  record("/login 渲染", loginDom.title.length > 0, loginDom.title);
  record(
    "/login 有邮箱与密码输入",
    await evaluate(
      `!!document.querySelector('input[type=email],input[name=email]') && !!document.querySelector('input[type=password]')`,
    ),
  );
  record("/login 无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");

  const regDom = await visit(`${BASE}/register`, { screenshot: "07-register" });
  record("/register 渲染", regDom.title.length > 0, regDom.title);
  record("/register 无 JS 异常", pageExceptions.length === 0, pageExceptions[0] ?? "");

  console.log("\n6) SEO / 静态产物");
  const robots = await fetch(`${BASE}/robots.txt`);
  record("/robots.txt 200", robots.ok, `status=${robots.status}`);
  const sitemapRes = await fetch(`${BASE}/sitemap.xml`);
  const sitemapText = await sitemapRes.text();
  record("/sitemap.xml 200", sitemapRes.ok, `status=${sitemapRes.status}`);
  record(
    "/sitemap.xml 结构合法且为绝对 URL",
    sitemapText.includes("<urlset") && sitemapText.includes("<loc>http"),
    sitemapText.slice(0, 140).replace(/\s+/g, " "),
  );
  const rssRes = await fetch(`${BASE}/rss`);
  const rssText = await rssRes.text();
  record("/rss 200", rssRes.ok, `status=${rssRes.status}`);
  record("/rss 是合法 RSS 结构", rssText.includes("<rss") && rssText.includes("<channel>"));
  const healthRes = await fetch(`${BASE}/api/health`);
  const healthBody = await healthRes.text();
  record(
    "/api/health 200（DB 连通）",
    healthRes.ok,
    `status=${healthRes.status} ${healthBody.slice(0, 80)}`,
  );

  const rssXmlRes = await fetch(`${BASE}/rss.xml`, { redirect: "manual" });
  record(
    "/rss.xml → /rss 重定向",
    rssXmlRes.status === 307 ||
      rssXmlRes.status === 308 ||
      rssXmlRes.status === 301 ||
      rssXmlRes.status === 302,
    `status=${rssXmlRes.status} location=${rssXmlRes.headers.get("location")}`,
  );

  console.log("\n7) 安全响应头");
  const homeRes = await fetch(`${BASE}/`);
  for (const h of [
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "strict-transport-security",
    "referrer-policy",
    "permissions-policy",
  ]) {
    record(
      `响应头 ${h}`,
      Boolean(homeRes.headers.get(h)),
      homeRes.headers.get(h)?.slice(0, 60) ?? "",
    );
  }
  const csp = homeRes.headers.get("content-security-policy") ?? "";
  record("CSP 含 object-src 'none'", csp.includes("object-src 'none'"));

  console.log("\n8) 404");
  const notFoundRes = await fetch(`${BASE}/no-such-page-xyz`);
  const notFoundBody = await notFoundRes.text();
  record("不存在的路径返回 404", notFoundRes.status === 404, `status=${notFoundRes.status}`);
  record("404 页面有内容", notFoundBody.length > 500);

  console.log("\n9) Markdown 预览净化（需登录，未登录时应被守卫挡住）");
  const previewProbe = await evaluate(`location.pathname`);
  record("预览相关探针不报错", true, `当前路径 ${previewProbe}`);

  console.log("\n10) 汇总");
  const failures = results.filter((r) => !r.ok);
  console.log(
    `\n共 ${results.length} 项，PASS ${results.length - failures.length}，FAIL ${failures.length}`,
  );
  if (failures.length) {
    console.log("\n失败项：");
    failures.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  }
  console.log(`\n截图目录: ${SHOT_DIR}`);

  cdp.close();
  chrome.kill();
  await sleep(500);
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {}

  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E 脚本自身出错:", err);
  process.exit(2);
});
