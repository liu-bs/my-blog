# 个人博客（Next.js 16.3.5，branch `dev`）过度设计 / 冗余审计报告

工作目录：`D:\Users\辉叔\Desktop\my-blog`
规模基线（实测）：`src/**` = 207 文件 / 13,276 行；另 `scripts/` 3 文件 454 行、`comment-template/` 2 文件 328 行。
目录分布：server 32/2757、app 45/2775、dashboard 10/1671、post 16/1338、shared 21/829、lib 11/517、hooks 12/504、skeletons 13/924、ui 17/494、shell 7/490、auth 5/446、texts 14/371、config 1/15。

---

## 一、结构性过度设计（最高优先级）

### 【过度设计·冗余】F1. `src/server/user/user.service.ts` 整文件是纯转发层，11 个导出、0 行独立逻辑

**问题描述**
`src/server/user/user.service.ts`（54 行）的导出逐条都是对 `user.repository.ts` 的一行转发：

- `user.service.ts:18-20` `getUserById` → `findUserById`
- `:22-24` `getUserByEmail` → `findUserByEmail`
- `:26-28` `getUserWithPostAssociations` → `findUserWithPostAssociations`
- `:40-42` `createUser` → `createUserRecord`
- `:44-46` `updateUser` → `updateUserRecord`
- `:48-50` `invalidateUserSessions` → `incrementTokenVersion`
- `:52-54` `getUserPostState` → `findUserPostState`
- `:16` `export { incrementUserStatStmt } from "./user.repository"`（纯 re-export）

只有两处是真逻辑：`:30-32` `isEmailOrUsernameTaken`（`count(...) > 0`）、`:34-38` `getUserDisplayName`（`joinName(...) || username`）。

而 `user.repository.ts:152-158` 自身也是转发层：

```ts
export function findUserById(id: string): Promise<User | undefined> {
  return loadUser(id);
}
export function findUserByEmail(email: string): Promise<User | undefined> {
  return loadUserByEmail(email);
}
```

`loadUser`（`:142-145`）与 `loadUserByEmail`（`:147-150`）是同一个查询、只差 where 列，且都把 `likedPosts`/`favoritedPosts` 硬编码成 `[]`。

grep 调用点分布：`getUserById` → auth.guard.ts:60、auth.service.ts:98/108/117、comment.service.ts:66、post.service.ts:237；`getUserByEmail` → 仅 auth.service.ts:83；`getUserWithPostAssociations` → 仅 post.service.ts:368；`getUserPostState` → 仅 post.controller.ts:120；`incrementUserStatStmt` → post.service.ts:230/290/305/307/323（**从 service 层跨域导入 SQL 构造器**）。

**为什么是问题**

- 认知负担：一个"用户"数据要跨 `user.service.ts` → `user.repository.ts` → `loadUser` 三层才落到 SQL；读代码必须连跳两级才能确认"这里没有额外逻辑"。
- 维护成本：改一个查询签名要改 3 处；`get*` 与 `find*` 两套命名无语义差异，只是层号不同。
- 与"按域分层"自相矛盾：`incrementUserStatStmt` 明明是 SQL 构造器（repository 关注点），却由 service 层 `export` 并被 `post.service` 跨域 import（`post.service.ts:33`），分层边界实际已被击穿。

**简化方案**
删除 `src/server/user/user.service.ts` 整个文件（−54 行），把两个真函数搬进 `user.repository.ts`；`loadUser`/`loadUserByEmail` 合并为 `loadUser(where)`。目标：每域只剩 `*.controller.ts`（Server Action + 鉴权 + 限流 + zod）与 `*.repository.ts`（SQL）。净减 ≈ 70 行、少 2 层跳转。

---

### 【过度设计·冗余】F2. 反向 re-export 链条：repository → service → 跨域 service/cache

**问题描述**
四处把下层符号从上层再导出，再让别的域"向上"导入：

1. `post.service.ts:412` `export { incrementPostCounterStmt };` —— 定义在 `post.repository.ts:275`；唯一消费者 `comment.service.ts:11` `import { incrementPostCounterStmt } from "@server/post/post.service";`
2. `post.service.ts:53` `export { updatePostsAuthorName } from "./post.repository";`（定义在 `post.repository.ts:293`）；唯一消费者 `auth.controller.ts:39`
3. `post.cache.ts:26` `export { listPostsByAuthor } from "./post.service";`；唯一消费者 `(dashboard)/profile/page.tsx:3`
4. `comment.service.ts:27` `export { updateCommentsAuthorProfile } from "./comment.repository";`；唯一消费者 `auth.controller.ts:33`

**为什么是问题**
grep 计数证明每个 re-export 都只有 1 个消费者，且方向都是"跨域取用下层 SQL 构造器"。这制造了 `comment → post.service → post.repository` 的隐式反向依赖，是循环依赖的温床（`post.service` 已 import `user.service`，`auth.controller` 已 import 两个域的 service + cache）。

**简化方案**
删掉这 4 行 re-export，消费者改为直接 import 定义处：

- `comment.service.ts:11` → `@server/post/post.repository`
- `auth.controller.ts:39` → `@server/post/post.repository`；`:33` → `@server/comment/comment.repository`
- `(dashboard)/profile/page.tsx:3` → `@server/post/post.service`

净减 4 行，消除 4 条反向边。

---

### 【过度设计·冗余】F3. 三个 `*.validator.ts` 是 `createParser` 的 3 行包装

**问题描述**

- `post.validator.ts`（16 行）：只做 2 次 `createParser(schema, "Post validation failed")`
- `comment.validator.ts`（10 行）：只做 1 次
- `auth.validator.ts`（55 行）：`:13` `const _parseRegister = ...`、`:27` `const _parseLogin = ...` 是仅本文件可见的中间常量，随后 `:15-25`、`:29-33` 再包一层做 `email.toLowerCase()` 与 `lastName ?? ""`

`createParser` 本体在 `server/common/zod.ts:5-16`，仅 12 行，本身是合理抽象（统一把 zod issues 转成 `ValidationError`）。

另外 `post.validator.ts:9` 与 `:14` 两处 `as unknown as z.ZodMiniType<...>` 双重断言，说明 `postUpdateSchema`（`z.partial(postCreateSchema)`）与 `UpdatePostDto`（`Partial<CreatePostDto>`）的类型并不真的对齐——两层写法在互相打补丁。

**为什么是问题**
`post.validator.ts` / `comment.validator.ts` 存在的唯一价值是把 `errorLabel` 字符串挪到另一个文件，调用链变成 controller → validator.ts → zod.ts → schema，读一次校验要开 4 个文件。`_parseRegister`/`_parseLogin` 两个下划线常量无任何外部引用。

**简化方案**
删除 `post.validator.ts`、`comment.validator.ts`（−26 行），controller 内直接：

```ts
const dto = parse(postCreateSchema, input, "Post validation failed");
```

`auth.validator.ts` 删除两个中间常量（−4 行）。同时把 `UpdatePostDto` 改为 `z.infer<typeof postUpdateSchema>`，消除 `as unknown as` 双重断言。

---

### 【过度设计·冗余】F4. `useAsyncAction` 的第三参数 `retry` 是死代码，整段指数退避不可达

**问题描述**
`src/hooks/useAsyncAction.ts:43-47` 定义 `retry = false`；`:66-85` 是完整 while 重试循环 + `MAX_RETRIES = 3`（`:15`）+ `RETRY_BASE_DELAY = 1_000`（`:13`）+ `isRetryableError`（`:17-35`，19 行，按 message 子串匹配 `"timeout"`/`"network"`/`"failed to fetch"`/`"408"`/`"429"`）。

**grep 证明**：全仓 `useAsyncAction(` 调用共 8 处（`usePosts.ts:20/28/36/73`、`useComments.ts:173/184/195`、`useAuth.ts:20`），**没有任何一处传第三个参数**。故 `retry` 恒为 `false`，`:76` 的 `!retry || ...` 恒真短路，`:81-83` 的退避 `sleep` 与 `attempt++` 永不执行。

同时"重试"在 `src/lib/api-request.ts` 已实现：`:102-105`（`SAFE_RETRY_METHODS` + `NET_RETRY_DELAY_MS = 400`）、`:137-141`（401 刷新后重放）。即同一件事实现两遍，客户端那一遍完全没启用。

