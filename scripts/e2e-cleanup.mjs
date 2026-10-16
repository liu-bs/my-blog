#!/usr/bin/env node

import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./lib/cross-platform.mjs";

const EMAIL_LIKE = "e2e-test-%";
const TITLE_LIKE = "E2E-TEST-%";
const dryRun = process.argv.includes("--dry-run");

const sql = neon(await requireDatabaseUrl("node scripts/e2e-cleanup.mjs"));

const targets = await sql`
  SELECT id, email, username FROM users WHERE email LIKE ${EMAIL_LIKE} ORDER BY created_at
`;
const posts = await sql`
  SELECT id, title, author_id FROM posts WHERE title LIKE ${TITLE_LIKE} ORDER BY created_at
`;

console.log(`匹配到测试用户 ${targets.length} 个：`);
targets.forEach((u) => console.log(`  - ${u.email} (${u.username})`));
console.log(`匹配到测试文章 ${posts.length} 篇：`);
posts.forEach((p) => console.log(`  - ${p.title}`));

if (dryRun) {
  console.log("\n--dry-run：未做任何删除");
  process.exit(0);
}

if (targets.length === 0 && posts.length === 0) {
  console.log("\n没有需要清理的数据");
  process.exit(0);
}

const deletedPosts = await sql`
  DELETE FROM posts WHERE title LIKE ${TITLE_LIKE} RETURNING id
`;
const deletedUsers = await sql`
  DELETE FROM users WHERE email LIKE ${EMAIL_LIKE} RETURNING id
`;

console.log(`\n已删除：文章 ${deletedPosts.length} 篇，用户 ${deletedUsers.length} 个`);
