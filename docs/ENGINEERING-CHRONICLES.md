# Engineering Chronicles · Technical Decisions & Trade-offs

> 本项目从开发到打磨过程中的关键技术攻坚与决策取舍，按「问题 → 根因 → 解法 → 取舍」逐一展开。

## 一、缓存与渲染层

### 1. `use cache` 边界剥离错误属性，导致 404 变成 500

- **问题**：访问不存在的文章详情页（如 `/zh/posts/99999`）返回 500 而非 404。
- **根因**：`getPublicPostServer`（`src/server/blog/blog.cache.ts`）使用 `use cache`，Next.js 在跨缓存边界做结构化克隆时会**剥离错误对象上的自定义属性**（包括 symbol 品牌），导致 `isAppErrorWithStatus(err, 404)` 判断失效，NotFoundError 被当成未知异常抛成 500。
- **解法**：在缓存边界内把 404 错误**转换成 `null` 返回**（真实故障仍照常抛出，避免把故障误判为"不存在"），页面侧用 null 判空走 `notFound()`；同时把 `appError.ts` 的品牌检查从私有 symbol 改为**可枚举 symbol + duck typing**（statusCode/code/message），保证跨边界克隆后依然可识别。
- **取舍**：PPR 流式渲染下 404 页面仍以 HTTP 200 输出（平台行为，属已知保留项）。

### 2. `unstable_cache` 迁移到 `use cache` + cacheTag

- **问题**：早期用 `unstable_cache` 做缓存，随之而来大量 workaround，维护成本极高。
- **根因**：`unstable_cache` 与 App Router 的缓存体系（PPR、cacheComponents）衔接别扭，失效策略难以精确控制。
- **解法**：全部迁移到 Next.js 16 官方 `use cache` 指令 + `cacheTag`/`cacheLife`，写操作通过 `updateTag("posts")` / `updateTag("post:<id>")` 精确失效，并遍历 `routing.locales` 逐个 `revalidatePath`——双语站每个语言各有一份路由缓存，只失效当前语言会残留另一语言旧页面。
- **取舍**：带登录态或带搜索关键词的查询刻意走非缓存直连路径——前者因人而异，后者基数大、命中率低，缓存反而污染。

### 3. Turbopack 增量构建复用旧产物

- **问题**：改完组件源码后验证 HTML/bundle，看到的却是旧结果。
- **根因**：Turbopack 增量构建会复用旧的 PPR 预渲染 shell。
- **解法**：必须用 `pnpm build:clean`（清空 `.next` 再构建）才能拿到可信产物。

## 二、包体积与前端性能

### 4. zod 全量包拖垮所有页面客户端 chunk

- **问题**：Lighthouse 检测到大量 unused JavaScript，首页 raw JS 高达 1066KB。
- **根因**：`src/shared` barrel 把 zod 运行时（≈340KB raw）导出进了所有引用 @shared 的页面；后续即使切到 `zod/mini`，其入口仍是 `export * from core` 的全量 barrel，**Turbopack 摇树对 barrel 无效**（表单页仍携带 ≈369KB raw zod，是已接受的 ceiling）。
- **解法**：重构成两层约束——
  1. 共享 barrel（`src/shared/index.ts` + `validation/index.ts`）只 re-export **zod-runtime-free** 模块（primitives 纯助手、postId、types）；
  2. auth/blog/comment/builders 的 schema 由 client 表单与 server validator **按模块路径直接 import**，不许经过 barrel；
  3. `eslint.config.mjs` 用 `no-restricted-imports` 以 error 级锁死 `zod` 主入口，防止未来回归。
- **结果**：首页 JS 1066KB → 704KB raw（-34%），首页 zod fingerprint 归零。

### 5. 渲染阻塞 CSS 与图片体积

- **问题**：Lighthouse 报告 render-blocking CSS、图片交付不理想。
- **解法**：
  - 启用 `experimental.inlineCss`（Tailwind 原子 CSS ~14KiB，博客首访为主，PPR 导航自动回退 link 标签）；
  - `src/lib/cdnImage.ts` 只对 `images.unsplash.com` 追加 `auto=format/fit=crop/q=75/w=` CDN 参数（`URLSearchParams.set` 原位替换保留参数顺序），外部图片**不经 next/image 优化器**（SSRF 取舍），其他外链原样返回；
  - 保留 76.1KiB 的 Link prefetch（换取导航速度）与 legacy polyfill（兼容老浏览器），属主动取舍。

