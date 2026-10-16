#!/usr/bin/env node

import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./lib/cross-platform.mjs";

const sql = neon(await requireDatabaseUrl("node scripts/e2e-verify.mjs"));

const users = await sql`
  SELECT id, email, username, stats_articles, stats_likes, stats_views
  FROM users WHERE email LIKE 'e2e-test-%' ORDER BY created_at DESC LIMIT 6
`;

const posts = await sql`
  SELECT p.id, p.title, p.views, p.likes, p.favorites, p.comments_count,
         (SELECT count(*) FROM user_post_likes l WHERE l.post_id = p.id)::int AS like_rows,
         (SELECT count(*) FROM user_post_favorites f WHERE f.post_id = p.id)::int AS fav_rows,
         (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_rows
  FROM posts p WHERE p.title LIKE 'E2E-TEST-%' ORDER BY p.created_at DESC LIMIT 6
`;

console.log(`e2e users: ${users.length}`);
for (const u of users) {
  console.log(
    `  ${u.email} articles=${u.stats_articles} likes=${u.stats_likes} views=${u.stats_views}`,
  );
}

console.log(`\ne2e posts: ${posts.length}`);
for (const p of posts) {
  const likesMatch = p.likes === p.like_rows ? "OK" : "DRIFT";
  const favsMatch = p.favorites === p.fav_rows ? "OK" : "DRIFT";
  const commentsMatch = p.comments_count === p.comment_rows ? "OK" : "DRIFT";
  console.log(`  ${p.title}`);
  console.log(
    `    likes counter=${p.likes} rows=${p.like_rows} [${likesMatch}]  ` +
      `favorites counter=${p.favorites} rows=${p.fav_rows} [${favsMatch}]  ` +
      `comments counter=${p.comments_count} rows=${p.comment_rows} [${commentsMatch}]  ` +
      `views=${p.views}`,
  );
}

const drift = posts.filter(
  (p) =>
    p.likes !== p.like_rows || p.favorites !== p.fav_rows || p.comments_count !== p.comment_rows,
);
console.log(
  `\ndenormalized counter drift: ${drift.length === 0 ? "none" : `${drift.length} post(s) DRIFTED`}`,
);
process.exit(drift.length ? 1 : 0);