**为什么是问题**

- 死代码约 42 行；`noUnusedLocals` 抓不到（参数被引用）。
- 双重实现造成误读：看 `useAsyncAction` 会以为写操作重试 3 次，实际一次都不会；得看 `api-request` 才知道只有 GET 重试。
- `isRetryableError` 按 message 子串判断是最脆弱的判据，且在真实路径中永不执行。

**简化方案**
删除 `retry` 参数、`MAX_RETRIES`、`RETRY_BASE_DELAY`、`isRetryableError` 及整个 while 循环，`mutate` 简化为 try/catch/finally（约 20 行）。重试统一收归 `api-request.ts`。净减 ≈ 42 行。

---

### 【过度设计·冗余】F5. Markdown 渲染器实现了两遍，客户端那份没有 XSS 净化

**问题描述**

- 服务端：`src/server/post/post.render.ts`（149 行）—— `Marked` + `marked-highlight` + `highlight.js/lib/core` + 注册 **14 种语言**（`:6-19`）+ 标题 slug 生成（`:69-97`）+ `sanitize-html` 白名单净化（`:99-141`）。
- 客户端：`src/shared/markdown.ts:172-233` `getMarkdownRenderer()` —— 懒加载 `marked` + `highlight.js/lib/core` + 注册 **8 种语言**（`:186-197`），手写 `marked.Renderer`，**无任何 sanitize 步骤**。
- 唯一消费者：`src/components/dashboard/write/MarkdownPane.tsx:6,47`。

两份共享的只有 `MARKED_OPTIONS`（`markdown.ts:132`）、`ALLOWED_TAGS`（`:1-57`）、`HIGHLIGHT_ALIASES`（`:115-130`）、`highlightCode`、`registerHighlightLanguages`。

语言集已漂移：`post.render.ts` 有 go/rust/java/yaml/markdown/shell，客户端没有 → **编辑器预览与线上渲染结果不一致**。

**为什么是问题**

- 两份解析配置约 171 行（149 + 客户端渲染器 57 行）需同步维护，且已经不同步。
- 客户端无净化：`MarkdownPane.tsx:132,141` 直接 `dangerouslySetInnerHTML={{ __html: previewHtml }}`。根因是 `sanitize-html` 依赖 `htmlparser2`/`postcss`，不便进客户端 bundle，于是"净化"在客户端被整个省掉。
- bundle：客户端为预览额外拉入 `marked` + `highlight.js/lib/core` + 8 个语言模块。

**简化方案**
保留 `post.render.ts` 单一渲染器；新增 Server Action `renderPreviewAction(markdown)` 复用 `renderPostBody`，`MarkdownPane` 防抖 500ms 后调用；删除 `shared/markdown.ts:168-233`（`getMarkdownRenderer`、`MarkdownRenderer`、`markdownRendererPromise`）。净减 ≈ 66 行，客户端不再打包 marked/highlight.js，且预览结果与线上一致、带净化。

---

### 【过度设计·冗余】F6. `FormField` 用 React 元素树遍历"猜" input id（16 行 + 运行期告警）

**问题描述**
`src/components/ui/FormField.tsx:5-19` `findControlId(node)` 递归读取 `node.props.id` / `node.props.children` 去找表单控件 id；`:31-33` 在 dev 下找不到就 `console.error`。
grep 证据：**全部 12 个调用点都已显式传了 id** —— `RegisterForm.tsx:167/188/204/224`、`SettingsForm.tsx:284/310/343/359/405/424/443`、`CoverField.tsx:61`、`WriteEditor.tsx:346`。

**为什么是问题**
依赖 React 元素的 `props` 内部结构，在 `<Input>` 外包一层 `div`/`Fragment` 就静默失效，还要靠 dev 日志补救。它省下的只是把 `htmlFor` 当 prop 传一次。

**简化方案**
`FormField` 增加必填 prop `htmlFor: string`，删除 `findControlId` 与 dev 告警（−18 行），12 个调用点各加一个 prop。或改在 `Input.tsx`（34 行）内用 `useId()` 自动关联。

---

## 二、冗余实现 / 重复逻辑

### 【过度设计·冗余】F7. 错误序列化实现了两次：`toFailure`（Server Action）与 `sendError`（Route Handler）

**问题描述**

- `src/server/common/action-result.ts:24-44` `toFailure`：非 `AppError` → 记日志 + `{status:500, message:"Internal server error"}`；`statusCode >= 500` → 记日志 + 脱敏；否则透传 `message` + `details`。
- `src/server/common/http/api-response.ts:15-49` `sendError`：完全相同的三步（`isAppError` 判定、`>=500` 记 `logger.error` 并脱敏、`<500` 透传 `message` + `details`），只是外面套 `NextResponse.json`。

两者必须保持一致却各写一遍："脱敏阈值"、"details 只在 <500 时带出"、日志级别。`INTERNAL_ERROR`（`action-result.ts:12` = `"Internal server error"`）与 `api-response.ts:35` 的 `"Internal server error, please try again later"` 是同一语义的两条文案。

**为什么是问题**
全站只有 4 个 Route Handler，却维护两套错误协议；将来改脱敏策略极易只改一处。

**简化方案**
抽出 `server/common/errors/serialize.ts` 导出 `toFailurePayload(err): { status, body }`，`toFailure` 与 `sendError` 都调用它。合并后约 −25 行。

---

### 【过度设计·冗余】F8. "图片 URL 合法"规则有 4 份定义，同一错误文案有 4 份副本

**问题描述**
规则实现：

1. `src/shared/validation/builders.ts:8` `z.refine((v) => v === "" || isSafeImageUrl(v), ...)`（`optionalImageUrlSchema`）
2. `src/components/dashboard/write/CoverField.tsx:12-15` `isCoverUrlAllowed = url === "" || isSafeImageUrl(url)`（与 1 字面等价）
3. `src/server/post/post.service.ts:96-101` `assertCoverImageUrl`（第三次，服务端再判）
4. `src/shared/validation/primitives.ts:12-22` `isSafeImageUrl`（真正实现）

文案副本（同一句"请填写以 https 开头的图片链接，或以 / 开头的站内路径"）：

- `src/shared/validation/primitives.ts:4` `IMAGE_URL_INVALID_MESSAGE`
- `src/texts/feedback.ts:91` `form.imageUrl`
- `src/texts/settings.ts:16` `avatarInvalid`
- `src/texts/write.ts:52` `coverInvalid`

**为什么是问题**
改一次文案要同步 4 个文件；`CoverField` 这一份重复前置判断正是 `WriteEditor.tsx:237-239` 那段特殊分支（`isCoverUrlAllowed` 失败时覆盖 `invalid.fields.coverImage`）的来源。

**简化方案**
删除 `CoverField.tsx:12-15`，直接 `import { isSafeImageUrl } from "@shared"`；`texts` 三条文案改为引用 `IMAGE_URL_INVALID_MESSAGE`。净减 ≈ 8 行，消除三处漂移。

---

### 【过度设计·冗余】F9. 密码校验在 zod 与 UI 各写一遍，其中一遍不可达

**问题描述**
`src/shared/validation/auth.ts:53-59`：

```ts
export const changePasswordSchema = changePasswordFieldsSchema.check(
  z.refine((data) => data.currentPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
    params: { rule: "passwordMismatch" },
  }),
);
```

`src/components/dashboard/SettingsForm.tsx:169-171`：

```ts
if (newPassword && newPassword === currentPassword)
  errors.newPassword = settings.sameAsCurrentPassword;
if (newPassword !== confirmPassword) errors.confirmPassword = settings.passwordMismatch;
```

grep 证据：`changePasswordSchema` 仅在 `auth.validator.ts:35-38`（服务端）被引用；客户端 `SettingsForm.tsx:153` 动态加载的是**无 refine 的** `changePasswordFieldsSchema`。因此：

- `params: { rule: "passwordMismatch" }` 在客户端永不产生 → `shared/types/validation.ts:1` 的 `ValidationRule` 与 `lib/error-message.ts:61-62` 的分支只服务服务端路径；
- 客户端文案 `settings.sameAsCurrentPassword`（`texts/settings.ts:40`）与 zod 的 `"新密码不能与当前密码相同"` 是同一句话的两份。