### 6. Markdown 渲染器体积

- **问题**：marked + highlight.js 体积大，不能进首屏包。
- **解法**：`src/lib/markdown.ts` 将 marked、hljs 核心及各语言包全部**并行动态导入并缓存为单例 Promise**，只注册实际用到的 8 种语言；高亮失败逐级回退（精确高亮 → auto 识别 → 原文），保证代码内容永不丢失。

## 三、安全与防并发竞态

### 7. 登录时序侧信道

- **问题**：不存在的邮箱能通过响应时间被枚举。
- **解法**：`auth.service.ts` 预置一个合法 bcrypt 假哈希（`DUMMY_PASSWORD_HASH`），用户不存在时也执行一次 `bcrypt.compare`，两条分支耗时接近。

### 8. 点赞/收藏并发竞态

- **问题**：toggle 操作"先读后写"存在竞态，高并发下状态错乱。
- **解法**：`user.repository.ts` 用**原子 SQL** 实现——`DELETE ... RETURNING` 与 `INSERT ... ON CONFLICT`，单条语句内完成判断与写入。

### 9. 令牌失效体系

- **问题**：登出/改密后旧 token 仍有效。
- **解法**：JWT + `tokenVersion` 机制（登出/改密即 bump version，旧 token 全部失效）；JWT 载荷**不含 email** 防数据泄露；cookie 为 httpOnly；刷新接口带 1 小时宽限期容忍并发刷新，配 30 次/分钟 IP 限流。

### 10. 数据库限流的并发正确性

- **问题**：限流"先读计数再写"同样有竞态，且计数表需要清理。
- **解法**：`src/server/common/rate-limit.ts` 用**一条 upsert SQL** 完成「窗口过期则重置为 1 / 未过期则累加」，并利用 `ON CONFLICT ... CASE` 原子更新；以约 1% 概率顺带清理过期记录，省掉定时任务；**数据库异常时放行**（fail-open），避免抖动把正常流量拦死。

### 11. XSS 与错误脱敏

- **问题**：用户提交的 Markdown/HTML 可注入脚本；Server Action 异常信息可能泄漏内部实现。
- **解法**：正文经 `markdown.service.ts` 用 sanitize-html **白名单标签**清洗（`ALLOWED_TAGS` 前后端共用）；`toFailure` 对非 AppError 与 ≥500 的错误统一降级为 `Internal server error`，只有 <500 的业务错误才把真实 message 交给前端。

## 四、数据层与搜索

### 12. Neon Serverless 冷启动超时

- **问题**：数据库冷启动导致"文章加载失败"。
- **解法**：`blog.cache.ts` 的 `withDbRetry`：首次失败等 1.5s 重试一次；**业务错误（404 等）不重试**——重试改变不了结果，只会增加延迟。

### 13. 中文全文搜索

- **问题**：`title/content ILIKE %q%` 是 `%term%` 前缀通配，btree 完全用不上，每次搜索全表扫描；且中文无空格分词，tsvector 方案处理不了。
- **解法**：pg_trgm 的 GIN 索引（`gin_trgm_ops`）对中文子串同样有效。
- **难点**：Prisma 无法声明 `gin_trgm_ops` 操作符类，声明成普通 GIN 反而是无效索引——所以这两个索引**刻意不写进 schema.prisma**，以独立 SQL 迁移维护（`prisma/migrations/20260929000000_post_search_trgm/migration.sql`，语句全部幂等），且 `prisma db push` 后需确认索引仍在。

### 14. getMe 接口 localStorage 膨胀

- **问题**：`getMe` 若加载关联表（点赞/收藏），会把大量数据塞进客户端 localStorage。
- **解法**：`getMe` 只返回用户自身字段，不加载关联表。

## 五、国际化与路由

### 15. locale 作为根动态段

- **问题**：next-intl 传统 `[locale]` 挂在根 layout 之外，语言切换与 SEO 收录难做；且旧式 `setRequestLocale` 调用在 9 个文件里散落 22 处。
- **解法**：删除根 layout，`[locale]/layout.tsx` 升级为根 layout，locale 成为 root param，移除全部 `setRequestLocale`；`src/proxy.ts` 作为唯一中间件，组合 next-intl 语言处理 + 受保护路由（`/write` `/settings` `/profile`）登录拦截，负向 matcher 跳过静态资源。
- **取舍**：`request.ts` 仍用已废弃的 `requestLocale` 参数做 Actions/Handler 的 fallback，等 next-intl 原生支持 root-params 后消除（已知保留项）。

