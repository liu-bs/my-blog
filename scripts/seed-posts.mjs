#!/usr/bin/env node

import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./lib/cross-platform.mjs";

const sql = neon(await requireDatabaseUrl("node scripts/seed-posts.mjs"));

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const AUTHOR_NAME = "慢半拍";

const pexels = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600&h=686&fit=crop`;

const POSTS = [
  {
    coverImage: pexels(831552),
    title: "傍晚六点半，沿河走一段",
    summary:
      "下班后没直接回家，顺着河道走了四十分钟。风把白天的燥热吹散了，也把脑子里那些没头没尾的念头吹散了一些。",
    category: "生活",
    tags: ["散步", "傍晚", "慢生活"],
    publishedAt: now - 2 * DAY,
    views: 34,
    content: `下班时天还亮着，于是没直接回家，顺着河道往北走。

## 风

白天积在楼宇之间的热气，一到河边就散了。水面是暗的，天是暖的，两种颜色贴在一起，中间那条线很安静。

走到第三座桥的时候，想起上午那个没解决的报错。奇怪的是，站在这里再看它，忽然觉得没那么严重——大概是因为河不会因为一个 bug 停下来。

## 关于"慢"

朋友说这个博客名字取得好，"慢半拍"。其实当初只是觉得，花时间写下来的东西，总要等一段时间才知道值不值得。

- 走得慢，才看得见岸边那排树是什么时候变黄的
- 写得慢，句子才有机会被删掉两遍
- 活得慢，才不至于把一整天过成一条待办清单

## 回去的路上

买了瓶水，坐在便利店的台阶上喝完。

明天想去旧书店，随便翻翻。`,
  },
  {
    coverImage: pexels(5135437),
    title: "雨天的旧书店，和一本没买的书",
    summary: "本来只想躲雨，结果在书架前站了半小时。最后什么都没买，但记住了那本书的位置。",
    category: "阅读",
    tags: ["书店", "雨天", "读书"],
    publishedAt: now - 9 * DAY,
    views: 21,
    content: `雨下得比预报早。拐进巷子的时候，看见那家旧书店还开着。

## 躲雨的人

店里只有老板和一只猫。我把伞收在门口，水顺着伞骨滴在水泥地上，声音很规律。

书架是按类别排的，但显然没人认真维护过——诗集里夹着一本讲建筑的书，哲学那一排有本菜谱。

## 那本书

在靠窗的第三格，一本薄薄的散文集，封面已经卷边了。翻了两页，作者写他小时候在江边捡石头。

就是那种，你读第一句就知道自己会喜欢，但又说不清为什么的书。

我没买。原因说不上来，可能因为当时身上只有手机，也可能因为觉得它应该再等一等——等一个更合适把它带回家的下午。

## 记下来

回来之后我在备忘录里写：

> 靠窗第三格，深绿色封面，讲江边捡石头的那本。

万一以后想起来了呢。

雨停的时候天已经黑了，猫还在原来的位置。`,
  },
  {
    coverImage: pexels(34260873),
    title: "读得慢一点，其实没关系",
    summary:
      "以前总给自己定「一个月四本」的指标，后来发现真正留下来的，是那些读完之后还在脑子里转了好几天的书。",
    category: "阅读",
    tags: ["读书笔记", "习惯"],
    publishedAt: now - 21 * DAY,
    views: 47,
    content: `年初列了个书单，二十本，打算年底验收。现在十一月了，读完七本。

## 指标是怎么失效的

前两年读书像在打卡：划重点、做笔记、写摘要，一本接一本。后来发现一个尴尬的事实——真正记得住的，反而是那些读得最慢的。

有一本讲城市史的书，我读了将近两个月。每天中午看十几页，看完一章就放着，隔几天再回头翻。它现在还在我书架最顺手的位置，因为总要拿出来对一对。

## 慢的好处

**一是会重读。** 读得慢，就会在同一个句子上停两次，第二次常常看到第一次漏掉的东西。

**二是不急着评价。** 快读的时候，读完一章第一反应是"这章讲什么"；慢读的时候，第一反应变成"这跟我有什么关系"。

**三是允许放弃。** 一本读了三十页还进不去的书，我会直接放下。以前觉得这是浪费，现在觉得这是诚实地对待时间。

## 现在的做法

不再定数量指标，改成三条：

1. 床头只放一本
2. 划线的句子当天抄一遍
3. 读不下去就放下，不欠谁的

今年大概读不完十本。但书架上"总拿出来对一对"的那些，变多了。`,
  },
];

function generateId() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${Date.now()}-${hex}`;
}

const remove = process.argv.includes("--remove");

if (remove) {
  const titles = POSTS.map((p) => p.title);
  const rows = await sql`DELETE FROM posts WHERE title = ANY(${titles}) RETURNING id, title`;
  console.log(`removed ${rows.length} post(s):`);
  rows.forEach((r) => console.log(`  - ${r.title}`));
  process.exit(0);
}

const existing = await sql`SELECT title FROM posts WHERE title = ANY(${POSTS.map((p) => p.title)})`;
const existingTitles = new Set(existing.map((r) => r.title));

let inserted = 0;
for (const p of POSTS) {
  if (existingTitles.has(p.title)) {
    console.log(`skip (already exists): ${p.title}`);
    continue;
  }
  const id = generateId();
  const createdAt = new Date(p.publishedAt - 3 * 60 * 60 * 1000);
  const publishedAt = new Date(p.publishedAt);
  const updatedAt = publishedAt;

  await sql`
    INSERT INTO posts (
      id, title, summary, content, category, tags,
      created_at, updated_at, published_at,
      is_draft, pinned, cover_image, author_id, author_name,
      views, likes, favorites, comments_count
    ) VALUES (
      ${id}, ${p.title}, ${p.summary}, ${p.content}, ${p.category}, ${p.tags},
      ${createdAt}, ${updatedAt}, ${publishedAt},
      false, false, ${p.coverImage}, NULL, ${AUTHOR_NAME},
      ${p.views}, 0, 0, 0
    )
  `;
  inserted++;
  console.log(`inserted: ${p.title}`);
  console.log(`          /posts/${encodeURIComponent(id)}`);
  console.log(`          cover ${p.coverImage}`);
}

console.log(`\ndone. inserted ${inserted}, skipped ${POSTS.length - inserted}`);
