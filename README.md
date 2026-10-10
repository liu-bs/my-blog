# my-blog — 慢半拍

基于 Next.js 16 App Router 的全栈中文博客：服务端渲染（PPR + `use cache`），写作后台与读者交互（评论、点赞、收藏、浏览计数）。单语中文，不做多语言，URL 无语言前缀。

## 技术栈

| 领域     | 选型                                                                     |
| -------- | ------------------------------------------------------------------------ |
| 框架     | Next.js 16.3（App Router、PPR、`cacheComponents`）+ React 19.3           |
| 语言     | TypeScript 5.9 严格模式（`noUnusedLocals` / `noUncheckedIndexedAccess`） |
| 样式     | Tailwind CSS 4.3 + 手写 utility（`src/app/styles/*.css`）                |
| 数据库   | PostgreSQL（Neon Serverless）+ Prisma 6.19（`@prisma/adapter-neon`）     |
| 认证     | JWT（httpOnly Cookie + `tokenVersion` 失效）+ bcryptjs                   |
| 内容渲染 | marked + marked-highlight + highlight.js + sanitize-html（白名单清洗）   |
| 校验     | zod 4，且只允许 `zod/mini` 子路径（ESLint 强制）                         |
| 其他     | next-themes、sonner、lucide-react                                        |

## 目录与服务端分层

```
src/
├── app/              # 路由层：(home)/(auth)/(dashboard) 路由组、posts、api、rss、sitemap、robots
├── components/       # auth / dashboard / post / shell / skeletons / ui
├── config/site.ts    # 站点常量：SITE_URL、PROTECTED_ROUTES、分页尺寸、图片白名单域
├── hooks/            # 客户端 hook（鉴权、评论、文章动作、滚动、草稿守卫）
├── lib/              # 前端工具：api-request、auth-status、build-posts-url、seo、toast…
├── proxy.ts          # 路由守卫（Next 16 的 middleware，文件名改为 proxy.ts）
├── server/           # 服务端，按业务域分文件夹
│   ├── auth/         # 横切域：会话校验与账户动作
│   ├── post/         # 文章域
│   ├── comment/      # 评论域
│   ├── user/         # 用户域（只有 repository + service：无面向客户端的动作，也无自有缓存）
│   └── common/       # 基础设施：db、errors、http、rate-limit、policy、token、password、logger
├── shared/           # 前后端共享：types/、validation/、constants、format、markdown
└── texts/            # 中文词条命名空间（texts.postDetail.xxx）+ formatTemplate 插值
prisma/               # schema + migrations（含 pg_trgm 搜索索引）
scripts/              # dev.mjs（端口清理 / dev / start）、strip-comments.mjs
comment-template/     # 注释风格模板，不参与构建，仅被 .prettierignore 排除
```

### 文件后缀即分层

域内文件名统一为 `<domain>.<layer>.ts`，后缀白名单：

| 后缀              | 职责                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `*.controller.ts` | `"use server"`，只做编排：限流 → 鉴权 → 校验 → 调 service → 失效缓存 |
| `*.guard.ts`      | 会话/权限校验                                                        |
| `*.service.ts`    | 业务规则与事务                                                       |
| `*.repository.ts` | 唯一碰 Prisma 的层                                                   |
| `*.cache.ts`      | `use cache` 读 + `invalidate*` / `revalidate*`                       |
| `*.validator.ts`  | 入参解析，不依赖任何人                                               |
| `*.cookie.ts`     | Cookie 读写                                                          |
| `*.render.ts`     | （仅 post 域）Markdown → HTML                                        |

### 三条依赖规则

规则由 `eslint.config.mjs` 的 `no-restricted-imports` 强制执行，违反即 `pnpm lint` 报错，不写在文档里靠自觉：

- **R1 域内严格向下**：controller → guard/service/validator → repository；cache → service；validator 与 repository 不依赖同层以外。落在 `LAYER_RULES`，按 `src/server/**/*.<layer>.ts` 分组。
- **R2 跨域只准 import 对方的 `*.service`，或对方 `*.cache` 的失效函数**：禁止跨域 import repository / controller / validator / cookie / render。落在 `LAYER_RULES[*].foreign`。
- **R3 auth 只出不进**：`auth.service.ts` / `auth.guard.ts` 不得 import `post` / `comment` 任何文件；需要级联业务域时写在 `auth.controller.ts` 编排。落在 `authCoreConfig`。另外 `src/server/common/**` 只允许依赖 auth 的 `*.guard`；`src/app/**` 只允许 cache / guard / service / cookie / controller；`src/components/**`、`src/hooks/**` 只允许 controller。