### 16. 语言前缀策略

- **问题**：根路径与默认语言内容重复，搜索引擎判定 duplicate content。
- **解法**：`localePrefix: "always"`，所有 URL 强制 `/zh` `/en` 前缀，每语言 URL 唯一、可分别收录。

## 六、构建、校验与工程约束

### 17. 校验库选型（Valibot → zod/mini）

- **问题**：全量 zod 被扫描工具盯上，且体积大。
- **解法**：迁移到 `zod/mini`，函数式 `.check()` + pipe 组合；类型从 `z.ZodType<T>` 改为 `z.ZodMiniType<T>`。
- **深入取舍**：`zod/mini` 入口仍是全量 barrel，摇树无效——曾 patch 掉 locales/toJSONSchema 实测**无体积收益**，已放弃；表单页 ≈369KB raw zod 是接受的 ceiling。

### 18. CSP 与缓存组件冲突

- **问题**：PPR + cacheComponents 与严格 CSP 不兼容。
- **取舍**：`next.config.ts` 必须保留 `'unsafe-inline'`（script-src/style-src），否则预渲染产物被 CSP 拦截；其余安全头（HSTS、X-Frame-Options、nosniff、Permissions-Policy 等）照常收紧。

### 19. Server Actions 错误处理一致性

- **问题**：多个 Action 各自 try/catch，错误处理不一致、出错后前端拿到的是未脱敏异常。
- **解法**：统一封装 `action-result.ts` 的 `runAction` / `requireAuthPayload` / `ensureNotRateLimited`，返回 `ActionResult`（Server Action 不能自定义 HTTP 状态码，错误只能以 `{ ok: false, status, message }` 回传）。

### 20. Dashboard 路由与缓存校验冲突

- **问题**：write/settings/profile 等需鉴权阻断的页面直接放 cacheComponents 布局下会触发缓存组件校验错误。
- **解法**：Dashboard 布局设置 `instant = false`。

### 21. 构建产物规模控制

- **问题**：文章详情页若全量 SSG、sitemap 若无限拉取，构建产物失控。
- **解法**：`STATIC_PARAMS_LIMIT = 100`（最新 100 篇 × 全部语言预生成，超出走按需渲染）；`SITEMAP_LIMIT = 20000`。

### 22. 注释剥离与代码洁净

- **问题**：代码里散落大量解释性注释，团队决定全部剥离以保证整洁。
- **难点**：剥离必须安全——`scripts/strip-comments.mjs` 需正确识别字符串/模板/正则/注释边界，只保留 `eslint-disable`/`eslint-enable`/`@ts-` 功能指令；配套 `scripts/verify-comment-only.mjs` 用「去注释后逐行归一化 + token 序列比对」的方式验证某次改动**只新增注释、未动代码**（git 层面兜底）。

### 23. 字体决策反复

- **问题**：先后试过 Source Serif 4、思源宋体、霞鹜文楷，全部放弃——`@fontsource/lxgw-wenkai` 是 8.8MB 整包不可用，切片方案验证可行但最终仍放弃。
- **取舍**：**不要任何 webfont**，回归纯系统栈（Georgia/Songti SC、ui-monospace 等），零字体下载，每台设备显示各自原生字体。

### 24. 日志穿透 removeConsole

- **问题**：生产构建 `removeConsole` 会剥掉 console.log，日志无法采集。
- **解法**：logger.ts 与 ViewReporter.ts 用 `console.error` 输出（配置为 `exclude: ["error"]`），保证生产日志可采集。

### 25. 类型安全硬约束

- **问题**：共享校验跨前后端时类型漂移。
- **解法**：tsconfig 开启 strict + `noUncheckedIndexedAccess`/`noUnusedLocals`/`noUnusedParameters`/`noImplicitOverride`/`verbatimModuleSyntax`；locale 校验收敛为 `assertLocale()`（`asserts locale is Locale` 类型收窄）；配置注释全删后依赖 `pnpm check`（typecheck + lint + format:check）兜底。
