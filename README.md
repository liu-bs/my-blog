# my-blog — Next.js 16 博客平台

一个基于 Next.js 16 App Router 的全栈博客平台：中文单语、服务端渲染（PPR + 缓存组件），支持写作后台与读者交互（评论、点赞、收藏）。

## 技术栈

| 领域     | 选型                                                      |
| -------- | --------------------------------------------------------- |
| 框架     | Next.js 16（App Router、PPR、cacheComponents、Turbopack） |
| UI       | React 19 + TypeScript + Tailwind CSS v4                   |
| 数据库   | PostgreSQL（Neon Serverless）+ Prisma 6                   |
| 文案     | 静态中文词条模块（`src/messages`）                        |
| 认证     | JWT（httpOnly Cookie + tokenVersion 失效机制）+ bcryptjs  |
| 内容渲染 | marked + highlight.js + sanitize-html（白名单清洗）       |
| 校验     | zod（仅 `zod/mini` 子路径，服务端与表单共享）             |
| 其他     | next-themes、sonner、lucide-react                         |

## 功能特性

### 读者端

- 首页 / 文章列表：分页、分类与标签筛选、关键词搜索（pg_trgm GIN 索引）
- 文章详情：Markdown 渲染与代码语法高亮、阅读时长估算、目录（TOC）、上一篇 / 下一篇
- 交互：评论、点赞、收藏、浏览计数

### 写作后台（登录后）

- 创建 / 编辑 / 删除文章，草稿与发布状态管理
- 个人资料编辑、账户设置、主题与字号偏好

### 平台能力

- 单语中文：`<html lang="zh-CN">`，URL 无前缀；旧的 `/zh/*`、`/en/*` 链接由 [next.config.ts](next.config.ts) 永久重定向到去前缀路径
- 亮 / 暗主题切换
- SEO：metadata、robots、sitemap（带数量上限保护）
- 安全：登录时序侧信道防护、令牌刷新与宽限期、数据库限流、CSP 等安全响应头

## 快速开始

### 环境要求

- Node.js ≥ 20
- pnpm 12（项目以 pnpm 管理依赖）

### 安装与配置

```bash
pnpm install
cp .env.example .env.local   # 填写 DATABASE_URL 等
pnpm db:push                 # 同步 Prisma schema 到数据库
```

`.env.local` 关键变量（详见 [.env.example](.env.example)）：

| 变量                   | 说明                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`         | Neon PostgreSQL 连接串（必填）                               |
| `JWT_SECRET`           | JWT 签名密钥；生产必填且 ≥ 32 字符，本地缺省自动生成随机密钥 |
| `JWT_EXPIRES_IN`       | 访问令牌有效期，默认 `7d`                                    |
| `BCRYPT_SALT_ROUNDS`   | bcrypt 轮数，默认 10                                         |
| `NEXT_PUBLIC_BASE_URL` | 站点对外地址，用于 sitemap / OG 绝对链接；生产必填           |

> 文章搜索依赖 pg_trgm 扩展与两个 GIN 索引，位于 `prisma/migrations/20260929000000_post_search_trgm/migration.sql`。该迁移刻意不写入 `schema.prisma`（Prisma 无法声明 `gin_trgm_ops` 操作符类），请确认已应用；SQL 语句幂等，可重复执行。

### 开发

```bash
pnpm dev          # 启动开发服务器（自动清理残留进程占用的端口）
```

### 生产构建

```bash
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm build:clean  # 清空 .next 后构建（Turbopack 增量构建可能复用旧产物时使用）
```

## 常用脚本

| 命令                                                | 作用                                     |
| --------------------------------------------------- | ---------------------------------------- |
| `pnpm dev:free-port`                                | 仅清理占用的开发端口，不启动服务器       |
| `pnpm typecheck`                                    | TypeScript 严格模式类型检查              |
| `pnpm lint` / `pnpm lint:fix`                       | ESLint 检查 / 自动修复                   |
| `pnpm format` / `pnpm format:check`                 | Prettier 格式化 / 校验                   |
| `pnpm check`                                        | typecheck + lint + format:check 全量检查 |
| `pnpm analyze`                                      | 构建并输出 bundle 分析报告               |
| `pnpm db:push` / `pnpm db:generate`                 | 同步数据库 schema / 生成 Prisma Client   |
| `pnpm strip-comments` / `pnpm strip-comments:check` | 剥离代码注释 / 校验是否已剥离            |

## 架构概览

### 分层

页面（RSC）→ Server Actions 控制器（`src/server/*/*.controller.ts`）→ Service（业务）→ Repository（Prisma）。写操作统一经 `runAction` / `requireAuthPayload` / `ensureNotRateLimited` 包装，返回 `ActionResult` 结构，错误不向客户端抛出异常。

### 文案层

- 中文词条集中在 `src/messages/*`（按 nav / posts / auth 等命名空间拆分），`copy(namespace)` 返回带 `{param}` 插值的取词函数，服务端与客户端组件通用
- 中间件 [proxy.ts](src/proxy.ts) 只做受保护路由（`/write`、`/settings`、`/profile`）的登录拦截，未登录跳转 `/login?redirect=...`
- 路由无 locale 段，页面直接挂在 `src/app` 下

### 缓存

- 公开读接口统一走 [blog.cache.ts](src/server/blog/blog.cache.ts) 的 `use cache` + `cacheTag` + `cacheLife`（默认 stale / revalidate 5 分钟）
- 写操作按 tag（posts / categories / tags / post:id）精确失效，并 revalidate 列表与详情路径
- 依赖登录态或带搜索关键词的查询走非缓存直连路径，避免因人而异或低命中率的数据污染缓存

### 安全

- 登录接口对不存在的用户也执行一次 bcrypt 比较，防止通过响应时间枚举已注册邮箱
- JWT 载荷不含 email；cookie 为 httpOnly；`tokenVersion` 支持登出 / 改密后旧令牌全部失效
- Server Action 与表单入参经 zod/mini 校验，文章正文经 sanitize-html 白名单清洗后再渲染
- 登录、注册、发文等写接口按客户端 IP 在数据库滑动窗口限流（单条 upsert 原子计数）
- 全站安全响应头（CSP、HSTS、X-Frame-Options 等）在 [next.config.ts](next.config.ts) 配置

## 部署

面向 Netlify（devDependencies 含 `@netlify/plugin-nextjs`），数据库使用 Neon Serverless Postgres。在部署平台配置生产环境变量：

- `DATABASE_URL`
- `JWT_SECRET`（≥ 32 字符）
- `NEXT_PUBLIC_BASE_URL`

## 项目结构

```
src/
├── app/                  # 路由：(home|auth|dashboard)、posts、api、rss 等
├── components/           # 通用 UI 组件
├── server/               # 服务端：auth / blog / comment 三域 + common（db、errors、限流等）
├── shared/               # 前后端共享的类型与校验（zod/mini）
├── hooks/                # 客户端 hooks（鉴权、评论、滚动等）
├── messages/             # 中文文案词条（copy 取词层）
├── config/site.ts        # 站点级常量（分页、限流阈值、导航等）
└── lib/                  # 通用工具（markdown、url、格式化等）
prisma/                   # schema + 迁移（含 pg_trgm 搜索索引）
scripts/                  # dev / strip-comments / verify-comment-only 等脚本
```