### 命名约定

- 读：`list*`（集合）/ `get*`（单个）/ `count*`；缓存版本加 `Cached` 后缀（`listPostsCached`、`getPostCached`）。
- repository 写：`create*Record` / `update*Record` / `delete*Record`。
- 缓存失效：`invalidate*Cache`（按 tag）与 `revalidate*Path`（按路由）。
- 守卫出口：`getAuthPayload` / `requireAuthPayload` / `requireUserOrRedirect` / `authenticate(request)` / `tryAuthenticate(request)` / `requireRefreshableSession(request)`。
- 布尔一律 `is` / `has` / `should` 前缀；不使用 `deps` / `jar` / `outcome` 一类含糊名；不用 class 与依赖注入。

## 缓存

三档生命周期常量各自域内声明：`POSTS_LIFE`（stale/revalidate 300s，expire 1d）、`TAXONOMY_LIFE`（3600s）、`COMMENTS_LIFE`（300s）。tag 粒度为 `posts` / `categories` / `tags` / `post:<id>` / `comments:<id>`。

写之后要**两种失效都做**：`updateTag` 只让同 tag 的其它页面在下次请求时重新生成，`revalidatePath` 只管那一条路径的已渲染页面，两者互补。例：`post.controller.ts` 的 `invalidateAfterContentWrite` 会 `invalidatePostsCache` + `revalidatePostListPaths` + `revalidatePostPath`。

刻意绕开缓存的读：带搜索关键词的查询（`listPostsCached` 检测到 `q` 直接走非缓存分支）、依赖登录态的查询（`listPostsWithViewer` / `getPostForViewer` / `listFavoritedPostsForViewer`），避免因人而异或低命中率的数据污染缓存。

## 路由

| 路径                                  | 说明                                              |
| ------------------------------------- | ------------------------------------------------- |
| `/`、`/posts`                         | 首页与列表：分页、分类/标签筛选、关键词搜索       |
| `/posts/[id]`                         | 详情：渲染 + 高亮、目录、阅读进度、上下篇、评论区 |
| `/write`、`/profile`、`/settings`     | 登录后：写作与草稿、个人主页、账户设置            |
| `/login`、`/register`                 | 认证                                              |
| `/rss`、`/sitemap.xml`、`/robots.txt` | SEO；`/rss.xml` 有到 `/rss` 的非永久重定向        |
| `/api/health`                         | 探活（含一次 Prisma 查询）                        |
| `/api/posts/[id]/comments`            | 评论列表 JSON，供客户端分页拉取                   |
| `/api/posts/[id]/view`                | 浏览计数上报                                      |
| `/api/auth/refresh`                   | 令牌续期与 Cookie 重发                            |

## 快速开始

环境要求：Node.js ≥ 20（`engines`），pnpm 12.4.1（`packageManager`）。

```bash
pnpm install
pnpm db:generate      # 生成 Prisma Client
pnpm db:push          # 同步 schema 到数据库
pnpm dev              # 开发服务器（scripts/dev.mjs 会先清理占用端口）
```

环境变量（无 `.env.example`，以下即为全部取值来源 `src/server/common/config/env.ts`）：

| 变量                        | 必填     | 默认                                                |
| --------------------------- | -------- | --------------------------------------------------- |
| `DATABASE_URL`              | 是       | 无默认，缺失即抛错                                  |
| `JWT_SECRET`                | 生产必填 | 非生产自动生成随机密钥；生产须 ≥ 32 字符，否则抛错  |
| `JWT_EXPIRES_IN`            | 否       | `7d`                                                |
| `JWT_REFRESH_GRACE_SECONDS` | 否       | `3600`                                              |
| `BCRYPT_SALT_ROUNDS`        | 否       | `10`                                                |
| `COOKIE_MAX_AGE`            | 否       | 令牌秒数 + 刷新宽限期                               |
| `NEXT_PUBLIC_BASE_URL`      | 生产必填 | `http://localhost:3000`；用于 sitemap / OG 绝对链接 |

