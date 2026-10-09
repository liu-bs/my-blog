-- 搜索索引：title ILIKE %q% / content ILIKE %q% 是 %term% 前缀通配，
-- btree 完全用不上，此前每次搜索都是全表扫描。
-- pg_trgm 的 GIN 索引让 ILIKE '%term%' 走索引扫描（对中文子串同样有效，
-- tsvector 分词方案反而处理不了无空格的中文，故选 trgm）。
-- 注意：这两个索引刻意不写进 schema.prisma —— Prisma 无法声明 gin_trgm_ops
-- 操作符类，声明成普通 GIN 反而是个无效索引。若用 prisma db push 同步，
-- 请确认这两个索引仍在（必要时重跑本迁移，语句全部幂等）。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Post_title_trgm_idx"
  ON "Post" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Post_content_trgm_idx"
  ON "Post" USING gin ("content" gin_trgm_ops);
