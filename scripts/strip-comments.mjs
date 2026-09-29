#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, "..");

const KEEP_PREFIXES = ["eslint-disable", "eslint-enable", "@ts-"];

function blockCommentBodyHasKeepDirective(raw) {
  const body = raw.replace(/^\/\*+/, "").replace(/\*+\/$/, "");
  const lines = body.split(/\r?\n/);
  for (const ln of lines) {
    const trimmed = ln.replace(/^\s*\*/, "").trim();
    if (!trimmed) continue;
    if (KEEP_PREFIXES.some((p) => trimmed.startsWith(p))) return true;
  }
  return false;
}

function lineCommentTextHasKeepDirective(text) {
  return KEEP_PREFIXES.some((p) => text.startsWith(p));
}

function scanJsComments(src) {
  const ranges = [];
  let i = 0;
  const n = src.length;

  let prevSig = null;
  const isRegexStart = () => {
    if (prevSig === null) return true;

    return !/[A-Za-z0-9_$)\]'"`]/.test(prevSig);
  };

  while (i < n) {
    const ch = src[i];

    if (ch === "/" && src[i + 1] === "/") {
      const start = i;
      let j = i + 2;

      while (j < n && src[j] !== "\n" && src[j] !== "\r") j++;
      const text = src.slice(start + 2, j).trimStart();
      if (!lineCommentTextHasKeepDirective(text)) {
        ranges.push({ start, end: j, isBlock: false });
      }
      i = j;
      continue;
    }

    if (ch === "/" && src[i + 1] === "*") {
      const start = i;
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(j + 2, n);
      const raw = src.slice(start, j);
      if (!blockCommentBodyHasKeepDirective(raw)) {
        ranges.push({ start, end: j, isBlock: true });
      }
      i = j;
      prevSig = "/";
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) {
          j++;
          break;
        }
        if (src[j] === "\n" && quote !== "`") {
          break;
        }
        j++;
      }
      i = j;
      prevSig = quote;
      continue;
    }

    if (ch === "`") {
      let j = i + 1;
      let depth = 0;
      while (j < n) {
        const c = src[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === "$" && src[j + 1] === "{") {
          depth++;
          j += 2;
          continue;
        }
        if (c === "}" && depth > 0) {
          depth--;
          j++;
          continue;
        }
        if (c === "`" && depth === 0) {
          j++;
          break;
        }
        j++;
      }
      i = j;
      prevSig = "`";
      continue;
    }

    if (ch === "/" && isRegexStart()) {
      let j = i + 1;
      let inClass = false;
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
          break;
        }
        if (c === "\n") break;
        j++;
      }
      i = j;
      prevSig = "/";
      continue;
    }

    if (!/\s/.test(ch)) prevSig = ch;
    i++;
  }

  return ranges;
}

function scanCssComments(src) {
  const ranges = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) {
          j++;
          break;
        }
        if (src[j] === "\n") break;
        j++;
      }
      i = j;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const start = i;
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(j + 2, n);
      const raw = src.slice(start, j);
      if (!blockCommentBodyHasKeepDirective(raw)) {
        ranges.push({ start, end: j, isBlock: true });
      }
      i = j;
      continue;
    }
    i++;
  }
  return ranges;
}

function applyRanges(src, ranges) {
  if (ranges.length === 0) return src;
  ranges.sort((a, b) => b.start - a.start);
  let out = src;
  for (const r of ranges) {
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  return collapseBlankLines(out);
}

function collapseBlankLines(src) {
  src = src.replace(/^[ \t]*\{\}[ \t]*$/gm, "");
  const lines = src.split(/\r?\n/);
  const result = [];
  let blankRun = 0;
  for (const ln of lines) {
    if (ln.trim() === "") {
      blankRun++;
      continue;
    }
    if (blankRun > 0 && result.length > 0) {
      result.push("");
    }
    blankRun = 0;
    result.push(ln);
  }
  while (result.length > 0 && result[result.length - 1].trim() === "") result.pop();
  return result.length === 0 ? "" : result.join("\n") + "\n";
}

const EXT_LANG = {
  ".ts": "js",
  ".tsx": "js",
  ".js": "js",
  ".jsx": "js",
  ".mjs": "js",
  ".mts": "js",
  ".cjs": "js",
  ".css": "css",
  ".prisma": "js",
  ".yml": "hash",
  ".yaml": "hash",
  ".toml": "hash",
};

function scanHashComments(src) {
  const ranges = [];
  let offset = 0;
  for (const ln of src.split("\n")) {
    if (/^[ \t]*#/.test(ln)) {
      ranges.push({ start: offset, end: offset + ln.length + 1, isBlock: false });
    }
    offset += ln.length + 1;
  }
  return ranges;
}

function listGitFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: FRONTEND_DIR,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .map((f) => path.join(FRONTEND_DIR, f));
}

function collectFiles(roots) {
  const all = listGitFiles();
  if (!roots) return all.filter((f) => path.extname(f) in EXT_LANG);

  return all.filter(
    (f) => roots.some((r) => f === r || f.startsWith(r + path.sep)) && path.extname(f) in EXT_LANG,
  );
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const force = args.includes("--yes");
  const positional = args.filter((a) => !a.startsWith("--"));
  const roots = positional[0] ? [path.resolve(FRONTEND_DIR, positional[0])] : null;
  const files = collectFiles(roots);

  if (!checkOnly && !positional[0] && !force) {
    console.error(
      "全量 strip 会删除所有 git 未忽略代码文件的注释（仅保留 eslint-disable/@ts- 功能指令）。\n" +
        "这是破坏性操作，确认请加 --yes；先预览用 --check；单文件操作直接传路径。",
    );
    process.exit(1);
  }

  let changed = 0;
  let untouched = 0;
  let totalRangesRemoved = 0;

  for (const file of files) {
    const ext = path.extname(file);
    const lang = EXT_LANG[ext];
    if (!lang) continue;
    const src = fs.readFileSync(file, "utf8");
    const ranges =
      lang === "css"
        ? scanCssComments(src)
        : lang === "hash"
          ? scanHashComments(src)
          : scanJsComments(src);
    const stripped = applyRanges(src, ranges);

    totalRangesRemoved += ranges.length;

    if (stripped !== src) {
      changed++;
      if (!checkOnly) fs.writeFileSync(file, stripped, "utf8");
    } else {
      untouched++;
    }
  }

  console.log(`\n=== strip-comments ${checkOnly ? "[check mode]" : "[write mode]"} ===`);
  console.log(`扫描文件数: ${files.length}`);
  console.log(`改动文件数: ${changed}`);
  console.log(`未改动文件数: ${untouched}`);
  console.log(`删除注释块数: ${totalRangesRemoved}`);
  if (checkOnly) {
    console.log(`\n提示：去掉 --check 参数执行写入。`);
  } else {
    console.log(`\n下一步建议：pnpm typecheck && pnpm lint && pnpm build`);
  }
}

main();