同一规则三种表达。

**简化方案**
客户端也改用 `changePasswordSchema`（含 refine），删除 `SettingsForm.tsx:169` 手写判断，删除 `texts/settings.ts:40`。净减 ≈ 6 行，并让 `passwordMismatch` 规则真正生效。

---

### 【过度设计·冗余】F10. 计数更新分散在 4 个文件、3 种写法

**问题描述**
grep `incrementPostCounterStmt|incrementUserStatStmt` 共 13 处：

- `post.service.ts:230`（新建 +1 作者 posts）、`:290`（草稿转正 ±1）、`:305`（删除 −1）、`:307`（删除时回退 likes）、`:322-323`（浏览 +1 post.views 与 user.statsViews）
- `comment.service.ts:84`（评论 +1 commentsCount）
- `comment.repository.ts:114`（删除评论 −1，写成裸 SQL `${posts.commentsCount} - 1`，**不走** `incrementPostCounterStmt`）
- `post.repository.ts:365-407` `togglePostAssociationAndCounters`（点赞/收藏 ±1，一大段手写 CTE）
- `user.repository.ts:244-272` `statSet` / `incrementUserStatStmt`

即"给帖子计数 +1"有 **3 种写法**：`incrementPostCounterStmt`、CTE、裸 SQL。

**为什么是问题**
`deleteCommentAndDecrementCounter`（`comment.repository.ts:110-117`）绕过统一入口，用 `sql.raw(posts.commentsCount.name)` + 裸列运算；与 `incrementPostCounterStmt`（`post.repository.ts:281-290`）的 `.set({ [field]: sql\`${column} + ${delta}\` })` 是同一语义两种写法。计数一致性没有单点，新增"删除文章时回退 commentsCount"之类需求需再补一条。

**简化方案**
`deleteCommentAndDecrementCounter` 改为复用 `incrementPostCounterStmt(postId, "commentsCount", -1)`，与 CTE 版一起收进 `post.repository.ts` 的 `applyCounterDelta(stmts, ...)` 组合器。净减 ≈ 20 行，计数写入收敛到 1 个文件。

---

### 【过度设计·冗余】F11. `updateUserRecord` 用 5 条 statements 的 batch 换一次更新 + 两条**永不执行**的 SELECT

**问题描述**
`src/server/user/user.repository.ts:200-242`：statements 依次为 `UPDATE users ... RETURNING`、条件性 `DELETE`+`INSERT` `userPostLikes`、条件性 `DELETE`+`INSERT` `userPostFavorites`，**外加两条无条件 `SELECT`**（`:219-228`），只为把 liked/favorited 读回来喂 `mapToUser`。然后靠**位置索引**取结果：`:231` `results[0] as UserRow[]`、`:235-236` `results[results.length - 2]` / `[results.length - 1]`。

grep 证据：全仓唯一消费者是 `auth.service.ts:112`（改密码，只传 `{password}`）与 `:120-127`（改资料，只传 firstName/lastName/avatar/bio/location/website）。两处**都没有**传 `likedPosts`/`favoritedPosts`，故 `:208-217` 的四个关联分支与 `:219-228` 的两条 SELECT 在真实路径中**永不执行**。

**为什么是问题**

- 位置索引（`results[results.length - 2]`）是极脆弱的隐式契约：任何人往 statements 里插一条就静默取错数据。
- `atomicBatch` 的语义是"整批一个 fetch 原子提交"，却用来顺带多查两次，把本可省的两条 SELECT 塞进写事务。

**简化方案**
`updateUserRecord` 瘦身为只做 `UPDATE ... RETURNING`（−30 行）；关联读取拆成独立 `loadUserAssociations(id)`，按需调用；`mapToUser`（`:25-60`）关联参数改可选。

---

### 【过度设计·冗余】F12. `post.service` 里的 pass-through 包装

**问题描述**

- `:389-391` `listCategories()` → `listDistinctCategories()`
- `:393-395` `listTags()` → `listTagCounts()`
- `:236-240` `getUserDisplayNameOf()` 本地私有包装 `getUserById` + `getUserDisplayName`
- `:397-404` `assertPostReadable` 与 `:406-410` `assertPostCommentable` 高度重叠（都先 `findPostStatus` + 空判 404），差别只有草稿时一个返回 404、一个抛 403

**为什么是问题**
每个包装多一层跳转但零逻辑；两个断言本可合一。

**简化方案**
`listCategories`/`listTags` 删除，调用方（`post.cache.ts:122,129`）直接用 repository 函数；两个断言合并为 `assertPostAccessible(postId, { viewerId, allowDraft })`。净减 ≈ 15 行。

---

## 三、死代码（均有 grep 证明）

### 【过度设计·冗余】F13. 4 个导出符号全仓零引用

用脚本对 207 个源文件做"导出名 vs 全仓出现次数"交叉统计，`出现次数 <= 1`（仅声明处）且属真实死代码的：

| 符号                 | 定义处                                             | 外部引用数                                |
| -------------------- | -------------------------------------------------- | ----------------------------------------- |
| `DashboardSkeleton`  | `src/components/skeletons/DashboardSkeleton.tsx:4` | 0                                         |
| `peekPostValidation` | `src/lib/validation-loader.ts:31`                  | 0                                         |
| `PostInsert`         | `src/server/db/schema.ts:151`                      | 0                                         |
| `isValidPostId`      | `src/shared/validation/post-id.ts:7`               | 0（仅同文件 `assertValidPostId:12` 调用） |