搜索依赖 `pg_trgm` 扩展与两个 GIN 索引，位于 `prisma/migrations/20260929000000_post_search_trgm/migration.sql`。它们刻意不写进 `schema.prisma`（Prisma 无法声明 `gin_trgm_ops` 操作符类），所以 `pnpm db:push` 不会创建它们；语句幂等，必要时重跑该迁移。

## 常用脚本

| 命令                                           | 作用                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:free-port`              | 启动开发服务器 / 仅清理占用端口                         |
| `pnpm build` / `pnpm start`                    | 生产构建 / 启动（`start` 走 `scripts/dev.mjs --start`） |
| `pnpm build:clean`                             | 先清 `.next` 再构建                                     |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | 分步检查                                                |
| `pnpm check`                                   | typecheck + lint + format:check                         |
| `pnpm analyze`                                 | 构建并输出 bundle 分析（`@next/bundle-analyzer`）       |
| `pnpm db:push` / `pnpm db:generate`            | 同步 schema / 生成 Client                               |
| `pnpm strip-comments` / `:check`               | 剥离注释 / 校验；保留 `eslint-disable`、`@ts-*`         |

## 安全

- 登录对不存在的用户也执行一次 bcrypt 比较（`auth.service.ts` 的 `PLACEHOLDER_PASSWORD_HASH`），避免用响应时间枚举已注册邮箱。
- JWT 载荷只含 `id` 与 `tokenVersion`（外加标准 `iat` / `exp`），不含 email；访问令牌 Cookie 为 httpOnly，另有一个非 httpOnly 的 `auth_status` 供客户端 `hasAuthStatus()` 判断登录态并在清除时广播跨标签页登出信号。登出/改密通过递增 `tokenVersion` 使旧令牌全部失效。
- 入参经 `*.validator.ts`（zod/mini）解析；文章正文经 sanitize-html 白名单清洗后才渲染；评论正文只允许纯文本（`sanitizeHtml` 去全部标签）。
- 写接口按客户端 IP / 账户在数据库限流（`common/rate-limit.ts`：单条 upsert 原子计数 + 固定窗口，1% 概率顺手清理过期行）。限流本身出错时放行，不阻塞正常请求。阈值集中在 `common/policy.ts` 的 `RATE_LIMITS`。
- CSP、HSTS、X-Frame-Options 等全站安全响应头在 `next.config.ts`；`src/proxy.ts` 只做 `/write`、`/settings`、`/profile` 的登录跳转。

## 部署

仓库同时留有 `railway.json`（构建 `pnpm db:generate && pnpm build`，启动 `pnpm start`，健康检查 `/`）与 `netlify.toml`（`@netlify/plugin-nextjs`，Node 22）。按目标平台选用，需要配置 `DATABASE_URL`、`JWT_SECRET`（≥ 32 字符）、`NEXT_PUBLIC_BASE_URL`。

## 已知限制

- `updatePostAction` / `deletePostAction` 未接限流，`RATE_LIMITS` 里也没有对应条目（创建、点赞、收藏、浏览、评论三条都有）。
- `PostIdMap` 表只有读路径（`redirectIfRenamed` → `getRenamedPostId` → `findRenamedPostId`），全项目没有写入点，改名重定向实际空转。
- 已删除文章的 `/posts/[id]` 返回 HTTP 200 + 404 界面（PPR 静态壳先锁定状态码）；不存在的路径 `/no-such-page` 正常 404。
- 详情页首屏以 `user={null}` 渲染（viewer-blind 缓存），登录态由 `usePostPageAuth` 在客户端再解析，点赞/收藏按钮会有一次状态回落。
- 评论区滚动进入视口前只渲染静态卡片（`DeferredPostWidgets.tsx` 的 IntersectionObserver），输入框与操作按钮此时不存在。
- 评论的 `updatedAt` 一路传到前端但界面不显示，编辑过的评论与未编辑的无法区分。
- 分页常量有两处同名不同源的值：`config/site.ts` 的 `COMMENT_PAGE_SIZE` 与 `common/policy.ts` 的 `PAGE_LIMITS.commentListDefaultLimit`，改一处忘另一处会导致分页错位。
- `*.service.ts` / `*.cache.ts` 里有若干纯转发 re-export（如 `post.service.ts` 的 `updatePostsAuthorName`、`incrementPostCounter`），是为满足 R1/R2 的跨域 facade，删掉会断依赖。
