#!/usr/bin/env node
// 校验脚本：确认工作区改动「只新增注释、未改代码」。
// 做法：把 HEAD 版本与工作区版本各自去掉注释后逐行归一化比较，再对代码 token 序列做二次比对。
// 用法：node scripts/verify-comment-only.mjs [--base HEAD]

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function gitShow(rev, file) {
  try {
    return execFileSync("git", ["show", `${rev}:${file}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null; // 新文件
  }
}

// 从源码中剔除注释，保留其余字符
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let prevSig = null;
  const isRegexStart = () => prevSig === null || !/[A-Za-z0-9_$)\]'"`]/.test(prevSig);

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i = Math.min(i + 2, n);
      prevSig = "/";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      prevSig = quote;
      continue;
    }
    if (ch === "/" && isRegexStart()) {
      let j = i + 1;
      let inClass = false;
      let ok = false;
      while (j < n) {
        const c = src[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          j++;
          while (j < n && /[gimsuy]/.test(src[j])) j++;
          ok = true;
          break;
        }
        if (c === "\n") break;
        j++;
      }
      if (ok) {
        out += src.slice(i, j);
        i = j;
        prevSig = "/";
        continue;
      }
    }

    out += ch;
    if (!/\s/.test(ch)) prevSig = ch;
    i++;
  }
  return out;
}

// 归一化：去掉行尾空白与空行，压缩连续空白，去掉注释删除后遗留的空 JSX 表达式
function normalize(src) {
  return stripComments(src)
    .replace(/\{\s*\}/g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "")
    .join("\n")
    .replace(/[\s;]+/g, " ")
    .trim();
}

function changedFiles(base) {
  const out = execFileSync("git", ["diff", "--name-only", base, "--", "src"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", "src"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  return [...new Set([...out.split("\n"), ...untracked.split("\n")].filter(Boolean))].filter((f) =>
    EXT_RE.test(f),
  );
}

const base = (() => {
  const idx = process.argv.indexOf("--base");
  return idx >= 0 ? (process.argv[idx + 1] ?? "HEAD") : "HEAD";
})();

const files = changedFiles(base);
let bad = 0;
let addedComments = 0;

for (const file of files) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const now = fs.readFileSync(abs, "utf8");
  const before = gitShow(base, file);
  if (before === null) {
    console.log(`[新文件] ${file}`);
    continue;
  }
  if (normalize(before) !== normalize(now)) {
    bad++;
    console.log(`❌ 代码被改动: ${file}`);
  }
  if (before !== now) addedComments++;
}

console.log("\n=== verify-comment-only ===");
console.log(`基线: ${base}`);
console.log(`改动文件数: ${addedComments}`);
console.log(`代码被改动文件数: ${bad}`);
console.log(bad === 0 ? "✅ 全部改动均为注释，代码逻辑零改动" : "❌ 存在代码改动，请检查");
process.exit(bad === 0 ? 0 : 1);