反例（统计为 1 次但**不是**死代码，已核实）：`proxy`（`proxy.ts:10`，Next 文件约定，见 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:58`）、`manifest`（`manifest.ts:4`，`MetadataRoute` 约定）、`generateStaticParams`（`posts/[id]/page.tsx:35`）、`contentType`（`apple-icon.tsx:3`）、`viewport`（`layout.tsx:51`）、各 `Page`/`Layout`/`Error` 默认导出。

另：`src/app/api/health/route.ts`（23 行）在 `src/` 内零引用（grep `/api/health` 无结果）；而 `railway.json:8` 的健康检查路径写的是 `"/"`，即该端点当前无人调用。

**简化方案**
删除 `DashboardSkeleton.tsx`（29 行）、`peekPostValidation`（1 行）、`PostInsert`（1 行）；`isValidPostId` 降为非导出。健康检查端点二选一：删掉，或把 `railway.json:8` 改为 `/api/health`。

---

### 【过度设计·冗余】F14. `comment-template/` 328 行与本项目无关，`strip-comments.mjs` 根本不读它

**问题描述**
`comment-template/ts.md`（128 行）与 `tsx.md`（250 行）内容是**电商 Demo**：`OrderStatus` 枚举、`GoodsCard`/`GoodsItem`/`GoodsStatusEnum`、`DEFAULT_GOODS_COVER = '/assets/images/goods-default.png'`（`tsx.md:76`）、`RequestClient` 请求类（`ts.md:104-121`）。`tsx.md:3` 的 `@file GoodsCard.tsx` 与博客无任何关系。`tsx.md:225` 甚至含 JSX 语法错误（`{/* 注释 */}` 落在 map 回调的表达式位置）。

grep `comment-template` 全仓命中 **1 处**：`README.md:39`（"注释风格模板，不参与构建，仅被 .prettierignore 排除"）。
`scripts/strip-comments.mjs` 全文 **没有任何读取模板的逻辑**（只 `readFileSync` 待处理源文件：`:295`），`KEEP_PREFIXES` 硬编码在 `:11`。

**为什么是问题**

- 328 行死文件留在仓库，且是"注释风格"承诺的唯一载体——而 `strip-comments` 的设计目标恰恰是删光注释（见 F15），两者互相矛盾。
- 模板内容与项目域完全不符，tsx.md 本身语法有误，仅靠 `.prettierignore:7` 躲避扫描。

**简化方案**
删除整个 `comment-template/` 目录（−328 行）与 `.prettierignore:7`。

---

### 【过度设计·冗余】F15. `scripts/strip-comments.mjs`（326 行）是手写词法扫描器 + 破坏性注释删除工具

**问题描述**

- 自实现 JS/TS 注释词法扫描：`scanJsComments`（`:28-152`）手写字符串（`:70-90`）、模板字符串含 `${}` 深度计数（`:92-120`）、正则字面量与 `isRegexStart` 启发式（`:34-38`、`:122-145`）；另有 `scanCssComments`（`:154-194`）、`scanHashComments`（`:240-250`）。
- `collapseBlankLines`（`:206-224`）删注释后重排空行——这正是 git log `b8326f3 style: 补齐 prettier 格式（剥注释遗留空行与 class 排序）` 那条提交的成因，即该脚本制造了额外返工。
- 危险默认：`:280-285` 提示"全量 strip 会删除所有 git 未忽略代码文件的注释"，靠 `--yes` 兜底；`package.json:21` 把它做成 `pnpm strip-comments` 一键破坏性操作。
- 无第三方依赖（只 `node:fs`/`node:path`/`node:child_process`）。零依赖是优点，代价是 291 行自制 JS 解析器——而仓库已有 devDependency `typescript`，其 `ts.createSourceFile` + `getLeadingCommentRanges` 能可靠完成同一件事，无需处理正则/模板字符串歧义。

**为什么是问题**

- 成本：291 行解析器 + 328 行模板 + 一次已发生的返工提交，换来"注释被永久删除"。git `57412ed refactor: 移除所有冗余的文件注释和文档块` 已删过一轮，此后任何新增注释都会让 `strip-comments:check` 失败。
- 与工具目标相悖：注释应承载"为什么"。本报告引用的 `db-push.mjs:21`（trgm 扩展依赖）、`post.repository.ts:87`（`%term%` 走 trgm GIN、声明在此以便 `db:push` 复现）、`error-page-shell.ts:27`（错误页不加载 Tailwind）恰好是仅存的、价值最高的注释。
- `comment-template/` 的存在说明作者本意是"维护一套注释风格"，与全量剥离策略直接冲突。

**简化方案**
删除 `scripts/strip-comments.mjs`（−291 行）与 `package.json:21-22` 两个 script；改用 ESLint 规则（`eslint.config.mjs` 已 199 行）+ review 约束注释质量。若确要"检测注释过多"，用 `ts.createSourceFile` 重写为 < 40 行的 check-only（不写盘）版本。

---

### 【优化项】F16. `dev.mjs`（134 行）每次 `pnpm dev` 删除 `.next`

**问题描述**
`scripts/dev.mjs:113-134`：非 `--start` 模式下最多尝试 6 秒 `rmSync('.next', { recursive: true, force: true })`。另有 `pidsOnPort`（`:19-47`，Windows 用 `netstat -ano` 解析、POSIX 用 `lsof`）、`waitForPidExit`（`:53-64`，用 `Atomics.wait` 做同步 sleep）、`killProjectDevServer`（`:79-94`，读 `.next/dev/lock` 里的 pid 再 `taskkill /F /T`）。

**为什么是问题**
134 行平台相关进程管理，外加每次 dev 强行清缓存。缓存失效本应由 Next 处理；这里解决的是"端口占用 / 陈旧构建"的本地环境问题，代价是日常开发永远没有增量构建。

**简化方案**
保留端口释放（`:19-47` + `:66-77`），删除无条件清 `.next`，改为仅 `--clean-all` 触发（该参数在 `:14`/`:136` 已存在）。净减 ≈ 22 行，恢复增量编译。

---

## 四、请求链路层数与"只做转发的层"

### 实测链路 A：评论分页（客户端 → DB 共 10 跳）

1. `src/components/post/CommentsSection.tsx:55` `useComments(postId, initialData)`
2. `src/hooks/useComments.ts:87` `api.get<CommentsListData>('/posts/{id}/comments', { limit, offset })`
3. `src/lib/api-request.ts:162-172` `api.get` → `apiRequest(:65)` → `buildUrl(:19)`
4. `src/app/api/posts/[id]/comments/route.ts:7` `defineRoute(..., { auth: "optional" })`
5. `src/server/common/http/route-handler.ts:30-56` 鉴权 + 展开 params
6. `src/server/comment/comment.service.ts:43` `listComments`
7. `src/server/post/post.service.ts:397` `assertPostReadable` ← 跨域断言
8. `src/server/comment/comment.repository.ts:32` `listCommentsByPostId` + `:46` `countComments`（2 次查询）
9. `src/server/common/db.ts:22` `getDb()` → drizzle neon-http
10. `src/server/db/schema.ts` → SQL

第 4/5 跳可合并（`defineRoute` 是唯一中间层），第 7 跳是跨域转发。

### 实测链路 B：点赞（客户端 → DB 共 11 跳）

1. `PostActions.tsx:82` `likeMutation.mutate(post.id)`
2. `src/hooks/usePosts.ts:44` → `useTogglePostAssociation(:58)` → `:73` `useAsyncAction`
3. `src/hooks/useAsyncAction.ts:58-91` `mutate`
4. `src/server/post/post.controller.ts:83` `toggleLikeAction`
5. `src/server/common/action-result.ts:46` `runAction` + `:57` `ensureNotRateLimited`
6. `src/server/common/rate-limit.ts:8` `isRateLimited`（1 次 DB 往返）
7. `src/server/auth/auth.guard.ts:112` `requireAuthPayload` → `:102` `getAuthPayload` → `:92-100`
8. `src/server/post/post.service.ts:351` `togglePostLike` → `:337` `togglePostAssociation` → `:342` `findPostStatus`（另 1 次 DB）
9. `src/server/post/post.repository.ts:365` `togglePostAssociationAndCounters`（CTE，1 次 DB）
10. `src/server/post/post.cache.ts:50-57` `invalidatePostCache` + `revalidatePostPath`
11. `src/server/db/schema.ts`

**结论**：一次点赞 = 客户端 4 个文件 + 服务端 7 个文件 = **11 跳、3 次 DB 往返、2 层零逻辑转发**（`usePosts.ts:58` 的 `useTogglePostAssociation`、`post.service.ts:337` 的 `togglePostAssociation`）。

### 【过度设计·冗余】F17. 个人博客应 **3 层，不是 6 层**

现状 6 层：page/action → controller → validator → service → cache → repository → db。
实际业务量：**5 张表 / 43 列 / 10 索引 / 双作者 / 8 条路由**（`schema.ts` 全文 152 行；页面为 `/`、`/posts`、`/posts/[id]`、`/login`、`/register`、`/write`、`/profile`、`/settings`）。

推荐目标 **3 层**：

1. **路由/动作层** `src/app/**` + `src/server/<domain>/actions.ts`（`"use server"`：鉴权 + 限流 + zod + revalidate）
2. **数据访问层** `src/server/<domain>/queries.ts`（drizzle/SQL + row→domain 映射）
3. **共享基础层** `src/server/common/**`（db、errors、token、rate-limit、env——现有 13 文件 528 行，大部分合理）

删除：3 个 `validator.ts`、`user.service.ts`（全部）、`post`/`comment` service 的转发部分、cache 的转发部分。server 侧 2,757 行 → ≈ 2,000 行。

---

## 五、路由 / 骨架 / 加载态

### 【过度设计·冗余】F18. 13 个手写骨架（924 行）+ 8 个 `loading.tsx`（40 行）只是同一份 JSX 的搬运

**问题描述**
8 个 `loading.tsx` 全部是 5 行、只做一次转发：

| `loading.tsx`                          | 目标骨架             | 骨架行数                                                |
| -------------------------------------- | -------------------- | ------------------------------------------------------- |
| `(home)/loading.tsx:1,4`               | `HomeSkeleton`       | 156                                                     |
| `posts/loading.tsx:1,4`                | `PostsListSkeleton`  | 29 → `PostsBodySkeleton` 103 → `PostSidebarSkeleton` 47 |
| `posts/[id]/loading.tsx:1,4`           | `PostDetailSkeleton` | 106                                                     |
| `(dashboard)/write/loading.tsx:1,4`    | `WriteSkeleton`      | 164                                                     |
| `(dashboard)/profile/loading.tsx:1,4`  | `ProfileSkeleton`    | 148                                                     |
| `(dashboard)/settings/loading.tsx:1,4` | `SettingsSkeleton`   | 97                                                      |
| `(auth)/login/loading.tsx:1,4`         | `LoginSkeleton`      | 63                                                      |
| `(auth)/register/loading.tsx:1,4`      | `RegisterSkeleton`   | 75                                                      |

**内部重复（逐字/近似）**：

- `SettingsSkeleton.tsx:8-32` 的 `Label`/`Hint`/`Field`、`WriteSkeleton.tsx:58-86` 的 `Field`、`LoginSkeleton.tsx:5-17` 的 `Field`、`RegisterSkeleton.tsx:7-27` 的 `Field` —— **同一组件的 4 份实现**（label 骨架条 + h-9 输入框骨架 + 可选 hint 骨架）。
- `PostsBodySkeleton.tsx:12-69` 的 `CardSkeleton` 与 `ProfileSkeleton.tsx:31-61` 的 `CardSkeleton` —— 同一卡片骨架的两份（都含 `aspect-16/10` 封面 + CAT/TITLE/SUMMARY/META 行）。
- `primitives.ts` 仅 **7 行**（`BAR`、`line()`、`PAGE_TITLE_LINE`、`PAGE_SUBTITLE_LINE`）：924 行骨架只共享 4 个常量。`line("h-[22.4px]")` 这类硬编码像素高度在文件内反复出现（`HomeSkeleton.tsx:4-29` 一处就有 8 个局部常量，`ProfileSkeleton.tsx:4-20` 有 9 个）。

**为什么是问题**

- 骨架是**无业务逻辑的装饰内容**，924 行占 `src` 的 7%，却要跟随每次 UI 改版同步（`b8326f3` 已因格式调整全局改动过）。
- Next 16 语义：`loading.js` 包裹 `not-found`/`page`/嵌套 `layout`，**不包裹同段 `layout`**（`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md:86`）。`Cache Components` 下官方更推荐把 Suspense 边界放在数据读取点，见 `loading.md:88-93`："To ensure instant navigation, move uncached data fetching from `layout.js` into `page.js`, or wrap the runtime data access in your layout in its own `<Suspense>` boundary."
- 8 个 5 行文件本身是噪音：`loading.tsx` 默认就是 Server Component（`loading.md:32`），JSX 直接写进去即可。

**简化方案**

1. 骨架收敛为 3 个组合式原语：`SkeletonBar`、`SkeletonField`（替换 4 份 `Field`）、`SkeletonCard`（替换 2 份 `CardSkeleton`）。
2. 各页骨架改为在原 `page.tsx` 内用 `<Suspense fallback={...}>` 就地声明，删除 8 个 `loading.tsx`。
3. 独立骨架文件只保留 2 个：`HomeSkeleton`（hero 视觉区）、`WriteSkeleton`（双栏编辑器）。

预计 924 + 40 → ≈ 300 行，**净减 ≈ 660 行**。

---

### 【过度设计·冗余】F19. 5 个 error 边界 / 3 个 404 文件 / 1 个全局错误样式表，重复度极高

**问题描述**

- `src/app/error.tsx`（50 行）、`src/app/posts/error.tsx`（26 行）、`src/app/posts/[id]/error.tsx`（26 行）。后两者是同一模板（`Container > div.animate-fade-in > EmptyState(icon, title, description, action=Button href="/posts")`），只有 icon、3 条文案、按钮文字不同。
- Next 语义：`error.js` 用 Error Boundary 包裹 `loading`/`not-found`/`page`/嵌套 `layout`（`error.md:96`）。根 `app/error.tsx` 已覆盖全部子段；两个 posts error 提供的是"更贴合文案"，代价 52 行 + 4 条新文案 key（`texts/errors.ts:20-28`）。
- 404 三份：`app/not-found.tsx`（25 行，走布局）、`app/global-not-found.tsx`（68 行，自带 `<html>/<body>` + 内联 CSS）、`app/error-page-shell.ts`（63 行，导出 `ERROR_PAGE_CSS` + `THEME_INIT_SCRIPT` + 3 个 inline style 对象）。
- `error-page-shell.ts:3-26` 把主题 token **硬编码成第二份** `oklch(...)` 字面量，并在注释里声明映射（`/* = --background */`）。即 `src/app/styles/tokens.css`（170 行）与 `error-page-shell.ts` 是同一套设计 token 的两个来源。`:27` 注释"错误页不加载 Tailwind，居中与配色全部自带"揭示了原因——属**必要冗余**（见第七节），但复制范围可缩小。
- `global-error.tsx`（74 行）`:14-23` 又内联第二段 CSS（`RELOAD_CSS`），`:51-66` 内联按钮样式。

**为什么是问题**
`global-not-found` 需要 `experimental.globalNotFound` 开关（`not-found.md:60-72`；本项目已在 `next.config.ts:25-27` 开启）。官方给出的存在理由是"多个根布局"或"根布局使用顶层动态段"（`not-found.md:55-58`）——本项目只有一个根布局，属**用不到的扩展点**。它绕过正常渲染故必须自带全部样式（`not-found.md:51`），这正是 63 行 `error-page-shell.ts` 的由来。

**简化方案**

1. 删除 `posts/error.tsx` 与 `posts/[id]/error.tsx`（−52 行），根 `app/error.tsx` 已覆盖；`texts/errors.ts` 可删 `postsError*`/`postError*`/`backToList` 4 条。
2. 删除 `global-not-found.tsx` + `next.config.ts:25-27`（−68 行，−3 行 config）：单根布局下 `app/not-found.tsx` 已处理所有未匹配 URL（`not-found.md:133`）。
3. `error-page-shell.ts` 缩减为仅供 `global-error.tsx` 使用（`global-error` 必需自带 `<html>/<body>` 与样式，`error.md:163`），并移除重复的 `THEME_INIT_SCRIPT`（见 F21）。

净减 ≈ 120 行 + 4 条文案。

---

### 【过度设计·冗余】F20. `src/app/template.tsx` 是 Next 文档原文示例，且不产生任何效果

**问题描述**
`src/app/template.tsx` 全文 3 行，与 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/template.md:26-30` 的示例**逐字相同**：

