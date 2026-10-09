#!/usr/bin/env node

import { execSync, spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.DEV_PORT || process.env.PORT || 3000);
const argv = process.argv.slice(2);
const freePortOnly = argv.includes("--free-port-only");
const cleanAll = argv.includes("--clean-all");
const isStart = argv.includes("--start");

delete process.env.NODE_ENV;

function pidsOnPort(port) {
  if (process.platform === "win32") {
    try {
      const out = execSync("netstat -ano", { encoding: "utf8" });
      const pids = new Set();
      const re = new RegExp(`:${port}\\s`);
      for (const line of out.split("\n")) {
        const t = line.trim();

        if (t.startsWith("TCP") && re.test(t) && /LISTENING/i.test(t)) {
          const pid = Number(t.split(/\s+/).pop());
          if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) pids.add(pid);
        }
      }
      return [...pids];
    } catch {
      return [];
    }
  }
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    return out
      .split("\n")
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

// Next 16 dev 会在 .next/dev/lock 写入当前 dev server 信息（同项目目录锁，与端口无关），
// 不杀掉它，新的 next dev 会直接报 "Another next dev server is already running" 退出。
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// taskkill / SIGKILL 返回不代表进程已退出；Windows 上句柄晚一拍释放，
// 不等就删 .next 会撞上 ENOTEMPTY。轮询等进程消失（最多 5s）。
function waitForPidExit(pid, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      process.kill(pid, 0);
      sleepSync(150);
    } catch {
      return true;
    }
  }
  return false;
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    return true;
  } catch {
    return false;
  }
}

function killProjectDevServer() {
  let info;
  try {
    info = JSON.parse(readFileSync(path.join(root, ".next", "dev", "lock"), "utf8"));
  } catch {
    return;
  }
  const pid = Number(info?.pid);
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return;
  if (killPid(pid)) {
    waitForPidExit(pid);
    console.log(
      `[dev] 已停止同项目的 dev server（PID: ${pid}${info?.appUrl ? `，${info.appUrl}` : ""}）`,
    );
  }
}

const stale = pidsOnPort(PORT);
if (stale.length > 0) {
  console.log(`[dev] 端口 ${PORT} 被残留进程占用（PID: ${stale.join(", ")}），正在清理...`);
  for (const pid of stale) {
    try {
      if (killPid(pid)) waitForPidExit(pid);
    } catch {}
  }
  console.log(`[dev] 端口 ${PORT} 已释放`);
} else if (freePortOnly) {
  console.log(`[dev] 端口 ${PORT} 当前空闲，无需处理`);
}

if (freePortOnly) process.exit(0);

killProjectDevServer();

if (!isStart) {
  const abs = path.join(root, ".next");
  // Windows 上刚写完的 .next 文件会被 Defender/索引服务短暂握住，rmSync 会间歇性
  // ENOTEMPTY；死循环重试会反复全量遍历巨大的 .next，这里给 6s 总预算，超了就放行
  //（Next 启动后自愈，已实测无碍）。
  const budgetMs = 6000;
  const startMs = Date.now();
  for (;;) {
    try {
      rmSync(abs, { recursive: true, force: true, maxRetries: 1, retryDelay: 50 });
      console.log("[dev] 已清理 .next");
      break;
    } catch (err) {
      if (Date.now() - startMs > budgetMs) {
        console.warn(
          `[dev] 清理 .next 失败（${err?.code ?? "UNKNOWN"}）：${err?.message ?? err}\n` +
            "[dev] 请确认没有其它 dev server / next start 正在运行；HMR 若异常，重启 dev 即可恢复",
        );
        break;
      }
      sleepSync(400);
    }
  }
}

if (cleanAll) process.exit(0);

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const passthrough = argv.filter(
  (a) => a !== "--free-port-only" && a !== "--clean-all" && a !== "--start",
);

const child = spawn(process.execPath, [nextBin, isStart ? "start" : "dev", ...passthrough], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(PORT) },
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
child.on("close", (code) => process.exit(code ?? 0));