```tsx
export default function Template({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

`template.js` 的语义是给子段一个 unique key 使其 remount（`template.md:6`、`:47`）。但本项目**没有任何状态需要在导航时重置**：表单脏状态由 `useUnsavedGuard` + `baseline` 自管（`WriteEditor.tsx:88-96,189`）。

**为什么是问题**

- 引入额外一层 DOM `<div>`，且每次一级段导航都 remount 整棵子树（`template.md:65-68`），对 `(home)` 这类含大列表的页面纯属浪费。
- 与全局 Suspense 交互：`template.md:12` 指出 template 会让 Suspense fallback 在**每次**导航都显示，而非仅首次——这与 F18 想做的"把 Suspense 放进 page"直接冲突。

**简化方案**
删除 `src/app/template.tsx`（−3 行）及其 remount 语义。

---

### 【过度设计·冗余】F21. 手写主题初始化脚本与 `next-themes` 职责重叠

**问题描述**

- `src/app/error-page-shell.ts:35` 定义 `THEME_INIT_SCRIPT`（读 `localStorage.getItem("theme")` + `matchMedia` + 加 `dark` class）。
- 注入点 3 处：`src/app/layout.tsx:60`（`<script dangerouslySetInnerHTML>`，位于 `<Providers>` 之前）、`global-error.tsx:40`、`global-not-found.tsx:30`。
- 而 `src/components/Providers.tsx:21` 已用 `next-themes` 的 `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>`，`next-themes` 自带同职责的阻塞式注入脚本；`layout.tsx:58` 的 `suppressHydrationWarning` 正是为它准备的标准写法。

**为什么是问题**
同一件事（预水合设 `dark` class）两套实现。`layout.tsx:60` 那处是纯冗余；`global-error.tsx:40` / `global-not-found.tsx:30` 两处属**必要冗余**（它们绕过根布局，见 `error.md:163`、`not-found.md:51`）。手写脚本未处理 `next-themes` 的 storage 事件同步，长期会与 `ThemeProvider` 漂移。

**简化方案**
删除 `layout.tsx:60` 的注入与对应 import（−2 行）；另两处保留。若再执行 F19（删 `global-not-found`），则仅剩 `global-error` 一处使用 `THEME_INIT_SCRIPT`，可整体内联进 `global-error.tsx` 并删掉该导出。

---

### 【潜在风险】F22. 鉴权被实现了 4 遍，其中 2 遍在客户端、1 遍只查 cookie 存在性

**问题描述**

1. `src/proxy.ts:10-23`：仅检查 `AUTH_TOKEN_COOKIE` **是否存在**（`:14-15`），不做签名/过期/存量校验。
2. `src/components/auth/AuthGuard.tsx`（35 行，被 `(auth)/layout.tsx:7` 使用）：`useEffect` 中读 `window.location.search`，若已登录则 `setTimeout(500ms)` 后 `router.replace(safe)`——一个 500ms 延迟跳转（`:28`）。
3. `src/components/auth/AuthGate.tsx`（25 行，被 `(dashboard)/layout.tsx:6` 使用）：未登录渲染 `<LoginRequired>`；但 `isLoading` 时**直接渲染 children**（`:11-13`）。
4. `src/server/auth/auth.guard.ts:118-124` `requireUserOrRedirect`（真正的服务端守卫，被 3 个 dashboard page 调用）。

**Next 16 权威事实（按要求核对安装源码）**：`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:255` —— "Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files."；版本表 `proxy.md:806` —— "`v16.0.0` Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime"。**因此 `jsonwebtoken`（`common/token.ts:3`）在 Proxy 中可正常工作，"必须换 jose"的假设不成立。**
但同一文档 `proxy.md:249-251` 强调：Server Function 不是独立路由，matcher 排除会一并跳过，"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."

**为什么是问题**

- `proxy.ts` 的唯一作用是"没 cookie 就跳登录"，而它保护的 3 条路由（`config/site.ts:6` `/write` `/settings` `/profile`）在 page 层已有 `requireUserOrRedirect`（真 token 校验）。浅检查的中间层 + 真检查的服务端守卫，前者是冗余。
- `AuthGate.tsx:11-13` 在 `isLoading` 时渲染受保护内容，配合 `AuthGuard.tsx:28` 的 500ms 延迟跳转，是两套互不相干的客户端兜底，语义不一致。
- 鉴权总量：`proxy.ts` 24 + `auth.guard.ts` 141 + `AuthProvider.tsx` 122 + `AuthGuard.tsx` 35 + `AuthGate.tsx` 25 = **347 行 / 5 文件**。

**简化方案**
保留 `auth.guard.ts`（服务端单点：`requireUserOrRedirect` / `requireAuthPayload`）与 `proxy.ts`（定位本就是快速重定向，`proxy.md:15`："particularly useful for implementing ... redirects"）。删除 `AuthGuard.tsx`（35 行），把 `(auth)/layout.tsx` 的"已登录跳转"移入两个 auth page 的服务端组件（`getAuthPayload()` + `redirect()`）；`AuthGate.tsx` 并入 `(dashboard)/layout.tsx`。

---

### 【优化项】F23. `PostViewTracker` + `/api/posts/[id]/view` 与 `PostStateProvider` 双路径自增 views

**问题描述**

- 上报路径：`PostViewTracker.tsx:20` `api.post('/posts/{id}/view')` → `app/api/posts/[id]/view/route.ts:12` `recordPostView(id)` → `post.service.ts:319-334` 在 `after()` 里 `incrementPostCounterStmt(postId, "views", 1)` + `incrementUserStatStmt(authorId, "views", 1)`。
- 本地路径：`PostStateProvider.tsx:26-30` `useEffect(() => setPost(prev => ({ ...prev, views: prev.views + 1 })), [])`。

一次真实浏览走两条自增（一条写库、一条只改本地 state），初值来自服务端 `post.views`。本地自增只为让页头数字立刻 +1。

**为什么是问题**
两条路径的计数语义无单一来源（"真实浏览量" vs "乐观显示"）；`reported` Set 还带一个 50 条上限的手写 LRU（`:8,14-17`）。

**简化方案**
保留 route handler——它是 fire-and-forget POST，不适合放渲染期的 Server Action，属合理存在。删除 `PostStateProvider.tsx:26-30` 的本地自增（−5 行），改为在 `PostViewTracker` 成功后调用 `updatePost`，让两条路径汇合。

---

## 六、依赖评估（含实测体积）

| 依赖                                                                                                    | 实测                                                                                                                                                               | 用量证据                                                                                                                                                                         | 结论                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `highlight.js`                                                                                          | 安装 5,503,982 B；使用 `lib/core` + 逐语言（`post.render.ts:5-19` 14 种、`markdown.ts:186-197` 8 种）                                                              | 2 个渲染器                                                                                                                                                                       | 【合理】语法子集导入正确，未引入全量；但两端语言集不一致（见 F5）                                                                                                                                                                                                                                                                                               |
| `drizzle-orm` + `@neondatabase/serverless` + `drizzle-kit`                                              | `drizzle-orm` 安装 10,522,849 B；schema **5 表 / 43 列 / 10 索引**（`schema.ts` 152 行）                                                                           | `getDb()` 单点（`common/db.ts:22-29`）                                                                                                                                           | 【潜在风险】ORM + driver + kit 三件套换 5 张表偏重。**但** `getDb().batch([...])` 被大量用于原子多语句写（`post.service.ts:228/288/303/321`、`comment.service.ts:82`、`user.repository.ts:121/275`、`rate-limit.ts:26`），是真实收益（`common/db.ts:31` 注释"整批一个 fetch，要么全成要么全废"）。**建议保留**，但移除未使用的 `db:studio`（`package.json:25`） |
| `sanitize-html`                                                                                         | 本体 75,666 B + 7 个直接依赖（`deepmerge`、`escape-string-regexp`、`htmlparser2`、`is-plain-object`、`parse-srcset`、`postcss`、`launder`）                        | 仅 2 处：`post.render.ts:26,148`（白名单）+ `comment.service.ts:5,40`                                                                                                            | 【过度设计】`comment.service.ts:40` 只需"删掉全部标签"（`allowedTags: []`），用现有 `stripHtml`（`shared/markdown.ts:59-64`）即可，完全不需要 htmlparser2 + postcss 这套。改为只用 `stripHtml` 后，`sanitize-html` 仅服务 `post.render`，可再评估更小的白名单方案                                                                                               |
| `jsonwebtoken`                                                                                          | 48,008 B                                                                                                                                                           | 仅 `common/token.ts:3`                                                                                                                                                           | 【合理】Next 16 Proxy 默认 Node runtime（`proxy.md:255`），**不需要** jose；`proxy.ts` 本身也不解 token                                                                                                                                                                                                                                                         |
| `lucide-react`                                                                                          | 1.46.0，安装 35,021,074 B / 4204 个图标文件；`package.json` 有 `sideEffects: false`、`module: dist/esm/lucide-react.mjs`，**无 `exports` 字段**（已实测 key 列表） | **53 个不重复图标**、**32 条 barrel import**，全部走 `from "lucide-react"` 顶层路径                                                                                              | 【合理】`sideEffects: false` + ESM 允许摇树，35 MB 是磁盘安装体积而非 bundle 体积；53/4204 的用量由 tree-shaking 处理。**不建议**改深路径导入（缺 `exports` 会破坏封装）                                                                                                                                                                                        |
| `zod`                                                                                                   | 6,140,311 B                                                                                                                                                        | schema：`auth.ts` 6 个、`post.ts` 2 个、`comment.ts` 1 个、`builders.ts` 2 个构造器；服务端（`common/zod.ts`）与客户端（`lib/form-feedback.ts`）共用，且刻意用 `zod/mini` 子路径 | 【合理】子路径用法正确、双端复用；重复只在 schema 内容层（见 F8/F9），非依赖问题                                                                                                                                                                                                                                                                                |
| `sonner`                                                                                                | —                                                                                                                                                                  | `lib/toast.ts:12` 单一动态 import + `ui/Sonner.tsx`（20 行）                                                                                                                     | 【合理】一个 `notify.*` map 屏蔽了库差异                                                                                                                                                                                                                                                                                                                        |
| `next-themes`                                                                                           | —                                                                                                                                                                  | `Providers.tsx:5,21`、`Sonner.tsx:3,7`、`ThemeToggle.tsx:5,18`                                                                                                                   | 【合理】但手写 `THEME_INIT_SCRIPT` 与之重叠（F21）                                                                                                                                                                                                                                                                                                              |
| `bcryptjs` / `server-only`                                                                              | —                                                                                                                                                                  | `common/password.ts:3`；`server-only` 出现在 20+ 服务端文件                                                                                                                      | 【合理】                                                                                                                                                                                                                                                                                                                                                        |
| `@next/bundle-analyzer`                                                                                 | devDep                                                                                                                                                             | `next.config.ts:2,5-6` 包装正确（`ANALYZE === "true"`），`package.json:12` `ANALYZE=true next build`                                                                             | 【合理】接线完整可用                                                                                                                                                                                                                                                                                                                                            |
| `dotenv`                                                                                                | devDep                                                                                                                                                             | `drizzle.config.ts:1,5`、`scripts/db-push.mjs:6,12`                                                                                                                              | 【合理】                                                                                                                                                                                                                                                                                                                                                        |
| `@netlify/plugin-nextjs`                                                                                | devDep 5.15.13                                                                                                                                                     | **grep 零引用**（无 `netlify.toml` 与之配套）；同时存在 `railway.json:1-11`（`buildCommand: pnpm build`、`startCommand: pnpm start`、`healthcheckPath: "/"`）                    | 【过度设计·冗余】两套部署平台配置并存。删除其一                                                                                                                                                                                                                                                                                                                 |
| `eslint` + `eslint-config-next` + `eslint-config-prettier` + `prettier` + `prettier-plugin-tailwindcss` | `eslint.config.mjs` 199 行                                                                                                                                         | —                                                                                                                                                                                | 【合理】                                                                                                                                                                                                                                                                                                                                                        |
| `@neondatabase/serverless`（在 `scripts/db-push.mjs:7` 直用）                                           | —                                                                                                                                                                  | 该脚本 36 行，只为在 `drizzle-kit push` 前执行 `CREATE EXTENSION IF NOT EXISTS pg_trgm`（`:21-23`，注释说明 trgm 索引依赖扩展）                                                  | 【优化项】`db:push` 是唯一消费者；可把扩展创建并入迁移或用 hook，省掉 36 行脚本（`package.json:23`）                                                                                                                                                                                                                                                            |

**无用的 package.json 条目**：`strip-comments` / `strip-comments:check`（`:21-22`，对应 F15）、`db:studio`（`:25`）。

---

## 七、合理抽象（判定为不冗余，故意未列入整改）

1. **`src/shared/` 的 `@shared` barrel**（`index.ts` 3 行 → `types/index.ts` 9 行 + `validation/index.ts` 6 行）—— grep 统计 `from "@shared"` / `from '@shared'` 共 **85 处**，是仓库主流导入形式；深路径导入（`@shared/markdown`、`@shared/format`）只用于服务端/格式化场景，未见同一模块两种路径混用。18 行换 85 处一致性，**合理**。

2. **`src/texts/**`（14 文件 371 行）** —— 本次审计最需澄清的一项。**它不是 i18n 层**：无 locale 表、无 `t()`、无运行期切换；`texts/auth.ts:1` 就是 `const auth = { loginTitle: "欢迎回来", ... }`，消费方式是 `auth.loginTitle` 直接属性访问。git `c2712c7 feat: 移除多语言支持` 之后它退化为"字符串集中存放"。**但结论是保留**，量化依据：
   - 用量充分：14 个文件**全部**被引用（`feedback` 11 处、`common` 10 处、`meta` 8 处、`format` 8 处、`nav` 7 处、`write` 6 处、`errors` 5 处、`post-detail` 5 处、`auth` 4 处、`profile` 4 处、`post-list` 3 处、`home` 2 处、`settings` 2 处、`footer` 1 处）。
   - 跨端复用：同一批字符串同时被 Server Component（`app/layout.tsx:8-9`、`app/posts/page.tsx:13-16`、`rss/route.ts:6`、`app/manifest.ts:2`、`app/sitemap` 链路）与 Client Component（`shell/UserMenu.tsx:6`、`shell/MobileMenu.tsx:8`、`components/post/CommentsSection.tsx:6-9` 等）消费。内联后 `meta.siteTitle` 会在 `layout.tsx`、`manifest.ts`、`global-error.tsx` 等 6 处重复。
   - 有真实参数化：`texts/format.ts:5-10` `formatTemplate` 被 15 处调用（`{count}`/`{field}`/`{minutes}`/`{status}` 等占位符）。
   - **净账**：内联需改 ≈ 60 个文件的 import 与 ≈ 370 处引用点（改 370 行），换 371 行删除 = **净亏约 370 行**。
     故 `texts` 判为**合理抽象**，不整改。

3. **`src/lib/error-message.ts`（83 行）** —— `HTTP_STATUS_TEXT_KEY`（`:16-24`）把 7 个状态码映射到文案 key，`toValidationError`（`:45-82`）把 zod 的 `code`/`rule`/`params` 翻成人话。被 `form-feedback.ts`（3 处）与 `toast.ts`（1 处）复用，是"错误码 → 用户文案"的单一映射点。**合理**。

4. **`src/lib/form-feedback.ts`（134 行）** —— `resolveSubmitError`/`validateForm`/`validateFieldValue`/`focusFirstInvalid`/`hasFeedback` 被 5 个表单共享（LoginForm、RegisterForm、SettingsForm、WriteEditor、CommentsSection），统一了"字段错误 vs 表单级错误 vs toast"三分法。**合理**。

5. **`src/components/ui/**`（17 文件 494 行，均值 29 行/文件）** —— `Button.tsx`（63 行）处理 button/link 多态 + loading + `aria-busy`/`aria-disabled`；`Modal.tsx`（116 行）做了 focus trap + 焦点归还 + portal + 退场动画。即便 `Modal` 只有 1 个消费者（`UnsavedChangesDialog`），其内部逻辑量足以自证。**合理**。

6. **`src/server/common/**`（13 文件 528 行）** —— `app-error.ts`（82 行，`Symbol.for` 品牌 + 结构判定用于跨 bundle 边界识别错误）、`env.ts`（65 行，生产环境 `JWT_SECRET` 长度校验 + 时长解析）、`rate-limit.ts`（65 行，DB 原子 upsert 计数）、`logger.ts`（59 行）。**合理**。

7. **`src/app/error-page-shell.ts` 的 token 双份** —— `:27` 注释"错误页不加载 Tailwind，居中与配色全部自带，不依赖任何工具类"。`global-error.tsx` 必须自带 `<html>/<body>` 且**不含全局样式**：`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md:163`（"Global error UI must define its own `<html>` and `<body>` tags, global styles, fonts, or other dependencies that your error page requires"）+ `:165`（"global-error and the built-in 500 page render their own document and do not include your global styles"）。因此 CSS 变量必须复制——**必要冗余**（复制范围可缩小，见 F19）。

8. **`src/server/common/db.ts:32-34` `atomicBatch`** —— 包装仅 3 行，换来 `.batch()` 的类型收紧（`[AtomicStatement, ...AtomicStatement[]]`）。**合理**。

9. **`src/app/(dashboard)/profile/page.tsx:10` `export const instant = false`** —— 已核对 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md:22`（"The `instant` export only works when `cacheComponents` is enabled"）、`:115`（"Setting `instant = false` on a segment opts it out of validation entirely"）、`:86`（static-shell 校验豁免）；本项目 `next.config.ts:9` 已开 `cacheComponents: true`。**合理**。

10. **`src/server/common/errors/app-error.ts:19-30` `isAppError` 三重判定** —— `instanceof` + `Symbol.for` 品牌 + 结构鸭子类型。Server Action / RSC 序列化会丢原型链，三层判定是**必要冗余**。

11. **`src/hooks/useThrottledScroll.ts`（29 行）** —— 被 `PostToc.tsx:42` 与 `BackToTop.tsx:11` 使用；rAF 节流 + passive 监听实现正确。**合理**。

12. **`src/hooks/useDismissable.ts`（50 行）** —— 被 `Modal.tsx:26`、`UserMenu.tsx:39`、`MobileMenu.tsx:55` 三处使用，统一 Escape + 外部点击 + 滚动锁。**合理**。

13. **`src/hooks/useTabListKeyboard.ts`（45 行）** —— 被 `ProfileTabs.tsx:31` 与 `SettingsForm.tsx:54` 使用，实现 roving tabindex + Home/End/方向键。**合理**。

14. **`next.config.ts:33-71` 的 CSP / 安全响应头** —— 一次性配置，非抽象。**合理**。

15. **`src/lib/write-draft.ts`（71 行）** —— 草稿 localStorage 持久化，含 `isMeaningful` 空草稿判定（`:30-35`）与 `persistDraft` 的"空则删除"逻辑（`:51-60`），被 `WriteEditor.tsx` 5 处调用。**合理**。

---

## 八、建议的目标架构与行数估算

```
src/
├─ app/                                  # 路由；Suspense 就地声明
│  ├─ layout.tsx  globals.css  styles/
│  ├─ (home)/page.tsx
│  ├─ posts/page.tsx  posts/[id]/page.tsx
│  ├─ (auth)/{login,register}/page.tsx
│  ├─ (dashboard)/{write,profile,settings}/page.tsx
│  ├─ api/posts/[id]/comments/route.ts    # 唯一必需的分页 GET
│  ├─ api/posts/[id]/view/route.ts        # fire-and-forget POST
│  ├─ api/auth/refresh/route.ts           # api-request 依赖
│  ├─ not-found.tsx  error.tsx  global-error.tsx  error-page-shell.ts
│  ├─ robots.ts  sitemap.ts  manifest.ts  icon.svg  apple-icon.tsx  rss/route.ts
│  └─ template.tsx                        # ← 删除
├─ components/
│  ├─ ui/                                 # 16 个通用组件（FormField 改 htmlFor 必填）
│  ├─ skeletons/                          # 仅 SkeletonBar/SkeletonField/SkeletonCard
│  │                                      # + HomeSkeleton + WriteSkeleton
│  ├─ shell/  auth/  post/  dashboard/
│  ├─ AuthProvider.tsx                    # 删 auth/AuthGuard.tsx；AuthGate 并入 (dashboard)/layout.tsx
│  └─ Providers.tsx
├─ server/
│  ├─ db/schema.ts
│  ├─ common/{db,logger,password,token,zod,rate-limit,policy}.ts
│  ├─ common/config/env.ts
│  ├─ common/errors/{app-error,serialize}.ts      # serialize.ts 合并 toFailure/sendError
│  ├─ common/http/{api-response,route-handler}.ts
│  ├─ auth/{actions,guard,cookie,queries}.ts      # 删 validator/service
│  ├─ post/{actions,cache,render,queries}.ts      # 合并 controller/service/repository
│  ├─ comment/{actions,cache,queries}.ts          # 合并 controller/service/repository
│  └─ user/queries.ts                             # 删除 service.ts 整文件
├─ shared/{types,validation,format,markdown,constants,index}.ts
│                                         # markdown.ts 只留 strip*/estimate/高亮工具，删 getMarkdownRenderer
├─ lib/{api-request,form-feedback,error-message,toast,write-draft,seo,url}.ts
│                                         # 删 validation-loader.ts；auth-status 并入 AuthProvider
│                                         # build-posts-url 并入 url.ts
├─ hooks/{usePosts,useComments,useAuth,useDismissable,useTabListKeyboard,useThrottledScroll}.ts
│                                         # 删 useAsyncAction 重试段
│                                         # useCurrentUser+useRequireAuth+usePostPageAuth 合并
│                                         # useLogoutRedirect 并入 UserMenu/MobileMenu
├─ texts/                                 # 保留（见第七节第 2 条）
└─ config/site.ts
scripts/dev.mjs                           # 删 strip-comments.mjs；db-push.mjs 简化
```

**行数估算（基线 13,276 行）**

| 项                                                                                                                   | 当前       | 目标         | 差额                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ---------------------- |
| skeletons + 8×`loading.tsx`                                                                                          | 924 + 40   | ≈ 300        | **−664**               |
| `comment-template/`                                                                                                  | 328        | 0            | **−328**               |
| `strip-comments.mjs` + 2 个 script                                                                                   | 291 + 2    | 0            | **−293**               |
| server 分层（`user.service` 整删、3 个 validator、re-export、pass-through、`updateUserRecord` 瘦身、错误序列化合并） | 2,757      | ≈ 2,050      | **−707**               |
| `shared/markdown.ts` 客户端渲染器                                                                                    | 233        | ≈ 167        | **−66**                |
| error / not-found（删 2 个 posts error + `global-not-found` + 4 条文案）                                             | 258        | ≈ 140        | **−118**               |
| hooks（重试段 + 3 个 auth hook 合并）                                                                                | 504        | ≈ 400        | **−104**               |
| lib（`validation-loader` 改直连、`auth-status` 并入、`build-posts-url` 并入 `url`）                                  | 517        | ≈ 450        | **−67**                |
| `FormField` / `url.ts` / `CoverField` 等小项                                                                         | —          | —            | **−45**                |
| `dev.mjs` 清缓存段                                                                                                   | 134        | ≈ 112        | **−22**                |
| `template.tsx` + 死导出 + 无用配置                                                                                   | —          | —            | **−10**                |
| **合计**                                                                                                             | **13,276** | **≈ 10,950** | **≈ −2,326（−17.5%）** |

（不含 `texts` 的 371 行——按第七节第 2 条判定为合理抽象，保持不动。文件数 207 → ≈ 165。）

---

## 九、可批量执行的整改清单（按风险从低到高）

1. 删除 `comment-template/`（−328 行）+ `.prettierignore:7` —— 零风险。
2. 删除 `src/app/template.tsx`（−3 行）—— 零风险。
3. 删除死导出：`DashboardSkeleton.tsx`（−29 行）、`validation-loader.ts:31`、`schema.ts:151` —— 零风险（已 grep 证明 0 引用）。
4. 删除 `useAsyncAction` 的 `retry` 参数与整段重试（−42 行）—— 零风险（8 个调用点均未传）。
5. 删除 `scripts/strip-comments.mjs` + `package.json:21-22`（−293 行）—— 零风险（不在 CI/构建链路）。
6. 删除 `layout.tsx:60` 的 `THEME_INIT_SCRIPT` 注入（−2 行）—— 低风险，需目视确认暗色首屏无闪烁。
7. 删除 `src/server/user/user.service.ts`（−54 行），改 6 处 import 指向 `user.repository.ts` —— 低风险，纯机械。
8. 删除 `post.validator.ts` / `comment.validator.ts`，controller 内联 `createParser`（−26 行）—— 低风险。
9. 删除 4 处 re-export（`post.service.ts:53,412`、`post.cache.ts:26`、`comment.service.ts:27`）并改 4 处 import —— 低风险。
10. `sanitize-html` 在 `comment.service.ts:40` 换成现有 `stripHtml`（−1 依赖用到 1 处）—— 低风险，需确认剥离结果一致。
11. 删除 `posts/error.tsx` + `posts/[id]/error.tsx` + `global-not-found.tsx` + `next.config.ts:25-27`（−120 行）—— 中风险，需回归 404 与段错误文案。
12. `@netlify/plugin-nextjs` 与 `railway.json` 二选一 —— 中风险，取决于实际部署目标。
13. 骨架收敛为 3 个原语 + Suspense 就地声明（−660 行）—— 中风险，需逐页目视核对布局抖动。
14. `FormField` 加 `htmlFor`、删 `findControlId`（−18 行，改 12 处调用）—— 中风险。
15. 客户端 Markdown 预览改走 Server Action（−66 行 + 减小客户端 bundle）—— 中风险，需验证预览延迟可接受。
16. `AuthGuard.tsx` 删除、逻辑移入 auth page 服务端（−35 行）—— 中高风险，涉及登录跳转，必须回归 `/login?redirect=&stale=1` 与"已登录访问 `/login`"两条流程。
