# my-blog 完整架构评审报告

> 分支：`dev`　构建基准：`next@16.3.5` / `react@19.3.0` / `drizzle-orm@0.45.4` / `@netlify/plugin-nextjs@5.15.13`
> 判断依据：`node_modules/next/dist/**`（源码、`*.d.ts`、`dist/docs/**` 内置文档）、`node_modules/drizzle-orm/neon-http/**`、`node_modules/@neondatabase/serverless/index.js`、`node_modules/@netlify/plugin-nextjs/dist/**`、`node_modules/jsonwebtoken/decode.js`，以及本机真实构建产物 `.next/**`。
> 凡未能从本地源码证实的平台行为，均显式标注「待实测」。

---

## 0. 结论速览

| #   | 级别     | 问题                                                                                                              | 位置                                                  |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | 严重缺陷 | 限流可被伪造头绕过（Netlify 安全、Railway 可绕过）                                                                | `rate-limit.ts:47-65`                                 |
| 2   | 严重缺陷 | 限流**失败即放行**，且 `rate_limits` 无迁移 → 漏建表时限流静默全失效                                              | `rate-limit.ts:41-44`                                 |
| 3   | 严重缺陷 | ILIKE 中缀搜索**用不上任何索引**，全表扫描                                                                        | `post.repository.ts:107-123`                          |
| 4   | 严重缺陷 | `generateStaticParams` 用 `catch {}` 吞掉数据库故障，构建成功但产物退化                                           | `posts/[id]/page.tsx:35-44`                           |
| 5   | 严重缺陷 | `withDbRetry` 对**非幂等写**无条件重试一次                                                                        | `common/db.ts:38-49`                                  |
| 6   | 严重缺陷 | 删除/更新文章**完全无限流**                                                                                       | `post.controller.ts:55-81`                            |
| 7   | 严重缺陷 | 匿名可请求 `limit=20000` 的文章列表（放大攻击面）                                                                 | `policy.ts:68`                                        |
| 8   | 潜在风险 | 刷新宽限路径用**未验签**的 `jwt.decode`，且 iss/aud 未校验                                                        | `auth.guard.ts:40-49` + `token.ts:38`                 |
| 9   | 潜在风险 | 登出失败时前端仍清空本地状态 → 服务端会话残留                                                                     | `useAuth.ts:11-19`                                    |
| 10  | 潜在风险 | Server Action 的 401 **永不触发**静默续期（refresh 流程形同虚设）                                                 | `api-request.ts:137-155`                              |
| 11  | 潜在风险 | 客户端 Markdown 预览**未做 XSS 净化**就 `dangerouslySetInnerHTML`                                                 | `MarkdownPane.tsx:47-51,132,141`                      |
| 12  | 潜在风险 | 点赞/收藏/浏览每次写都失效整站缓存，双平台缓存行为不一致                                                          | `post.controller.ts:91-92`、`post.service.ts:319-334` |
| 13  | 潜在风险 | `/posts?…` 依赖 `searchParams`，分页/筛选每次都进函数与数据库                                                     | `posts/page.tsx:39-71`                                |
| 14  | 过度设计 | 单作者博客上套 8 层纵切 + 13 个骨架（924 行，占全项目 7.8%）+ 自定义注释剥离工具（**`texts/` 经量化后判定保留**） | 全局                                                  |

> **勘误说明（共 3 处，均为初版判断错误，已修正）**：
>
> 1. **过期 token 伪造**——初版列为「可伪造任意用户的严重缺陷」。经核对 `node_modules/jsonwebtoken/verify.js`，**该判断错误**：`jws.verify` 在 `:165` 先于 `exp` 检查（`:190`）执行，伪造 token 在签名步骤就抛 `invalid signature`，永远走不到 `decode` 分支。已降级为第 8 项，并给出该路径的**真实**缺口（`iss`/`aud` 未校验 + 依赖外部库的检查顺序这一隐式不变量）。
> 2. **Proxy 的 runtime**——初版断言「Netlify 上 proxy 跑在 Deno Edge、不能用 `jsonwebtoken`、必须换 `jose`」。经核对 `next/dist/docs/.../proxy.md:255`：**「Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files.」**，Node 是唯一可能的 runtime。约束真实存在，但原因是 Netlify 的 node-middleware 走 Deno 系 runtime + `edge-runtime/shim/node.js` 桥接，**并对 C++ 原生插件硬失败**（`build/functions/edge.js:177-184`）——与「不能用 Node 库」是两件不同的事。`jose` 替换建议随之**撤回**。
> 3. **`texts/` 词条层**——初版建议内联并「删除约 800 行」。经实际统计：14 个模块全部被引用、合计 **67 条 import 语句**、`formatTemplate` 被 **15 处**调用。内联需改约 370 行换删 371 行，**净亏**。判定改为「**保留，合理抽象**」。

---

## 1. Next 应用层

### 1.1 【严重缺陷·已修正】限流可被伪造请求头绕过，且两个平台表现不同

**问题描述** `common/rate-limit.ts:47-65`：

```ts
const nfIp = request.headers.get("x-nf-client-connection-ip");
if (nfIp) return nfIp;
const realIp = request.headers.get("x-real-ip");
if (realIp) return realIp;
const xff = request.headers.get("x-forwarded-for");
if (xff) {
  const last = segments[segments.length - 1];
  if (last) return last;
}
```

这个返回值直接决定限流 key：`auth.controller.ts:75,90`（login/register 的 IP 维度）、`refresh/route.ts:20`、`post.controller.ts:44,85,101`、`comment.controller.ts`（评论三件套）、`api/posts/[id]/view/route.ts:11`。

**为什么是问题**

- **Netlify**：`x-nf-client-connection-ip` 由 Netlify 边缘注入，客户端自带的同名头会被**剥离/覆盖**，所以这一层可信。
- **Railway**：没有任何平台注入的、客户端无法伪造的 IP 头。Railway 的标准反代只保证重写 `x-forwarded-for` / `x-real-ip` 这类**已知**头，对业务方自定义的「端到端」头通常**原样转发**。若如此，攻击者每次请求带一个不同的 `x-nf-client-connection-ip`（或 `x-real-ip`）就得到**全新的计数桶**，`policy.ts:18` 的 5 次/5 分钟形同虚设 → 无限撞库，账号接管只是时间问题。
- 本地无法证实 Railway 的头处理行为，标注**待实测**。一次性验证方法（无需读代码）：
  ```bash
  # 对 Railway 域名发送带伪造头的请求，然后查 rate_limits 表
  curl -H 'x-nf-client-connection-ip: 1.2.3.4' -X POST https://<railway-host>/api/auth/refresh
  # 期望：表里出现 id = 'ratelimit:auth:refresh:1.2.3.4'（即伪造成功）
  # 或   id = 'ratelimit:auth:refresh:<你的真实IP>'（即平台覆盖了该头）
  ```
  **无论结果如何，下面的修复都成立**——因为「是否可伪造」不应该依赖平台实现细节。
- 附带说明：当前取 `x-forwarded-for` **最后一段**的方向本身是**对的**（客户端伪造的值出现在列表左侧），**不要**改成取第一段。

**修复方案**
把「信任哪个头」变成显式配置，而不是按优先级盲猜：

```ts
// env.ts
TRUSTED_IP_HEADER: getEnv("TRUSTED_IP_HEADER", ""),   // netlify: x-nf-client-connection-ip；railway: 留空走 XFF
TRUSTED_PROXY_HOPS: getInt("TRUSTED_PROXY_HOPS", 1),

// rate-limit.ts
export function getClientIp(request: { headers: Pick<Headers, "get"> }): string {
  const configured = env.TRUSTED_IP_HEADER
    ? request.headers.get(env.TRUSTED_IP_HEADER)
    : null;
  if (configured) return configured.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - env.TRUSTED_PROXY_HOPS] ?? "unknown";  // 从右往左
  }
  return "unknown";   // 删除无条件的 x-real-ip 分支
}
```

**并且必须认识到：IP 维度限流在 Railway 上不可靠，真正的防线是账户维度。** `policy.ts:20` 的 `loginByAccount: { limit: 10, windowMs: 5min }`（`auth.controller.ts:78` 的 `login:acct:${dto.email}`）不依赖 IP，是抗撞库的主力。建议把账户维度阈值收紧（5 次/15 分钟），并给它加一个**全局**兜底（单账户跨 IP 的失败计数），这样即使 IP 完全不可信，撞库成本仍然可控。

---

### 1.1b 【严重缺陷】限流失败即放行（fail-open），且 `rate_limits` 表没有任何迁移保障

**问题描述** `common/rate-limit.ts:41-44`：

```ts
} catch (err) {
  logger.error("isRateLimited failed, request allowed", { key, error: String(err) });
  return false;      // ← 任何异常都放行
}
```

`rate_limits` 表定义在 `schema.ts:138-146`。然而：

- 仓库内**没有任何 `.sql` 迁移文件**（`git ls-files` 无匹配，且没有 `drizzle/` 目录）；
- schema 只能靠手工执行 `pnpm db:push`（`scripts/db-push.mjs`）；
- `netlify.toml:2` 与 `railway.json:4` 的构建命令**只跑 `pnpm install` + `pnpm build`，都不会执行 `db:push`**。

**为什么是问题**
这是一个**比「没有限流」更危险的状态**：漏建 `rate_limits` 表（或 DB 抖动、连接池耗尽、表被误删）时，`insert into rate_limits` 抛错被吞掉，login / register / refresh **全部放行**，没有 429、没有告警、没有降级提示，只在日志里留一行 `error`。攻击者在撞库时不会收到任何异常信号，防御方也**不会收到任何信号**——完全不可观测。

结合 1.1（IP 头可伪造），两条叠加的效果是：**当前部署的防爆破能力在最坏情况下等于零，且没有任何机制会告诉你这件事。**

**修复方案**
安全关键端点必须 fail-closed，并让「漏建表」在部署时就暴露：

```ts
export async function isRateLimited(
  key: string,
  policy: RateLimitPolicy,
  mode: "fail-open" | "fail-closed" = "fail-closed",
): Promise<boolean> {
  try {
    /* ... 现有逻辑 ... */
  } catch (err) {
    logger.error("isRateLimited failed", { key, error: String(err), mode });
    return mode === "fail-closed";
  }
}
```

- `loginAction` / `registerAction` / `refresh` 三处显式传 `"fail-closed"`（这三条是唯一能造成账号失陷的路径）。
- 浏览计数、点赞等非关键路径保留 `"fail-open"`（避免小故障影响只读体验）。
- **在 `/api/health` 里加一条真实的表存在性检查**，让漏建表立刻表现为健康检查失败：
  ```ts
  await getDb().execute(sql`SELECT 1 FROM rate_limits LIMIT 1`);
  ```
- 根治手段是 2.11 的迁移机制：迁移文件进 git + 部署流程强制 `db:migrate`。

---

### 1.2 【严重缺陷】`withDbRetry` 对非幂等写无条件重试

**问题描述** `common/db.ts:38-49`：

```ts
export async function withDbRetry<T>(load: () => Promise<T>): Promise<T> {
  try { return await load(); }
  catch (error) {
    if (isAppError(error)) throw error;
    logger.warn("Database read failed, retrying once", {...});
    await new Promise((r) => setTimeout(r, DB_RETRY_DELAY_MS));   // 1500ms
    return await load();
  }
}
```

函数名、日志（`"Database read failed"`）都声称是读重试，但**没有任何机制能保证传入的是读**。它被用在 `posts/page.tsx:59`、`home/page.tsx:27`、`posts/[id]/page.tsx:136`、`rss/route.ts:17`——目前恰好都是读，靠人工纪律维持。

**为什么是问题**

1. `load` 是闭包，编译器无法约束它只读。任何未来把 `createPostAction` 之类包进来，就会产生重复插入。`atomicBatch` 里含 `insertPostStmt` 时同理。
2. 该 catch **无法区分**「请求根本没到达数据库」与「数据库已执行但响应丢失」。Neon HTTP 驱动每次查询是一次独立 `fetch`（`drizzle-orm/neon-http/session.js:35`、`@neondatabase/serverless/index.js` 的 `transaction()` 路径），超时/Socket 断开的语义完全不可观测，因此「重试安全」这个前提不成立。
3. 固定 1500ms 串行等待，在 Neon 冷启动（计算实例从 0 唤醒，常达数百 ms 到数秒）时会把一次慢查询放大成 1.5s + 又一次慢查询；Netlify 函数的墙钟预算被白白吃掉，Railway 上则是纯延迟。
4. 预览/构建期渲染时被 `catch(() => null)` 包住（`posts/page.tsx:68`），于是「重试后仍失败」被静默降级成空列表——**故障被吞掉，只留下一个 1.5s 的延迟**。

**修复方案**
把「重试」和「读」在类型上绑死，只允许读走重试；写永不重试，改为向上抛让用户重试：

```ts
/** 仅用于幂等读；写操作一律直接用 getDb()，失败即抛 */
export async function withReadRetry<T>(load: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isAppError(error) || attempt >= 1) throw error;
    await new Promise((r) => setTimeout(r, 150));
    return withReadRetry(load, attempt + 1);
  }
}
```

同时把延迟从 1500ms 降到「小于 Neon 冷启动抖动」的量级，或改成指数退避 + 总预算上限。更彻底的做法是给 Neon 客户端配置显式超时（`neon(url, { fetchOptions: { signal } })`）以便区分超时与其他错误。

**并补一个更根本的洞**：所有写路径目前**没有幂等键**。用户手动重试「发布文章」时，若第一次其实成功了只是响应丢失，会产生**两篇重复文章**（`generatePostId()` 每次生成新 id，`post.service.ts:82-86`，没有唯一约束能挡住）。建议由客户端生成 `clientRequestId`，服务端以它做去重（加唯一索引 + `ON CONFLICT DO NOTHING`）。

---

### 1.2b 【潜在风险·已修正】刷新宽限路径用未验签的 `jwt.decode`，且 iss/aud 未校验

> **这一项是本报告初版判定错误后的修正版。** 初版声称「可伪造任意用户」，经核对源码，**该结论不成立**。

**问题描述** `auth.guard.ts:40-49`：

```ts
function readPayload(token: string, isRefreshFlow: boolean): SessionFailure | AuthPayload {
  const verification = verifyToken(token);
  if (verification.isValid) return verification.payload;
  if (!verification.isExpired) return "invalid";
  if (!isRefreshFlow) return "expired";
  const decoded = decodeToken(token); // ← 无签名校验
  return decoded && isWithinRefreshGrace(decoded) ? decoded : "expired";
}
```

`token.ts:38-40` 的 `decodeToken` 调用 `jsonwebtoken.decode`，而 `node_modules/jsonwebtoken/decode.js:5` 只有 `jws.decode(jwt, options)`——**纯 base64 解码，不验签**。

**为什么当前不可利用（以及为什么仍然是问题）**
核对 `node_modules/jsonwebtoken/verify.js` 的实际执行顺序：

| 行         | 检查                                                  |
| ---------- | ----------------------------------------------------- |
| `:144-146` | `header.alg` 是否在白名单内                           |
| `:165`     | **`jws.verify(...)` 签名校验**                        |
| `:171`     | 签名不匹配 → `JsonWebTokenError('invalid signature')` |
| `:190`     | `exp` 检查 → `TokenExpiredError`                      |
| `:194-205` | `aud` 校验                                            |
| `:209-215` | `iss` 校验                                            |

**签名校验（`:165`）严格早于 `exp` 检查（`:190`）。** 因此伪造 token 必然在 `:171` 抛 `invalid signature`，`verifyToken` 返回 `{ isValid: false, isExpired: false }`（`token.ts:34` 只在 `TokenExpiredError` 时置 `isExpired = true`），`readPayload` 在 `:44` 就 `return "invalid"`——**永远走不到 `decodeToken`**。攻击者无法伪造 payload。

但这仍然是一个真实缺陷，理由有三：

1. **它依赖「两道检查的先后顺序」这一外部库的隐式不变量。** 任何人把 `decodeToken` 提前一行、或给 refresh 增加一条新路径，就会立刻变成「任意外部用户自签任意 id 的长期会话」（因为 `assessSession` 只用 `payload.id` + `tokenVersion` 查库，`auth.guard.ts:60-65`，而普通用户 `tokenVersion` 恒为 0）。
2. **`iss` / `aud` 在 decode 路径上完全未校验。** 因为 `TokenExpiredError` 在 `:190` 抛出，早于 `:194` 的 `aud` 与 `:209` 的 `iss`。于是任何**用同一密钥签发、且已过期**的、来自**其它应用**的 token（比如同团队另一个服务的 token，`iss`/`aud` 都不同）都会被这条路径接受，只要 `id` 与 `tokenVersion` 对得上。当前 `JWT_SECRET` 只有本应用使用，所以不可利用；一旦密钥被复用到其它服务（很常见），就是跨应用越权。
3. `decodeToken` 只被这一处调用，却作为公开 API 导出（`token.ts:38`），是个随时会被误用的地雷。

**修复方案**
宽限路径必须建立在「签名已验证、仅时间过期」之上，即用 `ignoreExpiration` 重新做一次**完整**验签（含 iss/aud），然后删掉 `decodeToken`：

```ts
// token.ts
export function verifyExpiredToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      ignoreExpiration: true, // 只放行时间，不放行签名与 iss/aud
    }) as AuthPayload;
  } catch {
    return null;
  }
}
```

```ts
// auth.guard.ts —— 删掉 readPayload 里的 decodeToken 分支
function readPayload(token: string, isRefreshFlow: boolean): SessionFailure | AuthPayload {
  const verification = verifyToken(token);
  if (verification.isValid) return verification.payload;
  if (!verification.isExpired) return "invalid";
  if (!isRefreshFlow) return "expired";

  const payload = verifyExpiredToken(token); // 完整验签 + 仅忽略 exp
  if (!payload) return "invalid";
  return isWithinRefreshGrace(payload) ? payload : "expired";
}
```

**并顺手降低宽限窗口**：`env.ts:55` 的 `JWT_REFRESH_GRACE_SECONDS` 默认 **3600s（1 小时）** 过长。它的语义是「网络抖动/时钟偏移的容错」，60–300s 足够。当前 1 小时意味着一个被撤销的 token 在过期后仍有 1 小时可换取全新的 7 天 token。同时建议给 refresh 增加**轮换**（签发新 token 时递增 `tokenVersion`）与**绝对会话上限**（如 `sessionStartedAt` claim + 30 天上限），否则只要每 7 天刷新一次就能永久在线，且服务端无法区分「正常续期」与「攻击者重放」。

---

### 1.3 【潜在风险】Server Action 的 401 永不触发静默续期

**问题描述** `lib/api-request.ts:137-155` 是全仓唯一实现「401 → `POST /api/auth/refresh` → 重试一次」的地方。而它只被两个调用点使用：

- `hooks/useComments.ts:87`（GET 评论列表）；
- `components/post/PostViewTracker.tsx:20`（浏览量上报）。

**所有登录态写操作都直接调 Server Action**（`SettingsForm.tsx:30`、`usePosts.ts:8-9`、`useComments.ts:8-11`、`WriteEditor.tsx`），失败后经 `unwrap`（`api-request.ts:178-181`）直接抛错，**不走 refresh**。

**为什么是问题**
`JWT_REFRESH_GRACE_SECONDS` 这套宽限机制、`/api/auth/refresh` 这个端点、`tryRefreshToken` 的并发去重（`api-request.ts:36-63`），**全部只服务于「看评论」和「上报浏览量」这两个非关键路径**。用户真正在意的操作——写文章、改资料、改密码、发评论——token 一过期就是一句报错，而不是无感续期。这与设计的意图（`README:93` 把 refresh 列为关键路由）严重不符，等于让 90% 的 refresh 代码白写。

**修复方案**
抽一个统一的 `callAction`，让 Server Action 结果也走「401 → refresh → 重试一次」：

```ts
export async function callAction<T>(run: () => Promise<ActionResult<T>>): Promise<T> {
  let result = await run();
  if (!result.ok && result.status === 401 && (await tryRefreshToken())) {
    result = await run(); // token 已轮换，重试一次
  }
  if (!result.ok) {
    throw new ApiRequestError(
      result.status,
      result.status,
      result.message,
      result.details as never,
    );
  }
  return result.data;
}
```

然后 `useAsyncAction` 的调用方改用 `callAction(() => createPostAction(dto))` 替代 `createPostAction(dto).then(unwrap)`。

---

### 1.4 【潜在风险】登出失败时前端仍清空本地状态 → 服务端会话残留

**问题描述** `hooks/useAuth.ts:11-19`：

```ts
try {
  await logoutAction();
} finally {
  clearAuthStatus();
  setMe(null);
} // ← 抛错时也执行
```

`clearAuthStatus()`（`lib/auth-status.ts:9-14`）删除非 httpOnly 的 `auth_status` cookie 并写 `localStorage` 登出信号。

**为什么是问题**
`auth_token` 是 **httpOnly**，前端删不掉。一旦 `logoutAction` 失败（网络中断、`invalidateUserSessions` 因数据库抖动失败、`incrementTokenVersionStmt` 超时），结果是：

- UI 显示已登出；
- **服务端 cookie 与 `tokenVersion` 都没变，会话完全可用**；
- 更糟的是 `AuthProvider.tsx:80-82` 之后因 `hasAuthStatus()` 返回 false 而**不再调用 `getMeAction`**，界面永远自我纠正不回来。

在共用电脑场景下，这是一个真实的会话劫持窗口：用户以为登出了，实际没有。

**修复方案** 只在服务端确认成功后再清本地状态：

```ts
const result = await logoutAction();
if (!result.ok && result.status !== 401) {
  notify.fail(feedback.session.logoutFailed);
  return; // 不清本地状态，让用户知道没登出
}
clearAuthStatus();
setMe(null);
```

并同步修 `hooks/useLogoutRedirect.ts:12-18` 的同类问题：它在 `logoutMutation.mutate(...)` **之前**就 `router.replace("/")`，后台标签页或快速整页跳转可能丢弃请求，与上面的残留叠加。

---

### 1.5 【严重缺陷】ILIKE 中缀搜索用不上索引

**问题描述** `post.repository.ts:107-123`：

```ts
function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}
// ...
if (q.q) {
  const pattern = `%${escapeLike(q.q)}%`;
  conditions.push(or(sql`${posts.title} ILIKE ${pattern}`, sql`${posts.content} ILIKE ${pattern}`));
}
```

`schema.ts:88-89` 声明了 `posts_title_trgm_idx` / `posts_content_trgm_idx`（`gin_trgm_ops`），方向是对的。

**为什么是问题**

1. **GIN trgm 索引对 `%foo%` 的可用性取决于查询串长度**：去掉首尾通配符后不足 3 个字符时，`gin_trgm_ops` 会退化为全索引扫描甚至顺序扫描，规划器直接放弃。当前代码**没有任何最小长度限制**，`/posts?q=a` 就是一次全表扫描。
2. `posts.content` 是完整正文（`schema.ts:64`，`text` 无长度上限，校验器允许 **200000** 字符，`validation/post.ts:10`）。对 20 万字符的列建 trgm GIN，**索引本身可能比表还大**，且每次写入都要更新——用巨大的写放大换一个退化的搜索。
3. 排序键是 `publishedAt DESC`（`post.repository.ts:135-137`），搜索走 trgm 位图扫描，两者无法同时利用，叠加 `pinnedFirst`（`:129`）后必然产生排序节点。
4. `countPosts`（`:157-160`）在搜索路径上会**再扫一遍**同一谓词——一个 `/posts?q=x` 请求是两次全表扫描。
5. `escapeLike` 依赖 PostgreSQL `LIKE` 的默认转义符 `\`。这是对的（`LIKE`/`ILIKE` 默认 `ESCAPE` 就是反斜杠），但**代码未显式写 `ESCAPE '\'`**，一旦 `standard_conforming_strings` 或驱动层行为变化会静默失效。

**修复方案**

- 搜索加长度下限与上限（`q.length >= 2`，超过 64 截断），避免规划器退化。
- 只在 `title` 与 `summary` 上做 `%…%`，`content` 改用全文索引：
  ```sql
  CREATE INDEX posts_search_idx ON posts
  USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'')));
  ```
  （中文需要 `zhparser`/`pg_jieba`；若不想引入扩展，就**接受「仅标题摘要搜索」并删掉 `posts_content_trgm_idx`**，这比留一个退化的巨型索引更好。）
- 显式写出转义符：`sql\`${posts.title} ILIKE ${pattern} ESCAPE '\\'\``。
- 搜索结果**不提供精确总数**，改用 `limit + 1` 探测下一页（`comment.service.ts:53-58` 已是这个模式），顺带消除第 4 点的第二次全表扫描。

---

### 1.6 【严重缺陷】`generateStaticParams` 用 `catch {}` 吞掉数据库故障

**问题描述** `src/app/posts/[id]/page.tsx:35-44`：

```ts
export async function generateStaticParams() {
  try {
    const indexedPosts = await listPostsCached({ page: 1, limit: STATIC_PARAMS_LIMIT });
    const params = indexedPosts.posts.map((post) => ({ id: encodePostId(post.id) }));
    if (params.length > 0) return params;
  } catch {}
  return [{ id: "placeholder" }];
}
```

本机构建产物证实这段占位逻辑真的会产出页面：`.next/server/app/posts/placeholder.html` 有 57623 字节，`prerender-manifest.json` 里 `/posts/placeholder` 的 `srcRoute` 是 `/posts/[id]`、`initialRevalidateSeconds` 为 300。

**为什么是问题**

1. `catch {}` 同时覆盖了两类完全不同的失败：数据库临时不可用（**应让构建失败**）与返回空列表（正常）。构建机拿不到 `DATABASE_URL`、Neon 冷启动超出构建预算、连接串写错——全部被降级成「返回占位符」，构建**绿色通过**但所有文章页退化成运行时按需渲染。这正是 HEAD commit `d4b16aa`「修复无文章时构建失败的问题」引入的取舍：**把一个响亮的失败换成了一个无声的降级。**
2. `return [{ id: "placeholder" }]` 会生成一个**真实可访问的 `/posts/placeholder` URL**，内容是空文章壳。`generateMetadata` 在 `getPostCached` 返回 null 时会设 `robots: { index: false }`（`posts/[id]/page.tsx:55-58`），但静态壳是绕过它的，所以可能被搜索引擎收录成一个软 404。
3. 这个函数本身**基本冗余**：`.next/prerender-manifest.json` 中 `/posts/[id]` 的 `fallback` 是 `"/posts/[id]"` 而非 `false`，说明 `dynamicParams` 默认为 `true`，未列出的 id 本来就会按需渲染。它唯一的作用是「构建期预热 + 一个会静默出错的数据库调用」。

**修复方案**
若确实要预热（对 Netlify 冷启动确有价值），**让失败可见**：

```ts
export async function generateStaticParams() {
  // 预热失败必须在 CI 暴露，而不是退化成占位页
  const { posts } = await listPostsCached({ page: 1, limit: STATIC_PARAMS_LIMIT });
  return posts.map((post) => ({ id: encodePostId(post.id) }));
}
```

若只是想让空库也能构建，则**删掉整个函数**并显式 `export const dynamicParams = true;`——空数组返回 `[]` 本身就不会导致构建失败，不需要占位符。

---

### 1.7 【严重缺陷】匿名可请求 `limit=20000` 的文章列表

**问题描述** `common/policy.ts:68` `postListMaxLimit: 20_000`，配合 `post.service.ts:148-151`：

```ts
const limit = Math.min(
  PAGE_LIMITS.postListMaxLimit,
  Math.max(1, options.limit ?? PAGE_LIMITS.postListDefaultLimit),
);
```

`limit` 最终来自 `PostListParams.limit`，而后者在 `posts/page.tsx:39-49` 从 `searchParams` 读取——**服务端组件路径下 `limit` 实际未被 URL 直接控制**（页面传的是固定 `PAGE_SIZE`），但 `listPostsCached` 的签名（`post.cache.ts:64-67`）接受任意 `limit`，且 `sitemap.ts:12` 就用 `limit: 20000`。

**真正的暴露面**：任何能调用 `listPostsCached` 的路径。当前是 `sitemap.ts`（`SITEMAP_LIMIT = 20000`）与 `generateStaticParams`（`STATIC_PARAMS_LIMIT = 100`，`config/site.ts:14`）。`sitemap.xml` 是**公开无鉴权路由**，一次请求就会拉取最多 2 万行（17 列 + `tags` 数组）+ 一次精确 `count(*)`。

**为什么是问题**

1. **放大攻击面**：一个匿名请求 → 一次 2 万行的全表扫描 + 2 万行 JSON/XML 序列化 + 内存占用。在 Netlify 上直接冲击 50MB 的 `use cache` LRU（见 3.1 根因 1）与函数内存；在 Railway 上打满单进程。
2. 该结果会被 `use cache` 缓存成一个巨大的条目（`post.cache.ts:69-74`），挤掉其它有用的缓存条目。
3. `sitemap.ts:44-59` 还把这个 2 万行结果展开成 sitemap URL，其中包含 `?category=` 与 `?tag=`（1.12 会说明这些是必须走函数渲染的动态 URL），进一步放大。

**修复方案**

- 把 `postListMaxLimit` 从 `20_000` 降到 **100**。没有任何用户界面需要单次返回 2 万条。
- `sitemap.ts` 改为**分页流式**收集，或用一个只 `SELECT id, updated_at` 的轻量查询（当前 `listPostsCached` 会取 17 个列）。
- 从 sitemap 移除 `?category=` / `?tag=`（没有独立规范 URL 的参数页不应进 sitemap，反而稀释权重）。
- 给 `listPostsCached` 加断言：`limit <= PAGE_LIMITS.postListMaxLimit`，让越界立刻抛错而不是静默执行。

---

### 1.8 【潜在风险】`/posts` 的筛选与分页全部走 `searchParams`，每次都是函数调用 + 数据库往返

**问题描述** `src/app/posts/page.tsx:39-71` 读取 `searchParams`，并 `withDbRetry(() => listPostsCached({...}))`。

**为什么是问题**
本机构建产物 `.next/server/app/posts.meta` 显示 `/posts` 确实是静态壳（`x-nextjs-prerender: 1`，并带 `postponed` 段），这是 `cacheComponents: true` 下 PPR 的预期行为。但 `searchParams` 属于请求时数据，**任何 `?page=2`、`?category=x` 都会在请求期完成渲染并触发 `listPostsCached`**——`post.cache.ts:69-74` 的 `use cache` 只在参数相同时命中，`/posts?page=2` 与 `/posts` 是两个不同缓存键。用户点分页 = 一次 Netlify 函数冷启动 + 2 次 Neon 往返（`listPostsByQuery` + `countPosts`，`post.service.ts:167-178`）。

**为什么是可优化而非缺陷** 当前架构是正确且可用的；问题在于把「内容分页」放在了 query string 里，牺牲了可预渲染性与 CDN 命中率。

**修复方案**
把分类/标签/分页提升为路径段，让它们成为可缓存、可预渲染的真实路由：

```
/posts                      → page 1，全部
/posts/page/2               → 静态（generateStaticParams 1..N）
/posts/category/前端         → 静态
/posts/tag/react            → 静态
/posts?q=...                → 仅搜索保留 query（搜索本来就不该缓存，逻辑不变）
```

这需要改 `build-posts-url.ts`、`PostSidebar`、`sitemap.ts`（正好一起改），并给旧 URL 加 `redirects()` 兼容。

---

### 1.9 【潜在风险】评论系统整体 CSR，对 SEO 与首屏是净损失

**问题描述** `posts/[id]/page.tsx:232-237` 用 `DeferredComments`，其 `DeferredPostWidgets.tsx:10-14` 是 `dynamic(..., { ssr: false })`；未进入视口前渲染 `CommentsPreview`（`DeferredPostWidgets.tsx:20-39`）。

**为什么是问题**

1. `ssr: false` 意味着评论内容**永远不在 HTML 里**，爬虫抓不到。博客评论是长尾流量来源，这是实打实的 SEO 损失。
2. `DeferredComments` 拿到了 `initialData`（服务端已通过 `listCommentsCached` 取好，`posts/[id]/page.tsx:145-147`），却因为 `ssr: false` 只能用它渲染预览卡片，正文由客户端水合后重建——**同一份数据被服务端取了一次、在 HTML 里塞了一次、又在客户端重新渲染一次**。
3. `CommentsPreview` 的判空是 `if (!data || data.comments.length === 0) return <CommentsSkeleton />;`（`DeferredPostWidgets.tsx:21`）——**输入框在预览态不存在**，README 第 149 行也承认了。用户滚到评论区之前看不到评论表单，滚动到位后又经历一次「骨架 → 真内容」跳变。
4. `useComments`（`hooks/useComments.ts:42-78`）的 `seededForRef` 会在首次跳过 fetch，但 `refetch` 或 `pageSize` 变化会重新走 `/api/posts/[id]/comments`，在 Netlify 上又是额外一次函数调用 + 2 次 Neon 往返。

**修复方案**
去掉 `ssr: false`，让评论区服务端渲染（数据已经拿到了，没有理由不渲染）：

```tsx
const CommentsSection = dynamic(() => import("./CommentsSection").then((m) => m.CommentsSection), {
  loading: () => <CommentsSkeleton />, // 保留延迟加载，但允许 SSR
});
```

再用 `content-visibility: auto` + `contain-intrinsic-size` 做纯 CSS 的「视口外不布局」，替代 `IntersectionObserver` 的手写状态机——收益相同，但不破坏 SSR，且不需要 `CommentsPreview` 这个额外分支。

---

### 1.10 【潜在风险】`useAsyncAction` 静默丢弃并发调用

**问题描述** `hooks/useAsyncAction.ts:60-61`：

```ts
if (mutatingRef.current) return undefined; // 静默返回，不触发任何回调
```

**为什么是问题**
返回 `undefined` 且不调用 `onError`/`onSettled`。调用方通常写成：

```ts
const data = await createCommentMutation.mutate(...);
if (data) { appendComment(data); ... }        // CommentsSection.tsx:146
```

于是被丢弃的那一次提交**什么都不发生**：优化态评论已在 `addOptimisticComment` 里插入（`CommentsSection.tsx:132`），但既没有 `appendComment` 也没有 `confirm`（`:149`），UI 上留下一条永远无法确认的 `optimistic-*` 评论。当前靠按钮 `disabled`（`CommentsSection.tsx:233`）勉强遮住，一旦去掉 disabled 或加快捷键，就是用户可见的数据不一致。

**修复方案** 明确语义，二选一：

```ts
// 方案 A：并发即拒绝，但要显式告知
if (mutatingRef.current) {
  const err = new Error(feedback.common.actionFailed);
  (callbacks?.onError ?? defaultsRef.current?.onError)?.(err);
  return undefined;
}
// 方案 B：去掉守卫，让幂等动作（点赞/收藏切换）自然并发
```

点赞/收藏属于切换语义，服务端已用 CTE 保证原子（`post.repository.ts:365-408`），客户端串行化收益很小，建议对它们改用方案 B，只对「创建」类保留守卫。

---

### 1.11 【优化项】`useAsyncAction` 的整套重试/指数退避是死代码

**问题描述** `hooks/useAsyncAction.ts:13-35`（`RETRY_BASE_DELAY` / `MAX_RETRIES` / `isRetryableError`）与 `:64-85`（while + 指数退避）。`retry` 参数默认为 `false`（`:46`），**8 个调用点全部只传 2 个参数**（`usePosts.ts:20,28,36,73`、`useComments.ts:173,184,195`、`useAuth.ts:20`），第 76 行 `!retry` 永远短路 → **退避分支不可达**。

**为什么是问题**
40 行带字符串匹配（`msg.includes("timeout")`、`msg.includes("429")`、`msg.includes("failed to fetch")`）的启发式错误分类**从未被任何测试或调用验证过**。这类靠 message 文本判断的代码极易随依赖升级静默失效，而且它掩盖了真正该做的事：重试应该在网络层统一处理——`api-request.ts:102-105` 已经有了一份**正确区分幂等方法**的重试（`SAFE_RETRY_METHODS`，`:13`）。两份重试逻辑并存，一份可用一份死掉。

**修复方案** 删掉 `useAsyncAction` 的 `retry` 参数与全部重试逻辑，只保留 `isPending` + 回调编排；重试能力统一由 `api-request.ts` 承担，并让 Server Action 也走它（见 1.3）。

---

### 1.12 【优化项】`revalidatePath` 循环调用造成 N 次失效

**问题描述** `auth.controller.ts:48-71`：

```ts
const affectedPostIds = new Set([...commentedPostIds, ...ownedPostIds]);
for (const postId of affectedPostIds) {
  invalidatePostCache(postId); // updateTag("posts") + updateTag(`post:${postId}`)
  invalidateCommentsCache(postId); // updateTag(`comments:${postId}`)
  revalidatePostPath(postId); // revalidatePath(...)
}
revalidatePostListPaths();
```

**为什么是问题**
改一次昵称或头像，会对该用户**每一篇**文章执行 3 次失效操作。写 200 篇就是 600 次。其中 `invalidatePostCache` 每次都重复 `updateTag("posts")`（同一个 tag 重复 N 次，纯浪费）。在 Netlify 上 `updateTag` 会调用 `markTagsAsStaleAndPurgeEdgeCache`（`@netlify/plugin-nextjs/dist/run/handlers/use-cache-handler.js:1566`），即**逐 tag 写 Blobs 并 purge CDN**——这是真实的网络与计费成本。

**修复方案**

```ts
updateTag("posts"); // 提到循环外，只做一次
for (const postId of affectedPostIds) {
  updateTag(`post:${postId}`);
  updateTag(`comments:${postId}`);
}
revalidatePath("/", "layout"); // 收敛为一次全量
```

并在 `post.cache.ts` 里新增批量接口 `invalidatePostCaches(postIds: string[])`，避免调用方自己拼循环。`revalidatePath("/", "layout")` 在 `cacheComponents: true` 下对子路由的实际覆盖范围**待实测**。

---

### 1.13 【优化项】CSP 未随部署环境自适应，`connect-src 'self'` 会掐断跨域

**问题描述** `next.config.ts:54-67` 硬编码 `connect-src 'self'`、`form-action 'self'`。当前没有第三方请求所以不报错，但只要将来接入任何外部 API、错误上报（Sentry）、统计，就会被 CSP 静默拦截，而且**只在部署环境复现**（本地 dev 因为 `NODE_ENV !== "production"` 多一个 `'unsafe-eval'` 更容易掩盖问题）。

同时 `'unsafe-inline'` 出现在 `script-src` 中，使 CSP 的 XSS 防护基本归零（`next-themes` 与 `THEME_INIT_SCRIPT` 需要内联脚本，见 `layout.tsx:60` 与 `error-page-shell.ts:35`）。缺少显式的 `object-src 'none'`。

**修复方案**
短期：把 CSP 抽成 `src/config/csp.ts`，按 `NEXT_PUBLIC_BASE_URL` 决定 `connect-src`；补 `object-src 'none'`。
长期：在 `src/proxy.ts` 里生成 per-request nonce，写入 `x-nonce` 请求头并注入 CSP 响应头，`layout.tsx` 的内联脚本带上 `nonce`。

---

### 1.14 【优化项】`next.config.ts` 的 `deviceSizes` 被截断

**问题描述** `next.config.ts:18`：`deviceSizes: [640, 750, 828, 1200]`。

**为什么是问题**
Next 默认是 `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]`。覆盖成 4 项后：

- 详情页封面 `sizes="(max-width: 768px) 100vw, (max-width: 1280px) 1200px, 1200px"`（`posts/[id]/page.tsx:204`）在 1280–1920px 视口下只能请求 `1200w` 的候选（`1920` 档被删了），**高分屏上封面会糊**；
- `1920`/`3840` 档缺失，Retina 大屏无法获取足够像素密度。

**修复方案**

```ts
deviceSizes: [640, 750, 828, 1080, 1200, 1920],   // 保留 1080/1920，删掉几乎不用的 2048/3840
```

---

### 1.15 【优化项】`images.remotePatterns` 与运行时实际图片 URL 可能不一致

**问题描述** `config/site.ts:18` `OPTIMIZED_IMAGE_HOSTS = ["images.pexels.com"]`，映射到 `next.config.ts:20-23`。用户可自填 `coverImage` / `avatar`。

**为什么是问题**
`isOptimizableImageSrc`（`lib/url.ts:20-27`）只做白名单域名判断，非白名单图片走 `unoptimized`（`posts/[id]/page.tsx:205`），因此**不会抛 `next/image` 的 hostname 报错**——这一层是安全正确的。但副作用是：用户填了 `raw.githubusercontent.com` 之类的封面，图片就完全绕过 Next 优化（无 AVIF/WebP、无尺寸裁剪）。另外白名单只有 pexels，想用其它图床就必须改代码 + 重新部署。

**修复方案** 把白名单下沉到环境变量：

```ts
export const OPTIMIZED_IMAGE_HOSTS = (process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "images.pexels.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
```

注意 `images.remotePatterns` 是**构建期配置**，运行时改无效——两个平台都必须把它配在「构建环境变量」（见 3.1 根因 6）。

---

### 1.16 【优化项】`PostStateProvider` 乐观 +1 浏览量

**问题描述** `PostStateProvider.tsx:24-30`：`useEffect` 挂载后无条件 `views + 1`。

**为什么是问题**
`.next/server/app/posts/[id].html` 是**预渲染静态壳**，其中的 `views` 是构建期快照。所以静态壳上的浏览量本身就已经是构建时刻的旧值；客户端再 `+1` 只是让数字看起来动了一下。服务端 `recordPostView`（`post.service.ts:312-335`）在 `after()` 里异步 `+1`，但客户端永远看不到（除非整页刷新）。净效果是数字既不准也不一致，纯装饰。

**顺带固化一个正确但脆弱的约束**：`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` 明确说明——**「`after` 不是 Request-time API，调用它不会使路由变为动态；在静态页中使用时，回调会在构建期或页面重新验证时执行」**。`recordPostView` 目前只在 `/api/posts/[id]/view` 这个 Route Handler 里被调用（`view/route.ts:12`），而 Route Handler 默认是动态的（`dist/docs/.../route.md:669`：「v15.0.0-RC 起 GET handler 的默认缓存从 static 改为 dynamic」），所以运行时行为正确。但这个正确性**依赖调用位置**——一旦有人把 `recordPostView` 挪进页面组件，它就会在构建期被触发。**建议加注释固化这个约束。**

**修复方案** 二选一：删掉客户端的乐观 +1（接受「浏览量下次访问时更新」），或把浏览量改为客户端实时数据（单独走一个轻量接口）。当前「一半乐观一半持久」是最差的组合。

---

## 2. 数据库专项

### 2.1 【已验证·正确】`db.batch()` 确实是一次事务

`drizzle-orm/neon-http/session.js:117-133`：

```js
async batch(queries) {
  // ... 构造 builtQueries
  const batchResults = await this.client.transaction(builtQueries, queryConfig);
  return batchResults.map((result, i) => preparedQueries[i].mapResult(result, true));
}
```

`this.client.transaction` 是 `@neondatabase/serverless` 的 `transaction()`，源码注释明示「expects an array of queries」（`index.js:1266`），并把整个数组作为**一个 HTTP 请求、一个数据库事务**发送（`index.js:1282-1293`，含 `Neon-Batch-Isolation-Level` / `Neon-Batch-Read-Only` / `Neon-Batch-Deferrable` 头）。因此 `common/db.ts:31` 的注释「整批一个 fetch，要么全成要么全废」**准确**。这是本项目数据层最扎实的一处设计。

**同时必须知道**：`drizzle-orm/neon-http/session.js:151-153` 明确 `throw new Error("No transactions support in neon-http driver")`。整个仓库 grep `db.transaction` 为 0 命中，说明团队正确地避开了这个陷阱，全部改用 `batch` + CTE 实现原子性。**这一点值得保留，不要因为「想要交互式事务」而换成 `neon-serverless`（WebSocket）驱动**——那会带来连接管理与 Serverless 生命周期的新问题。

### 2.2 【潜在风险】分页的 `count` 与列表是两个独立往返，存在短暂不一致

`post.service.ts:167-178` 用 `Promise.all([listPostsByQuery(...), countPosts(...)])`。这是两次独立的 Neon HTTP 请求，**不在同一事务里**，也没有走 `batch`（那样至少是同事务）。在两次之间插入/删除文章，会出现「第 2 页显示 9 条」或「总数比实际多 1」。对博客而言影响很小，但既然 `batch` 已经可用且是同事务，改成 `batch` 是零成本改进。

**修复方案** 把这两条查询改为 `atomicBatch`，保证快照一致。

### 2.3 【潜在风险】`limit: Number.MAX_SAFE_INTEGER` 作为默认值

`post.repository.ts:152`、`comment.repository.ts:41` 都用 `Number.MAX_SAFE_INTEGER` 作为 `limit` 的 fallback。

**为什么是问题**
`PG` 协议里 `LIMIT` 参数是 `bigint`，`9007199254740991` 超出了 `int8` 的最大值 `9223372036854775807`？——不，它在范围内，所以**不会报错**。但它会被当成一个真实的 `LIMIT` 下发，规划器无法做「无 LIMIT」的优化，且一旦有人误传大值就会真的把整表拉进内存。当前所有调用点都传了 `take`（`listPostsByQuery` 的调用方都给了 `take`），`listCommentsByPostId` 从 `listComments` 传 `take + 1`，但 `listFavoritedPosts`（`post.service.ts:374`）走 `listPostsByQuery({ ids, isDraft: false })`——**没有传 take**，于是命中这个默认值。

**修复方案**
把「无限制」表达为省略 `.limit()`：

```ts
const q = getDb()
  .select(POST_LIST_COLUMNS)
  .from(posts)
  .where(buildWhere(q))
  .orderBy(...buildOrderBy(q));
const rows = await (q.take ? q.limit(q.take) : q).offset(q.skip ?? 0);
```

并给 `listFavoritedPosts` 加一个显式上限（如 500），避免收藏数增长后一次拉全表。

### 2.4 【潜在风险】`listPostsByQuery` 的 `POST_LIST_COLUMNS` 与 `mapToPost` 之间存在类型/运行时鸿沟

`post.repository.ts:56-78`：

```ts
const POST_LIST_COLUMNS = {/* 17 列，无 content */} as const;
function mapToListPost(row: PostListRow): Post {
  return mapToPost({ ...row, content: "" }); // 造一个假 content
}
```

`PostListRow = Omit<PostRow, "content">` 是纯类型层面的保证，运行时靠 `mapToPost` 补 `content: ""`。**类型系统在这里说了谎**：`Post.content` 是必填 `string`，列表页拿到的其实是空串。下游 `stripHtml(post.summary || post.content)`（`rss/route.ts:25`、`posts/[id]/page.tsx:63`）在 `summary` 为空时会静默得到空串——虽然 `createPost` 保证了 `summary` 非空（`post.service.ts:210` 的 `buildSummary` 有 `(No content summary)` 兜底），所以当前不会出问题，但这是个隐式的、靠另一处代码兜底的类型谎言。

**修复方案** 让类型诚实：把 `Post` 拆成 `PostSummary`（无 `content`）与 `PostDetail`（有 `content`），列表接口返回 `PostSummary[]`。这样 `content: ""` 的伪造就没必要了，编译器也能阻止列表页误用 `content`。

### 2.5 【潜在风险】反范式计数字段存在漂移路径

涉及字段：`posts.views/likes/favorites/commentsCount`（`schema.ts:75-78`）、`users.statsArticles/statsLikes/statsViews`（`schema.ts:42-44`）。

#### 2.5.1 【严重缺陷】`togglePostAssociationAndCounters` 的 `delta` 与实际写入脱钩

**问题描述** `post.repository.ts:375-403` 的 `delta` CTE：

```sql
), added AS (
  INSERT INTO <assoc> (user_id, post_id)
  SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM flipped)
  ON CONFLICT DO NOTHING
  RETURNING 1
), delta AS (
  SELECT CASE WHEN EXISTS (SELECT 1 FROM flipped) THEN -1 ELSE 1 END AS d   -- ← 只看 flipped
)
UPDATE posts SET <counter> = <counter> + delta.d FROM delta WHERE posts.id = $2 ...
```

**`delta` 只判断 `flipped` 是否存在，完全不看 `added` 是否真的插入成功。** 而 `added` 的 `RETURNING 1` 是**判据的来源却未被使用**——这是本条目最直接的证据：数据库已经把「是否真的插进去了」告诉了我们，代码却忽略了它。

**触发条件（已逐一核对 CTE 的可见性语义，修正了一个常见的误述）**
同一个语句里的所有 CTE **共享同一个快照**，互相看不到对方的数据修改（PostgreSQL 文档 `queries-with.html`：数据修改型 CTE 之间通过 `RETURNING` 通信，**不能**互相看到对方的写入；且它们看到的是同一快照）。因此：

- **同一请求内的判断不可能出错**：`flipped` 为空 ⇒ 快照里没有该行 ⇒ `added` 必然能插入成功（唯一键冲突只可能来自**快照不可见但实际已提交**的行）⇒ `delta = +1` 正确。
- **唯一会出错的窗口**：`added` 的 INSERT 撞上唯一键（`primaryKey(userId, postId)`，`schema.ts:103`）而 `ON CONFLICT DO NOTHING` **静默跳过**，但 `delta` 仍算出 `+1`。
  这要求「该行在当前语句的快照里不可见、但在实际数据里已存在」。真实触发路径是**重放/重复提交**：
  1. 匿名或登录客户端把 `POST`（Server Action 或 API）**发两次**（双击、超时重试、`useAsyncAction` 的重试逻辑、代理重发）；
  2. 请求 A 的 `added` 插入成功并 `likes + 1`；
  3. 请求 B 的语句快照早在 A 提交**之前**就已取定（并发场景），于是 B 的 `flipped` 为空、`added` 撞唯一键静默跳过，但 `delta = +1` → `posts.likes` 与 `users.statsLikes` **各再 +1**。
- **结果**：`user_post_likes` 只有 1 行，而 `likes` 计数为 2。**偏差永久存在、没有任何对账机制能自愈**，且 `postReactByIp`（30/min，`policy.ts:48`）的额度足以触发。

**为什么是问题**
这是「计数与实际关联表不一致」的经典形态：**唯一真值（`user_post_likes` 的行数）与派生值（`posts.likes`）可以永久分叉**。用户在界面上看到 2 个赞，但只有 1 个人点过。

**修复方案** 让 `delta` 由**实际发生的写**决定（一行改动）：

```sql
), delta AS (
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM flipped) THEN -1
    WHEN EXISTS (SELECT 1 FROM added)   THEN 1
    ELSE 0                               -- 什么都没发生：不动计数
  END AS d
)
```

- `d = 0` 时 `SET counter = counter + 0` 是**无害的空更新**（但会产生一个死元组，可接受）。
- `RETURNING (delta.d < 0) AS is_removal` 在 `d = 0` 时返回 `false`，语义上表示「操作后是已点赞状态」——这与 `added` 被静默跳过（行确实已存在、用户确实处于已点赞态）**一致**，所以调用方 `togglePostLike` 的 `!result.isRemoval` 仍然正确。
- 建议同时加一个**对账脚本**作为兜底（见 2.5.4）。

#### 2.5.2 【潜在风险】`deleteCommentAndDecrementCounter` 的计数无下限保护

`comment.repository.ts:113-116`：

```sql
UPDATE posts SET comments_count = comments_count - 1
FROM deleted WHERE posts.id = deleted.post_id
```

没有 `GREATEST(..., 0)`。一旦 2.5.1 那类漂移已经存在（或某次 `increment` 丢包），计数会继续往负数走。**修复**：`SET comments_count = GREATEST(comments_count - 1, 0)`。

#### 2.5.3 【潜在风险】`deletePost` 的统计回收不完整

`post.service.ts:298-310` 删文章时只减 `statsArticles` 与 `statsLikes`（且后者仅当 `post.likes > 0` 时执行），**不减 `statsViews`、也不处理 `favorites`**。而 `posts.likes` 本身可能已因 2.5.1 而偏高，导致减扣值也是错的。另外它依赖外键 `ON DELETE CASCADE` 清理关联表（`schema.ts:98-101`、`:125`）——这部分是正确的。

#### 2.5.4 【潜在风险】没有对账/回填机制

`posts.views/likes/favorites/commentsCount` 与 `users.stats*` **全部靠增量维护**（`post.service.ts:230/290/305/307/323`、`comment.service.ts:84`、`post.repository.ts:399`）。任何一次失败、任何一次 2.5.1 的竞态，都留下**永久偏差且无法发现**。

**修复方案** 提供一个可手动/定时执行的权威重算脚本：

```sql
UPDATE posts p SET
  likes          = (SELECT count(*) FROM user_post_likes      l WHERE l.post_id = p.id),
  favorites      = (SELECT count(*) FROM user_post_favorites  f WHERE f.post_id = p.id),
  comments_count = (SELECT count(*) FROM comments             c WHERE c.post_id = p.id);

UPDATE users u SET
  stats_articles = (SELECT count(*) FROM posts p WHERE p.author_id = u.id AND p.is_draft = false),
  stats_likes    = (SELECT coalesce(sum(p.likes), 0) FROM posts p WHERE p.author_id = u.id);
```

`views` 与 `stats_views` 是有损增量（见 2.6），无法从关联表反推，只能接受近似值——这本身就是 2.6 主张改为事件表的另一条理由。

#### 2.5.5 【潜在风险】`posts_views` 类热行争用与 `after()` 时限

见 2.6 与「并发/稳定性」汇总。要点：`after()` 的执行受平台时限约束（`next/dist/docs/01-app/03-api-reference/04-functions/after.md:50`：**「`after` will run for the platform's default or configured max duration of your route」**），热点文章上行锁排队过久会被**直接砍掉**，只留一条 `logger.error`（`post.service.ts:328-333`），计数静默丢失。这与 `after()` 不使路由变动态是同一份文档的两个不同约束，都需要知道。

### 2.6 【潜在风险】热点行写放大：`posts.views` / `users.statsViews`

`post.service.ts:319-334` 在 `after()` 里对同一篇文章的 `views` 做 `+1`，同时给作者的 `statsViews` 做 `+1`。

**为什么是问题**
PostgreSQL 的 `UPDATE` 是行级写，会创建新版本元组（MVCC）。一个热门文章被持续访问时，**同一行的并发 `UPDATE` 会串行化**（行锁），并产生大量死元组，依赖 autovacuum 回收。在 Neon 上，写放大还直接换算成 CU-hours 与 WAL 流量。用户表的 `statsViews` 更糟：所有文章共享作者这一行，是全站写热点。

**修复方案**
浏览量聚合到独立表或异步批处理：

```sql
CREATE TABLE post_view_events (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewed_on date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, viewed_on)
);
-- 写入：INSERT ... ON CONFLICT (post_id, viewed_on) DO UPDATE SET count = count + 1
-- 展示/定时任务再把聚合值同步回 posts.views
```

这会把「每篇文章每天一行」变成一个可预测的写入量。若嫌重，至少应把 `users.statsViews` 的实时更新去掉，改为定时汇总（它没有任何实时展示需求——`ProfilePageContent` 展示的是个人主页，几小时的延迟无感）。

### 2.7 【潜在风险】`users.statsArticles` 的写入在 `createPost` 中与插入同一批次，但顺序有隐患

`post.service.ts:228-231`：

```ts
await getDb().batch([
  insertPostStmt(post),
  ...(isDraft ? [] : [incrementUserStatStmt(dto.authorId, "posts", 1)]),
]);
```

`insertPostStmt` 与 `incrementUserStatStmt` 在同一事务内，如果 `authorId` 指向不存在的用户，外键会失败并回滚整批——行为正确。这条没问题，列出仅为确认已评估。

### 2.8 【潜在风险】`withDbRetry` 未覆盖任何写路径，导致写失败的恢复策略缺失

grep 确认 `withDbRetry` 只用在 4 处读路径（`home/page.tsx:27`、`posts/page.tsx:59`、`posts/[id]/page.tsx:136`、`rss/route.ts:17`）。所有写路径（Server Actions）直接抛给 `runAction` → `toFailure` → 用户看到「Internal server error, please try again later」。

这在语义上是对的（写不应自动重试），但**没有任何幂等键或去重机制**。用户手动重试「发布文章」时，如果第一次其实成功了只是响应丢了，就会产生**两篇重复文章**（`generatePostId()` 每次生成新 id，`post.service.ts:82-86`，没有唯一约束能挡住）。这是 2.5 之外又一个真实的重复写入风险。

**修复方案** 引入客户端生成的幂等键：`post.id` 由前端在提交前生成（或服务端接受一个 `clientRequestId`），并加 `posts(id)` 唯一约束（已有主键）+ 服务端 `ON CONFLICT DO NOTHING`，重复请求返回已存在的记录。

### 2.9 【潜在风险】索引设计与查询的实际匹配度

逐条核对 `schema.ts:80-90` 的索引与 `buildWhere`（`post.repository.ts:111-125`）/ `buildOrderBy`（127-144）：

| 查询形态                                                         | 可用索引                                                   | 评估                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isDraft = false` + 按 `publishedAt DESC NULLS LAST` 排序 + 分页 | `posts_is_draft_published_at_idx (is_draft, published_at)` | ✅ 可用。但 **`NULLS LAST` 会削弱索引的有序性利用**——PostgreSQL 对 `DESC NULLS LAST` 可以使用索引（因为 `DESC` 默认就是 `NULLS FIRST`，`NULLS LAST` 需要逆向扫描并处理 NULL 段）。建议把索引改成 `(is_draft, published_at DESC NULLS LAST)` 显式匹配排序，或干脆让 `published_at` 在 `is_draft = false` 时保证非空。 |
| `pinned DESC` + `published_at DESC`                              | 无复合索引                                                 | ❌ 需要排序节点。`pinned` 是低频字段（只有少数文章置顶），可考虑部分索引 `WHERE pinned = true` 单独查置顶项再 union。                                                                                                                                                                                                |
| `category = ?`                                                   | `posts_category_idx`                                       | ✅                                                                                                                                                                                                                                                                                                                   |
| `tags @> ARRAY[?]`（`arrayContains`）                            | `posts_tags_idx`（GIN）                                    | ✅                                                                                                                                                                                                                                                                                                                   |
| `authorId = ?` + `isDraft = true`（草稿列表）                    | `posts_author_id_idx`                                      | ⚠️ 建议改 `(author_id, is_draft)` 复合                                                                                                                                                                                                                                                                               |
| `title ILIKE '%x%'` / `content ILIKE '%x%'`                      | trgm GIN，但短模式退化                                     | ❌ 见 1.3                                                                                                                                                                                                                                                                                                            |
| `countPosts`                                                     | 同 `buildWhere`，需全量计数                                | ⚠️ 每次都精确计数，无近似/缓存                                                                                                                                                                                                                                                                                       |
| `listDistinctCategories`（`post.repository.ts:162-168`）         | `posts_category_idx`                                       | ⚠️ `is_draft = false` 不在索引里，会扫全部非草稿行                                                                                                                                                                                                                                                                   |
| `listTagCounts`（170-180）unnest + GROUP BY                      | 无法用索引                                                 | ⚠️ 每次全表 unnest，且 `tags` 是 `text[]` 无统计信息                                                                                                                                                                                                                                                                 |
| `findNeighborPosts`（319-363）                                   | 两个 OR 条件 + `publishedAt` 排序                          | ⚠️ OR 会退化为位图 OR 或顺序扫描，两次查询                                                                                                                                                                                                                                                                           |

**修复方案**（按收益排序）

1. 补 `posts(author_id, is_draft)`。
2. `posts_is_draft_published_at_idx` 改为 `(is_draft, published_at DESC NULLS LAST)`。
3. `listDistinctCategories` 改为对 `posts_category_idx` 友好的写法：加 `posts(is_draft, category)` 复合索引或改成物化视图 / 应用层缓存（它已经有 `TAXONOMY_LIFE = 3600` 的 `use cache`，见 `post.cache.ts:118-123`，所以优先级最低）。
4. `listTagCounts` 同样已被 `listTagsCached` 缓存 1 小时，优先级别低；但 `tags` 数组的聚合可考虑改成维护一张 `tags(name, count)` 表（写时更新），彻底消除全表 unnest。

### 2.10 【潜在风险】`countPosts` 在精确计数上的开销

`post.repository.ts:157-160` 每次都执行 `SELECT count(*)`。在搜索场景下（1.3 的 ILIKE）这意味着**全表扫描两次**（一次计数、一次取 9 条）。`/posts?q=x` 是这个项目里最贵的请求。

**修复方案** 搜索结果不提供精确总数，改为「是否还有下一页」的游标判断（`limit + 1` 探测，`listComments` 已经是这个模式，见 `comment.service.ts:53-58`）。这是零成本的正确做法。

### 2.11 【潜在风险】缺少迁移机制，生产 schema 靠 `db:push --force`

**证据**：仓库根目录**没有** `drizzle/` 目录；`package.json` 只有 `db:push` / `db:generate` / `db:studio`，没有 `db:migrate`。`scripts/db-push.mjs:25-35` 用 `drizzle-kit push --force --verbose`。

**为什么是问题**

1. `--force` 会**跳过所有破坏性变更的确认**（删列、改类型、删表）。对生产库执行时，一次误改 schema 就是不可逆的数据丢失。
2. 没有版本化的迁移文件，意味着**无法回滚**、无法审计「什么时候改了哪一列」、无法在 CI 里校验「生产 schema 是否与代码匹配」。
3. 两个部署平台的行为不同：Netlify 的构建流程**不会**跑 `db:push`（`netlify.toml` 的 build command 只有 install + build），Railway 的 `railway.json` 也没有 pre-deploy 钩子。所以 schema 变更目前完全依赖开发者**在本地手动执行**，这正是「本地能跑、线上报 column does not exist」这类不一致的典型温床。

**修复方案**

```jsonc
// package.json
"db:generate": "drizzle-kit generate",          // 已存在
"db:migrate":  "drizzle-kit migrate",           // 新增：应用迁移
"db:check":    "drizzle-kit check"              // 新增：CI 校验快照一致性
```

- 保留 `db:push` **仅用于本地开发**，并在脚本里加 `NODE_ENV !== "production"` 断言。
- 生产改用 `drizzle-kit migrate`，迁移文件进 git。
- Railway 用 pre-deploy command 跑 `pnpm db:migrate`；Netlify 用构建钩子或手动触发（Netlify 没有 pre-deploy 概念，建议用 GitHub Actions 统一负责迁移，避免两个平台各跑一次导致重复执行）。
- `pg_trgm` 扩展仍需带外创建（`scripts/db-push.mjs:21-23` 已正确处理），在迁移里应写成 `CREATE EXTENSION IF NOT EXISTS pg_trgm` 的第一个 migration。

### 2.12 【优化项】`listTagCounts` / `listDistinctCategories` 的类型断言存在风险

`post.repository.ts:171`：

```ts
const { rows } = await getDb().execute<{ tag: string; count: number }>(
  sql`... COUNT(*)::int AS count ...`,
);
```

`COUNT(*)::int` 显式转 int 是对的（否则 `bigint` 会被驱动返回字符串，而类型标注成 `number` 就是说谎）。这是本项目里处理得比较细致的一处——`::int` 在 `countComments` 里没有用，但 `count()` 走 Drizzle 的映射器所以没问题。

**建议**：把 `::int` 的用法统一起来，或在 `db.ts` 里提供一个 `executeTyped` 辅助，把这个约定固化。

### 2.13 【优化项】`rate_limits` 表的清理靠 1% 随机

`rate-limit.ts:28-34`：`...(Math.random() < 0.01 ? [delete expired] : [])`。

**为什么是问题**

- 概率性清理在低流量下可能长时间不触发，`rate_limits` 会持续增长（每个 (key, window) 一行，key 里含 IP 和 email，长尾极多）。
- 清理本身是一次 DELETE + 索引扫描，被随机塞进请求路径里，会产生不可预测的 P99 延迟尖刺。
- 该表只有 `rate_limits_expires_at_idx`，没有 TTL 机制。

**修复方案** 交给外部定时任务（Railway 的 Cron / Netlify Scheduled Function，或一个 `pg_cron` 任务）：

```sql
DELETE FROM rate_limits WHERE expires_at <= now();
```

并从热路径里删掉那 1% 的分支。或者更彻底：改用 Neon 的分区表按天分区 + `DROP PARTITION`。

### 2.14 【优化项】限流 key 未做长度/字符约束

`rate-limit.ts:9`：`const id = \`ratelimit:${key}\``，key 来自 `${options.rateLimit.key}:${ip}` 与 `login:acct:${dto.email.toLowerCase()}`（`auth.controller.ts:78`）。

**为什么是问题**
`email` 在 `loginSchema` 里已由 `z.email()` 校验且 `maxLength` 未设置上限（`validation/auth.ts:35-45` 的 `loginSchema` 对 email 只有 `z.email()`）——**`z.email()` 不限制长度**。一个超长「合法邮箱」（只需形如 `a@b.c`，长度可到几十 KB）会成为 `rate_limits.id`（`text` 主键）的值，既撑大索引，也让 rate-limit 的写入变重。`register` 路径同理（`registerSchema.email` 也无长度上限）。这是低成本可打的放大攻击面。

**修复方案** 给 email 加 `maxLength(254)`（RFC 5321 上限），并在 `isRateLimited` 里对 key 做 `key.slice(0, 200)` 兜底。

---

### 2.14b 【严重缺陷】裸 `Date` 参数绕过列编码器 → 写入本机时区墙钟，跨环境失真

**问题描述** `rate-limit.ts:10-11` 与 `:19-20`、`:32` 把 `Date` 对象**直接放进 `sql\`\`` 模板**：

```ts
const now = new Date();
const expiresAt = new Date(now.getTime() + policy.windowMs);
const upsert = getDb()
  .insert(rateLimits)
  .values({ id, count: 1, expiresAt })
  .onConflictDoUpdate({
    target: rateLimits.id,
    set: {
      count: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
      expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${expiresAt} ELSE ${rateLimits.expiresAt} END`,
    },
  });
```

**完整的证据链（三段都已逐个核实）**

1. **`sql` 模板里的裸值用 `noopEncoder`，不经过 `PgTimestamp` 的编码器。**
   `node_modules/drizzle-orm/sql/sql.js:258-260`：`const noopEncoder = { mapToDriverValue: (value) => value }`；`:270` `constructor(value, encoder = noopEncoder)`。
   对比 `node_modules/drizzle-orm/pg-core/columns/timestamp.js:34-35`：`mapToDriverValue = (value) => value.toISOString()`。
   → 写**列**（`.values({ expiresAt })`）走 `toISOString()`；而写在 `sql\`\``里的`${now}` / `${expiresAt}` **原样下传 Date 对象**。

2. **`@neondatabase/serverless` 对 `Date` 默认用「本机时区 + 本机偏移」格式化。**
   `node_modules/@neondatabase/serverless/index.js:645` 的默认配置含 `parseInputDatesAsUTC:!1`（即 **false**）。
   `:655`：`return r instanceof Date ? Au.parseInputDatesAsUTC ? Tu(r) : Iu(r) : ...`
   `:659` 的 `Iu`（`dateToString`）以 `var e=-r.getTimezoneOffset()` 计算偏移并拼进字符串——**这是本机时区**；`Tu`（`dateToStringUTC`）才是 UTC 版本，只在 `parseInputDatesAsUTC` 为真时使用。

3. **列是无时区的 `timestamp(3)`，PostgreSQL 会静默丢弃偏移。**
   `schema.ts:13` 的 `tsCol` → `timestamp`（无 `withTimezone`）。PostgreSQL 文档 §8.5.1.3：**「In a value that has been determined to be `timestamp without time zone`, PostgreSQL will silently ignore any time zone indication.」**

**净结果**：`rate_limits.expires_at` 里存的是**写入机器的本机墙钟**，而不是 UTC 瞬间。

**为什么是问题（这条的杀伤力在于共用同一个数据库）**
`.env.local` 的 `DATABASE_URL` 指向的 host 是 `...-pooler.c-6.us-east-2.aws.neon.tech` —— **与线上是同一个库**（没有独立的 dev branch）。

- Netlify / Railway 跑 UTC，写入 `+00:00` → 无害；
- 在 UTC+8 的开发机上写入的是 `+08:00` → 存进去的墙钟比 UTC 早 8 小时。
- `expiresAt` 的 SET 逻辑是在 `.values()` 里（走 `toISOString()`、正确），但 `sql` 模板里的 `${expiresAt}`（用于**窗口重置**）是本机墙钟 → 两者混写同一列。

后果是 `CASE WHEN expires_at <= now() ...` 的判断被系统性偏移 8 小时：**限流窗口要么提前 8 小时失效（等于没限流），要么 8 小时不重置（把正常用户长时间锁死）** —— 方向取决于哪一侧写的。这是典型的「本机测不出、线上表现诡异」，且现象会随开发机时区不同而变。

**修复方案（首选：把时间完全交给数据库，避免任何客户端时钟参与）**

```ts
const upsert = getDb()
  .insert(rateLimits)
  .values({ id, count: 1, expiresAt: sql`now() + ${policy.windowMs} * interval '1 millisecond'` })
  .onConflictDoUpdate({
    target: rateLimits.id,
    set: {
      count: sql`CASE WHEN ${rateLimits.expiresAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
      expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= now()
                    THEN now() + ${policy.windowMs} * interval '1 millisecond'
                    ELSE ${rateLimits.expiresAt} END`,
    },
  })
  .returning({ count: rateLimits.count });
```

这样 `now()` 由 PostgreSQL 提供（同一时钟来源），彻底消除客户端时区与时钟偏移。**最低限度的修法**是把两个插值改为 `sql\`${now.toISOString()}::timestamp\`` / `sql\`${expiresAt.toISOString()}::timestamp\``，让语义与 `.values()` 路径一致。

**并建议**：`.env.local` 改指向 Neon 的 **dev branch**，生产连接串只放在平台环境变量里（与 2.11 的建议一致）。这不只是卫生问题——上面这个 bug 之所以危险，正是因为本地开发直接写生产库。

### 2.15 【优化项】`decodePostId`/`encodePostId` 的 id 格式未从数据库层面约束

`schema.ts:61` 是 `text("id").primaryKey()`，`post.service.ts:82-86` 生成 `${Date.now()}-${randomUUID().slice(0,8)}` 并用 `assertValidPostId` 校验。`shared/validation/post-id.ts` 存在但我未逐行读；`posts/[id]/page.tsx:134` 每次渲染都调用 `decodePostId(rawId)`。

**建议** 若是为了 SEO 友好 URL 而做编码（而非直接暴露 `timestamp-uuid`），应在 `assertValidPostId` 上方写明这个决策，并考虑加数据库级 `CHECK (id ~ '^[0-9]+-[a-f0-9]{8}$')`，防止其他写入路径绕过应用层校验。

### 2.16 【已验证·正确】SQL 注入防护到位

- `escapeLike` + 参数化 `sql\`${pattern}\``（`post.repository.ts:119-122`）：参数走绑定变量，不是字符串拼接。✅
- 所有 `sql.raw(...)`（`post.repository.ts:381`、`post.repository.ts:391,399`、`comment.repository.ts:114,130`）传入的都是**来自 schema 的列名**（`assocTable.userId.name`、`counter.name`、`comments.userName.name`），不是用户输入。✅
- `atomicBatch` 的 statements 由 Drizzle 构造，`fillPlaceholders` 走驱动层绑定（`neon-http/session.js:30`）。✅
- 唯一的字符串拼接是 `` `ratelimit:${key}` ``（2.14 已述，是 DoS 面而非注入面）。✅

**没有发现 SQL 注入漏洞。** 这一点做得好。

### 2.17 【已验证·正确】连接管理符合 neon-http 的正确定位

`common/db.ts:22-29` 用 `globalForDb.drizzleDb` 做单例，且是**懒加载**（`getDb()` 而非模块顶层 `drizzle(neon(...))`）。grep 确认全仓没有任何地方在模块顶层构造 db 或直接 import 一个 `db` 实例。

这很重要：`env.DATABASE_URL` 缺失时抛错（`env.ts:32`），但由于懒加载，**只在第一次真的查询时才抛**，所以「构建期不访问数据库」的路由不会因为缺 env 而失败。✅

`neon()` 基于 HTTP，每次查询一个 fetch，天然无连接池、无泄漏风险——对 Netlify 的多实例函数模型是正确的选择。**唯一的取舍**是没有 prepared statement 复用、每次有 TLS 握手开销，以及无法做交互式事务（2.1）。在 Railway 的长驻进程模型下，`pg` + 连接池在吞吐上会更好，但为了双平台一致性，保持 `neon-http` 是合理的工程决策。

---

## 3. 部署专项（Netlify + Railway）

### 3.1 双平台行为不一致的根因分析

这是本次评审最需要结论的部分。以下是**已从源码确认**的差异根因，按影响排序。

#### 根因 1：`use cache` 的存储后端完全不同 ← 影响最大

- **Netlify**：`@netlify/plugin-nextjs` 在构建期把 `enableUseCacheHandler` 写进 `run-config.json`（`dist/build/content/server.js:71-82`），判据是 `semver.satisfies(ctx.nextVersion, ">=15.3.0-canary.13")` —— 本机 `next@16.3.5` 满足。运行时 `dist/run/handlers/server.js:3109-3111` 调用 `configureUseCacheHandlers()`，而该函数（`dist/run/handlers/use-cache-handler.js:1571-1575`）把 `globalThis[Symbol.for("@next/cache-handlers")].DefaultCache` 设为 `NetlifyDefaultUseCacheHandler`。这个 handler 的**值存储在进程内 LRU**（`use-cache-handler.js:1392-1404`：`max: 1e3` 条、`maxSize: 50 * 1024 * 1024`，挂在 `globalThis` 上），**tag 过期信息存在 Netlify Blobs**（`markTagsAsStaleAndPurgeEdgeCache`，`use-cache-handler.js:1550-1567`）。
- **Railway**：没有任何插件介入，`use cache` 走 Next 默认的文件系统 handler（`next/dist/server/lib/incremental-cache/index.js:100-113`：若 `globalThis[cacheHandlersSymbol].FetchCache` 不存在则 `CurCacheHandler = filesystemcache`）。

**由此产生的具体不一致**：

1. **Netlify 的缓存是每实例、易失的**。一次部署、一次实例回收、一次 LRU 淘汰（50MB 上限），`use cache` 的内容就没了，下一次请求回源数据库。Railway 上文件系统缓存跨请求、跨重启（只要 `.next/cache` 在本地盘上）持续存在。
2. **Netlify 的失效是「tag 标记 + 本地丢弃」两段式**：`updateTag` 写 Blobs 标记 tag 过期（全集群可见），但**值本身仍在各实例的 LRU 里**，直到某次 `get` 发现 tag 过期才丢弃（`use-cache-handler.js:1447-1455`）。Railway 上 `revalidateTag`/`updateTag` 同时让文件系统里的值和 tag 一起失效。
   → **表现差异**：Netlify 上「发布新文章后，另一个实例可能仍返回旧列表最多若干秒」；Railway 上基本立即一致（单进程）。
3. **Netlify 上 `use cache` 受 50MB 限制**，Railway 上受磁盘限制。`sitemap.ts:12` 的 `listPostsCached({ limit: 20000 })` 会缓存一个最多 2 万行的数组（含 `tags` 数组），在 Netlify 上很容易撞上 LRU 上限并把其它条目挤出去。

**修复方案**

- **不要让 `use cache` 承载大数据集**：`sitemap.ts` 改用流式/游标查询，不缓存 2 万行（见 3.6）。
- **接受并显式声明「最终一致」**：在 README 的缓存章节写明「Netlify 上 `use cache` 是每实例内存 + Blobs tag，失效后首个请求仍可能命中旧值」。
- **若要求强一致**，两个平台都应改用外部共享缓存（Upstash Redis）并在 `next.config.ts` 的 `cacheHandlers.default` 指向自定义 handler。这是唯一能让两个平台行为一致的做法，但引入新依赖与成本。
- **若要求简单可靠**：考虑**放弃 `use cache`**，改为纯 PPR 静态壳 + `revalidate` 时间窗（`export const revalidate = 300`），把一致性交给 CDN。项目的读多写少特性完全承受得起。

#### 根因 2：Proxy 的执行位置不同

本机构建产物证实了一件容易被忽略的事：

- `.next/server/middleware-manifest.json` 是 **完全空的**（`{"version":3,"middleware":{},"sortedMiddleware":[],"functions":{}}`）；
- `.next/server/middleware/middleware-manifest.json` 也是空的；
- **真正的信息在 `.next/server/functions-config-manifest.json`**：
  ```json
  {
    "functions": {
      "/_middleware": {
        "runtime": "nodejs",
        "matchers": [
          {
            "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|api|...).*))...",
            "originalSource": "/((?!_next/static|_next/image|api|...).*)"
          }
        ]
      }
    }
  }
  ```

即：**Next 16 的 `proxy.ts` 编译产物的 manifest 位置变了**，从 `middleware-manifest.json` 迁到了 `functions-config-manifest.json`，且 `runtime` 是 `nodejs`（不是 edge）。

Netlify 插件已经跟上：`dist/build/content/server.js:279-298` 的 `replaceFunctionsConfigManifest` 精确处理了 `manifest?.functions?.["/_middleware"]?.matchers`，把 regexp 改成永不匹配的 `(?!.*)`，注释说明这是「禁用 middleware 在 server handler 内运行，同时保留 Next 的 `_next/data` 规范化逻辑」。

**关键的运行时结论（已核对源码 + Next 官方文档，修正了本报告初版的错误判断）**：

`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:255` 明确写道：

> **"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."**

`proxy.md:806` 的版本表也确认「v16.0.0：Middleware is deprecated and renamed to Proxy. **Proxy defaults to the Node.js runtime**」。这与 `functions-config-manifest.json` 里的 `"runtime": "nodejs"` 完全一致。

**因此：`jsonwebtoken` 在 `src/proxy.ts` 里是可用的，不需要换成 `jose`。** 本报告初版曾推断「proxy 跑在 Edge、必须用 jose」——**该推断错误**，`runtime` 选项本身就被禁止设置，Node runtime 是唯一可能。

但 Netlify 侧的转换仍带来一个**真实且不同的**约束。`dist/build/functions/edge.js` 的处理是：

- `:252` 检查 `functionsConfigManifest.functions["/_middleware"]` 且 `nodeMiddlewareDefinitionHasMatcher(...)`（`:19-21`，即定义了 matchers）→ 走 **Node middleware** 分支；
- `:136-199` 的 `copyHandlerDependenciesForNodeMiddleware` 把 `edge-runtime/shim/node.js` **内联**进产物，而这个 shim（`edge-runtime/shim/node.js:1-19`）包含：
  ```js
  import { createRequire } from "node:module";
  if (typeof process === "undefined") globalThis.process = (await import("node:process")).default;
  globalThis.AsyncLocalStorage = (await import("node:async_hooks")).AsyncLocalStorage;
  globalThis.Buffer = (await import("node:buffer")).Buffer;
  Deno.cwd = () => ""; // ← Deno
  ```
  `Deno.cwd` 的赋值证明**产物仍然运行在 Netlify 的 Deno 系 edge runtime 里**，只是用 shim 把部分 `node:*` 模块桥接了过去；
- `:177-184` 有一处**硬失败**：扫描 `.nft.json` 里的依赖，若发现 `.node` 文件（**C++ 原生插件**）就 `throw new Error("Usage of unsupported C++ Addon(s) found in Node.js Middleware")`。

**由此产生的真实不一致**：

1. **Netlify 上 proxy 只能使用 shim 桥接过的 Node API 子集**：`process` / `AsyncLocalStorage` / `Buffer` / `node:module` 可用，但**任何 C++ 原生插件（`.node`）会导致 Netlify 构建直接失败**，而在 Railway 上完全正常。`jsonwebtoken` 是纯 JS（依赖 `jws`、`safe-buffer` 等），**不会**触发这个失败；但若有人为了「顺便验签」改用依赖原生模块的库，就是「本地与 Railway 正常、Netlify 构建失败」。
2. `bcryptjs` 同样是纯 JS，可用；但**不要在 proxy 里做 bcrypt**（Deno 桥接下的 CPU 成本 + 阻塞边缘请求路径）。
3. matcher 中的 `api` 排除、静态资源排除在两个平台都由 Next 的 manifest 驱动，这一层是一致的。

**修复方案**

- 在 `src/proxy.ts` 顶部写明约束（按上面的准确表述，不要写成「禁止所有 node:*」）：
  ```ts
  // 运行环境：Next 16 的 Proxy 固定为 Node.js runtime（proxy.md:255，runtime 选项被禁止设置）。
  // 部署注意：在 Netlify 上该文件由 @netlify/plugin-nextjs 的 node-middleware 分支承载，
  // 运行于 Deno 系 edge runtime + node shim（edge-runtime/shim/node.js）。
  // 因此：可以使用 process/Buffer/AsyncLocalStorage 与纯 JS 的 node 库；
  // 但任何含 C++ 原生插件（.node）的依赖都会让 Netlify 构建直接失败（build/functions/edge.js:177-184）。
  // 保持本文件只做轻量的 cookie 检查与重定向，不做 CPU 密集或依赖原生模块的工作。
  ```
- **顺带说明一个真正的收益点**：既然 proxy 确定是 Node runtime 且 `jsonwebtoken` 可用，那么 1.1 里「proxy 只检查 cookie 是否存在」这个弱点**是可以修的**——把 `verifyToken` 接进 proxy，就能把「过期/伪造 token 直接放行到页面再由服务端二次拦截」提前到边缘。但要注意 Next 官方在 `proxy.md:249-251` 的告诫：Server Function 不是独立路由、matcher 排除会一并跳过，**「Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone」**。所以 proxy 验签是**纵深防御**，不能替代 `requireUserOrRedirect`（`auth.guard.ts:118-124`）。
- 加 ESLint 规则禁止 `src/proxy.ts` import 含原生插件的依赖，把上面的约束变成机器强制。

#### 根因 3：构建期 `output: "standalone"` 的隐式启用

`@netlify/plugin-nextjs` 的 `onPreBuild`（`dist/index.js:54`）设置 `process.env.NEXT_PRIVATE_STANDALONE = "true"`。Next 的 `config-shared.js:142` 是：

```js
output: !!process.env.NEXT_PRIVATE_STANDALONE ? 'standalone' : undefined,
```

即**环境变量优先级高于用户配置**，Netlify 构建时会被强制 `output: 'standalone'`，并在 `.next/standalone/` 产出裁剪后的服务端（插件依赖它：`plugin-context.js:85-86` `standaloneRootDir = join(publishDir, "standalone")`，`dist/build/content/server.js:46-51` 找不到 `required-server-files.json` 会 `failBuild`）。

Railway 上没有任何变量干预，`next build` 产出常规 `.next`，由 `next start` 使用。

**由此产生的不一致**：Netlify 构建后的 `.next` 里多了 `standalone/` 目录，`next start` 的可用性不同；**如果哪天有人在 Railway 侧误设 `NEXT_PRIVATE_STANDALONE=true`，`next start` 仍可用但产物形态变了**。更实际的差异是**构建产物体积**：Netlify 产物包含 standalone 副本，Railway 不含。

**结论**：这个差异是**良性的**，两边各自的启动方式都正确，不需要修。列出来是为了回答「为什么同一个构建命令产出不同目录结构」。

#### 根因 4：默认打包器是 Turbopack（Next 16 行为变更）

`node_modules/next/dist/lib/bundler.js` 的 `parseBundlerArgs` 末尾：

```js
// The default is turbopack when nothing is configured.
if (bundlerFlags.size === 0) {
  process.env.TURBOPACK = "auto";
  return 0; // Bundler.Turbopack
}
```

`package.json:9` 的 build 是裸 `next build`，因此**两个平台都用 Turbopack 构建**。本机 `.next/server/middleware.js` 的内容证实了这一点：

```js
var R = require("./chunks/[turbopack]_runtime.js")("server/middleware.js");
```

**由此产生的影响**：

1. 两个平台的打包器一致，这一层**行为相同**，不是不一致的来源。✅
2. 但 `@netlify/plugin-nextjs@5.15.13` 的 `_pluginPatchNextModules`（`dist/build/content/server.js:236`）会按 Next 版本对 `next` 内部模块打补丁。**Turbopack 的 chunk 布局与 webpack 不同**，插件对 Turbopack 产物的适配成熟度是未知的，**待实测**：建议在 Netlify 上跑一次完整部署并逐个验证 `/`、`/posts`、`/posts/<id>`、`/api/health`、`/rss`、`/sitemap.xml`。
3. 若在 Netlify 上遇到无法解释的运行时错误，**第一个该试的动作是改用 webpack 构建**：`"build": "next build --webpack"`。这能以最小代价排除 Turbopack 适配问题。

#### 根因 5：函数超时与实例模型的差异

| 维度        | Netlify                                                                                           | Railway                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 运行模型    | 函数（每请求），有墙钟超时与包体积上限                                                            | 长驻 Node 进程，无函数超时                                               |
| bcrypt 成本 | `BCRYPT_SALT_ROUNDS=10` 约 60–100ms CPU，占用函数墙钟                                             | 同样 CPU，但不计入请求超时预算                                           |
| 冷启动      | 每实例冷启动需加载 Next runtime + Prisma/Drizzle + highlight.js(14 语言) + marked + sanitize-html | 只有部署后首次                                                           |
| 连接        | 每请求新建 neon HTTP fetch                                                                        | 同                                                                       |
| 图片优化    | 插件接管的 `/_next/image`，由 CDN 缓存                                                            | `next start` 进程内处理，**无 CDN，每次未命中都在 Node 里做 sharp 转码** |

**风险点**：`post.render.ts` 在**模块顶层**注册 14 个 highlight.js 语言（`post.render.ts:5-19,58`）并 `new Marked(...)`（60-67）。这些都在服务端，意味着**每次 Netlify 函数冷启动都要解析这 14 个语言包**。在 Netlify 上这直接计入函数启动延迟，可能造成首字节几秒的延迟，甚至撞上函数超时。

**修复方案**

- 把 `highlight.js` 的语言注册改成**按需惰性注册**（只在遇到该语言的代码块时才 `await import` 对应语言包）：
  ```ts
  async function ensureLanguage(lang: string) {
    if (hljs.getLanguage(lang)) return;
    const mod = await LANGUAGE_LOADERS[lang]?.();
    if (mod) hljs.registerLanguage(lang, mod.default);
  }
  ```
  但 `renderPostBody` 目前是同步的（`post.render.ts:143`），需要改成 async——这会波及 `getPost`（`post.service.ts:192`）。**更划算的替代方案**：**在写入时就把 Markdown 渲染成 HTML 并存入数据库**（新增 `content_html` 列），读取路径完全不跑 marked/highlight.js。这同时解决了：
  - 每次请求重复渲染同一篇文章的 CPU 浪费（当前 `getPost` 每次缓存未命中都重新渲染）；
  - 冷启动体积（highlight.js 只在写入路径加载）；
  - 渲染结果的一致性。
    代价是「改渲染器需回填历史数据」，加一个 `pnpm backfill:html` 脚本即可。
- Railway 侧的图片优化应配置 `images.minimumCacheTTL` 并考虑前置 CDN（Cloudflare），否则每张图每个尺寸都在 Node 进程里实时转码，图片一多就会打满 CPU。

#### 根因 6：环境变量注入维度不同（构建期 vs 运行期）

| 变量                                              | 读取位置                            | 需要的注入时机                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | `env.ts:32`（运行时）+ 构建期预渲染 | **两处都要**（Netlify 构建环境 + 函数运行时；Railway 构建 + 运行）                                                                                 |
| `JWT_SECRET`                                      | `env.ts:23-30`                      | 运行时；**构建期也必须存在**（见下）                                                                                                               |
| `NEXT_PUBLIC_BASE_URL`                            | `config/site.ts:1`                  | **构建期**（`NEXT_PUBLIC_*` 会内联进客户端 bundle；`SITE_URL` 在 `generateMetadata`/`sitemap`/`rss` 的服务端代码里也会被求值，但客户端引用会固化） |
| `BCRYPT_SALT_ROUNDS` / `JWT_*` / `COOKIE_MAX_AGE` | `env.ts:44-62`                      | 运行时                                                                                                                                             |
| `ANALYZE`                                         | `next.config.ts:6`                  | 构建期                                                                                                                                             |

**两个高危点**：

1. **`JWT_SECRET` 必须在构建期存在。** `next build` 会把 `NODE_ENV` 设为 `production`（`next/dist/bin/next:84`，Commander `preAction` 钩子对非 dev 命令设 `production`），于是 `env.ts:23-30` 在**模块求值时**就会执行 `getEnv("JWT_SECRET", NODE_ENV === "production" ? undefined : random)` → 抛错。任何在构建期被求值的服务端模块（预渲染 `/`、`/posts`、`/posts/[id]`、`sitemap.xml`、`/rss`）都会触发。
   → **Netlify 和 Railway 都必须在「构建环境变量」里配置 `JWT_SECRET`，而不只是运行时。** 否则构建直接失败；更糟的情况是某构建路径没触发到该模块，构建成功但运行时报错。
   **就本项目现状**：本机能构建成功说明本地 `.env.local` 提供了它。两个平台需要各自配置。这一条建议写进 README 的部署章节。

2. **`NEXT_PUBLIC_BASE_URL` 必须在构建期配置。** 它是 `NEXT_PUBLIC_` 前缀，Next 会在**构建时内联**。若只在运行时配置，客户端 bundle 里仍是 `http://localhost:3000`，而服务端的 `SITE_URL`（`config/site.ts:1`）在运行时是新值——**导致 `sitemap.xml`、RSS 的 `<link>`、canonical、OG URL 出现两套域名**。这是「本地正常、线上 SEO 全错」的经典成因。
   → 两个平台都必须在构建环境变量里设置，且值要带 `https://` 且不带尾斜杠（`.replace(/\/+$/,"")` 已处理尾斜杠，但没有补协议）。

3. **Railway 没有 `netlify.toml` 那样的环境变量清单**。`railway.json` 只有 build/deploy，`README:142` 只说「需要配置 DATABASE_URL、JWT_SECRET、NEXT_PUBLIC_BASE_URL」。**建议补一份 `.env.example`**（`.gitignore:52` 已经预留了 `!.env.example` 规则，但文件不存在——这是一个「准备了却没用上」的机制）。

### 3.2 【Netlify 特有】`publish = ".next"` 是冗余但无害的

`netlify.toml:3` 写 `publish = ".next"`。插件源码：`plugin-context.js:37-38` 的 `relPublishDir` 是 `constants.PUBLISH_DIR ?? join(PACKAGE_PATH, ".next")`，`DEFAULT_PUBLISH_DIR = ".next"`（`plugin-context.js:24`）。

**结论**：`.next` 正是默认值，显式声明与省略等价，**不是错误**。`verification.js:26-42` 的 `verifyPublishDir` 会在目录不存在或缺少 Next 产物时 `failBuild`，所以这一项是安全的。保留它作为自文档是可接受的；但要注意**不要改成 `out` 或 `.next/standalone`**——那会破坏插件。

### 3.3 【Netlify 特有】构建命令里的 `pnpm install` 是多余且危险的

`netlify.toml:2`：

```toml
command = "pnpm install --frozen-lockfile && pnpm run build"
```

**为什么是问题**

1. **Netlify 自己会先跑依赖安装**（依据 `packageManager` 字段 `pnpm@12.4.1` 与 lockfile 自动选择 pnpm）。命令里再 `pnpm install` 是第二次安装，浪费构建时间（对本项目 200KB lockfile + Next 16 依赖树，这不是小数）。
2. `[build.environment]` 里的 `PNPM_FLAGS = "--frozen-lockfile"`（`netlify.toml:7`）是**另一个**冗余：它与命令里的 `--frozen-lockfile` 重复，且该变量的语义在不同 Netlify 构建镜像版本间并不稳定，属于「看起来有用但实际不确定生效」的配置。
3. `NODE_VERSION = "22"` 与 `package.json:28` 的 `"node": ">=20"` 不一致（22 满足 >=20，但两个约束来源不同，未来升级时容易漏改一处）。

**修复方案**

```toml
[build]
  command = "pnpm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "22"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

并在 `package.json` 的 `engines.node` 收紧为 `">=20.9.0"`（Next 16.3.5 的实际下限，见 3.11），或统一到 `">=22"` 配合 `.nvmrc`，让约束收敛到一处。

### 3.4 【Railway 特有】`healthcheckPath: "/"` 应改为 `/api/health`

`railway.json:7-9`：

```json
"startCommand": "pnpm start",
"healthcheckPath": "/",
"healthcheckTimeout": 300
```

**核对结论（已从源码确认 `pnpm start` 是可用的）**：

- `scripts/dev.mjs:145-148` 确实 spawn 了 `next start`：`spawn(process.execPath, [nextBin, isStart ? "start" : "dev", ...passthrough], { env: { ...process.env, PORT: String(PORT) } })`；`PORT` 来自 `process.env.DEV_PORT || process.env.PORT || 3000`（`dev.mjs:11`）。所以 **Railway 注入的 `PORT` 会被正确透传**，`--start` 路径**没有 bug**。✅
- `dev.mjs:17` 的 `delete process.env.NODE_ENV` 也**不会**导致 `secure` cookie 失效或 JWT 密钥随机化——因为 `next/dist/bin/next:84` 的 `preAction` 钩子会把 `NODE_ENV` 设为 `production`（非 dev 命令的默认值），早于 `next.config.ts` 与 `env.ts` 的求值。✅ 这一条是我最初怀疑、经源码核对后**排除**的。

**仍存在的问题**：

1. `healthcheckPath: "/"` 会打首页。首页是 PPR 静态壳（`.next/server/app/index.html` 已生成，`prerender-manifest.routes` 含 `/`），**首屏不依赖数据库**；而项目**已经有专门的 `/api/health`**（`api/health/route.ts:7-23`，执行 `SELECT 1` 并在失败时返回 503）。
   → 改为 `"healthcheckPath": "/api/health"`。这是**真实漏洞**而非风格问题：DB 不可用时 Railway 仍会判定部署健康并放行坏版本。
2. `startCommand` 用 `pnpm start` → `node scripts/dev.mjs --start`。这个脚本会：
   - 在 Linux 上执行 `execSync(\`lsof -ti tcp:${port}\`)`（`dev.mjs:39`）——**Railway 镜像里可能没有 `lsof`**，异常被 `catch { return [] }` 吞掉（`dev.mjs:44-46`），于是「清理残留端口」退化成**静默 no-op**；
   - `killProjectDevServer()` 读 `.next/dev/lock`（`dev.mjs:79-94`）——生产环境不存在该文件，直接 return，无害；
   - `killPid` 在非 Windows 上直接 `SIGKILL`（`dev.mjs:71`）——若容器内恰好有别的进程占用 `PORT`，会被**误杀**；
   - 信号只转发一次且包装进程不自行退出（`dev.mjs:150-152`），滚动发布时的优雅停机依赖子进程自觉；PID 1 是包装进程而非 Next。
   - **`dev.mjs:17` 的 `delete process.env.NODE_ENV`**：虽然对 `env.isProd` 无害（`next/dist/bin/next:84` 的 `preAction` 会补 `production`，见下面的核对结论），但任何在钩子之前读取 `NODE_ENV` 的代码（`@next/env` 的 `.env` 选择逻辑、外层 APM/监控、其他脚本）会看到 `undefined`。
     → 结论：**能用，但为了生产引入一个「开发端口清理器」是过度设计**。建议 Railway 直接 `"startCommand": "next start"`；若采纳 3.5 的 `output: "standalone"`，则用 `node .next/standalone/server.js`（启动更快、内存更低）。
3. `healthcheckTimeout: 300`（5 分钟）过宽，会让「启动失败但进程存活」的坏部署拖满 5 分钟才回滚。建议 60s。

### 3.5 【双平台通用】`output` 未配置，两个平台的启动方式都不最优

`next.config.ts` 没有 `output` 字段。

- Netlify 靠 `NEXT_PRIVATE_STANDALONE=true` 隐式强制 standalone（3.1 根因 3），**能用，但这是一个依赖未文档化环境变量的隐式契约**。若插件的这个行为在未来版本改变，构建会以 `required-server-files.json not found` 失败（`dist/build/content/server.js:56-58`）。
- Railway 用 `next start`，**能用但不最优**。

**修复方案** 显式声明，让意图可见：

```ts
// next.config.ts
output: process.env.NETLIFY === "true" ? "standalone" : undefined,
```

或者干脆**两个平台都用 standalone**（`output: "standalone"`），Railway 改用 `node .next/standalone/server.js`。后者启动更快、内存占用更低，也让两个平台的产物形态一致——**推荐这个**，因为它顺带消除了 3.1 根因 3 的差异。

### 3.6 【双平台通用】构建期数据库访问与静默降级

**逐路由核对**（结合 `next build` 的实际产物 `.next/prerender-manifest.json`）：

| 路由                                                                                                      | 构建期是否访问数据库                      | 证据                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                                                                                       | 是                                        | `posts` 里 `initialRevalidateSeconds: 300`，`srcRoute: "/"`                                               |
| `/posts`                                                                                                  | 是（但 `searchParams` 为空，取第 1 页）   | `.next/server/app/posts.meta` 有 `x-nextjs-prerender: 1`                                                  |
| `/posts/[id]`                                                                                             | 是（`generateStaticParams`，最多 100 条） | `posts/placeholder` 被预渲染；`dynamicRoutes` 中 `/posts/[id]` 为 `PARTIALLY_STATIC`                      |
| `/sitemap.xml`                                                                                            | **否**（运行时动态）                      | `.next/server/app/sitemap.xml/` 下只有 `route.js`，**无 `.body`**；`prerender-manifest.routes` 不含该路由 |
| `/rss`                                                                                                    | **否**（运行时动态）                      | 同上。route handler 默认 dynamic（`dist/docs/.../route.md:669`）                                          |
| `/profile`、`/settings`、`/write`                                                                         | 是（`use cache` + viewer-blind 路径）     | 均在 `prerender-manifest.routes` 中                                                                       |
| `/login`、`/register`、`/robots.txt`、`/manifest.webmanifest`、`/icon.svg`、`/favicon.ico`、`/apple-icon` | 否                                        | 无数据依赖                                                                                                |

**两个真实风险**（注意：这两条是**运行时**风险，不是构建期风险——已核实 `/rss` 与 `/sitemap.xml` 都未被预渲染）：

1. **`sitemap.ts:12` 的 `listPostsCached({ page: 1, limit: SITEMAP_LIMIT })`，其中 `SITEMAP_LIMIT = 20000`**（`config/site.ts:16`）。这是**每次缓存未命中**都拉取最多 2 万篇文章（17 个列 + `tags` 数组）到内存。
   - 在 Netlify 上：结果要装进 per-instance LRU 的 **50MB** 上限（`use-cache-handler.js:1392-1404`），一个 2 万行的条目很容易把它挤爆，连带淘汰其它有用条目；
   - 在 Railway 上：`.next/cache` 里出现一个巨大文件；
   - 由于 `/sitemap.xml` 是**动态**路由，每次请求都要走一次函数（Netlify）或 Node 渲染（Railway），并有**响应体大小与函数超时**的双重风险；
   - `sitemap.ts:46,55` 还把结果展开成带 `?category=` / `?tag=` 的 URL，把搜索引擎引向需要函数渲染的动态地址。
     → **修复**：把 `SITEMAP_LIMIT` 降到博客量级的合理值（如 5000），或改用只 `SELECT id, updated_at` 的轻量查询；并**从 sitemap 移除** `?category=` / `?tag=`（没有独立规范 URL 的参数页不应进 sitemap，反而稀释权重）。
2. **`rss/route.ts:17` 用 `withDbRetry(...).catch(() => null)`**，把数据库故障降级成空 feed（HTTP 200 + 空 `<channel>`）。爬虫会把空 feed 当作「网站没内容」并可能降低抓取频率。应改为失败时返回 **503**，让爬虫重试。

**构建期数据库访问的部署要求**（真正在构建期访问数据库的是 `/`、`/posts`、`/posts/[id]`、`/profile`、`/settings`、`/write`）：

- Netlify：`DATABASE_URL` 必须同时存在于**构建环境变量**与**函数环境变量**（Netlify UI 里是分开的两组；如果只配运行时，构建期预渲染会静默降级为占位符，即 1.6 的问题）。
- Railway：构建与运行共享变量，但仍需确保构建时变量已注入（Railway 默认两者共享，但如果你用了 Build Args 或分开的 environment，要注意）。
- **`JWT_SECRET` 也必须在构建期存在**：`env.ts:23-30` 在模块顶层求值，`next build` 时 `NODE_ENV=production`（`next/dist/bin/next:65,84`）会关掉随机 fallback → 缺失即 `throw`，而**模块顶层的 throw 无法被 `try/catch` 兜住**。这是「本地构建成功、CI 失败」的第一成因（本地能过是因为 Next 自动加载了 `.env.local`，而它被 `.gitignore` 忽略、平台 clone 里没有）。

### 3.7 【双平台通用】日志、回滚、缓存产物

- **日志**：`common/logger.ts` 是自定义实现，输出到 stdout/stderr。Netlify 函数日志有保留期限制且按函数分组；Railway 有实时日志 + 有限历史。两者都**没有结构化字段查询能力**。若将来要排查线上问题，建议把 logger 改为输出**单行 JSON**（`{"level":"error","msg":...,"postId":...,"ts":...}`），两个平台都能按文本检索。
- **回滚**：Netlify 支持「Deploy 回滚」（原子切换）。Railway 支持「Redeploy 历史提交」但没有真正的原子回滚，且**数据库 schema 不回滚**——这正是 2.11 缺迁移机制的症结：应用可以回滚，schema 不能。**在没有迁移机制前，任何回滚都可能是「旧代码 + 新 schema」或反之，必然出错。** 这是 2.11 之外的回滚维度论据。
- **构建缓存**：`@netlify/plugin-nextjs` 会 `saveBuildCache` / `restoreBuildCache`（`dist/build/cache.js`），保存的是 `.next/cache`，**并在保存前删掉 `fetch-cache` 子目录**（`cache.js:13-14`）。Railway 没有等价机制，`.next/cache` 在每次部署后随新容器消失。→ **构建缓存命中率 Netlify 明显更好**，这是两个平台构建时间的差异来源之一。

### 3.8 【双平台通用】`ANALYZE` 环境变量污染构建

`next.config.ts:5-6`：

```ts
const withBundleAnalyzer = (config: NextConfig): NextConfig =>
  process.env.ANALYZE === "true" ? createBundleAnalyzer({ enabled: true })(config) : config;
```

而 `package.json:12` 的 `"analyze": "ANALYZE=true next build"` **是 POSIX 语法**，在 Windows 上（本机环境）直接失败。同时，`pnpm check`（`package.json:20`）不涉及它，但 `pnpm analyze` 在 CI 上才可用。

**修复方案**

- 跨平台：改用 `cross-env`，或改用 Next 支持的写法 `next build --experimental-analyze`（**待确认** Next 16 是否提供该 flag），或改为读一个 `.analyze` 文件的 presence。
- 风险提示：**绝对不要把 `ANALYZE` 配到 Netlify/Railway 的环境变量里**，否则每次构建都会跑 bundle analyzer，构建时间翻倍且输出噪音。

### 3.10 【严重缺陷·Netlify 特有】`next.config.ts` 的 `headers()` 不会覆盖 CDN 直出的静态资源

**问题描述**
Netlify 插件生成的服务函数声明了 `preferStatic: true`（`@netlify/plugin-nextjs/dist/build/templates/handler.tmpl.js:43-46`）：

```js
export const config = {
  path: "/*",
  preferStatic: true,
};
```

而 `public/*` 与 `.next/static/*` 被拷贝进 publish 目录、**由 Netlify CDN 直接返回**（`dist/build/content/static.js:56-76`，`publishStaticDir` 在 `:99-108` 换目录）。插件为静态资源**只加了一条** `Cache-Control`：

```js
// dist/build/content/static.js:81-83
values: { "Cache-Control": "public, max-age=31536000, immutable" }
```

**关键证据**：插件源码中**没有任何把 `routes-manifest` 的 `headers`/`redirects` 转成 Netlify 站点规则的逻辑**。唯一读取 `routes-manifest.json` 的地方是 `static.js:60`，且只取 `basePath`。`netlify.toml` 里也没有 `[[headers]]`。

**为什么是问题**

| 响应                                       | Netlify                                                                                                       | Railway（`next start`）                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/_next/static/*`、`public/og-default.png` | **由 CDN 直出，只带 `Cache-Control`，无 CSP / HSTS / X-Frame-Options / Permissions-Policy / Referrer-Policy** | 走 Next 路由，`resolve-routes.js` 会把 `headers()` 规则应用在文件系统命中结果上 → **全部安全头生效** |
| 函数渲染的页面                             | 安全头生效                                                                                                    | 安全头生效                                                                                           |

本机 `.next/routes-manifest.json` 已确认 Next 编译出了 `source: "/(.*)"` + 7 条安全头，以及 `/rss.xml → /rss` 的 307。两个平台读的是**同一份** manifest，差别在于**这些规则在哪一层被执行**：Railway 在 Node 进程内统一执行；Netlify 上 CDN 直出的部分**根本不经过 Next**。

净结果：**两个平台的响应头不一致**，且不一致的恰好是安全头。`og-default.png` 这类社交分享图缺 `X-Content-Type-Options: nosniff`、静态 JS/CSS 缺 CSP——虽然 CSP 对静态资源的实际防护价值有限，但**「以为配了全站安全头、实际只配了一半」**本身就是需要消除的认知偏差。

> **待实测**：Netlify 是否在其平台侧另行读取 `routes-manifest.json`（插件源码内无证据，但 Netlify 构建系统本身有可能）。验证：部署后 `curl -sI https://<domain>/og-default.png` 与 `curl -sI https://<domain>/_next/static/chunks/<任意>.js`，检查是否含 `Content-Security-Policy` / `Strict-Transport-Security`。

**修复方案**
把安全头**同时**写进 `netlify.toml`，覆盖 CDN 直出路径：

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-DNS-Prefetch-Control = "on"
    Strict-Transport-Security = "max-age=63072000"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
```

并注意 **`next.config.ts` 的 `headers()` 与 `netlify.toml` 的 `[[headers]]` 是两套独立来源，需要手动保持同步**——这是一个典型的分叉维护点。更彻底的方案是让两者都从 `src/config/csp.ts` 生成（`netlify.toml` 用构建时脚本写入），消除手抄漂移。

---

### 3.11 【严重缺陷·Railway 特有】Node 版本未固定，可能落到 Next 16 不支持的版本

**问题描述** `package.json:28` 是 `"node": ">=20"`，但实际安装的 `next@16.3.5` 要求 **`>=20.9.0`**（`node_modules/next/package.json` 的 `engines`，已核实）。

- Netlify：`netlify.toml:6` 写死 `NODE_VERSION = "22"` → 不会踩。
- Railway：`railway.json` **没有任何 Node 版本约束**，也没有 `.nvmrc`。Nixpacks 若解析出 `20.0`–`20.8`，Next 16.3.5 不可用。

**为什么是问题**
这是典型的「本机/Netlify 正常、Railway 构建失败或运行异常」的成因。`engines` 声明与实际需求不一致，说明约束来源有两个且未收敛。

**修复方案**

```jsonc
// package.json
"engines": { "node": ">=20.9.0" }
```

并新增 `.nvmrc`（内容 `22`）或在 Railway 设 `NIXPACKS_NODE_VERSION=22`，让三个来源（`engines` / `.nvmrc` / 平台变量）收敛到同一大版本。

---

### 3.12 【严重缺陷·双平台】`NEXT_PUBLIC_BASE_URL` 在当前 `.env.local` 里是**空值**

**问题描述** 字节级核对 `.env.local`（878 字节，仅输出键名与值长度，未打印任何值）：

```
DATABASE_URL            valuelen=149
JWT_SECRET              valuelen=32
JWT_EXPIRES_IN          valuelen=2
JWT_REFRESH_GRACE_SECONDS valuelen=4
BCRYPT_SALT_ROUNDS      valuelen=2
NEXT_PUBLIC_BASE_URL    valuelen=0      ← 键存在但值为空
```

`config/site.ts:1` 的 `process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"` 因此回退到 localhost。

**为什么是问题（两层）**

1. **本地构建产物会内联/回退成 localhost**。`node_modules/next/dist/lib/inline-static-env.js:24-74` 在构建**之后**扫描 `distDir/server/**`、`distDir/static/**` 与根清单，把 `process.env.NEXT_PUBLIC_*` 字面量替换成构建时的值，**且只在值非空时替换**（`:59`）。空值 → 不替换 → 回退到 `http://localhost:3000`。
2. **`NEXT_PUBLIC_*` 是构建期物理内联的，运行时改无效**。这意味着：
   - Netlify 每次部署都重建 → 改环境变量后生效，**看不出问题**；
   - Railway 若只在运行时改该变量 → **产物里仍是旧常量**，`sitemap.xml`、RSS 的 `<link>`、`canonical`、OG URL、`BreadcrumbList` 的 `item` 全部错。

   这就是「Netlify 上改了就生效、Railway 上改了不生效」的直接根因，属于 3.1 根因 6 的具体表现。

**修复方案**

- 修好本地 `.env.local` 的该行（填真实域名，带 `https://`、不带尾斜杠——`site.ts:1` 的 `.replace(/\/+$/,"")` 已处理尾斜杠但没有补协议）。
- 两个平台都必须把 `NEXT_PUBLIC_BASE_URL` 配在**构建环境变量**（Netlify 的站点环境变量、Railway 的服务变量在 build 期同样注入）。
- 若要运行时可配，就不能用 `NEXT_PUBLIC_*`：改为服务端读取（如 `SITE_URL` 只从非公开变量取），并用 `metadataBase` + 动态 `headers()` 生成绝对 URL。

---

### 3.13 【潜在风险·Netlify 特有】`/_next/image` 被改写到 Netlify Image CDN，Next 的图片配置在 Netlify 上整体失效

**问题描述** `@netlify/plugin-nextjs/dist/build/image-cdn.js:1774-1783` 把 `/_next/image?url=&w=&q=` 与 `/_ipx/*` 重写到 `/.netlify/images?...`；并在 `:1816-1858` 把 `remotePatterns` 转成 Netlify 的 `images.remote_images` 正则（`protocol=https` + `hostname` → `https://images.pexels.com/**`）。

**为什么是问题**
Netlify 上 **Next 自带的 image optimizer 根本不被调用**，因此：

- `next.config.ts:16` 的 `formats: ["image/avif","image/webp"]`、`:18` 的 `deviceSizes`、`minimumCacheTTL` **全部不生效**——格式协商与缓存策略由 Netlify Image CDN 决定；
- Railway 走 Next 优化器 + `sharp`（`next/dist/server/image-optimizer.js`），上述配置**全部生效**；
- 附带好处：Netlify 上不需要 `sharp` 即可出图；附带风险：请求的远程主机若不在 `remote_images` 正则内，Image CDN 直接拒绝。

**这直接解释了「同一段 `<Image>` 代码在两个平台产出不同 URL、不同格式、不同缓存头」**，也说明 1.14 的 `deviceSizes` 调整在 Netlify 上**是无效配置**。

**修复方案**

- 接受差异，但在 README 的部署章节明确写出「Netlify 上 `images.*` 配置不生效，格式与缓存由 Netlify Image CDN 决定」。
- 若确实需要两平台一致的图片行为，显式设 `images.loader` 指向自定义 loader，或对需要完全一致的图使用 `unoptimized`。
- 无论哪个平台，`remotePatterns` 都必须覆盖全部实际图床（见 1.15）。

---

### 3.14 【潜在风险·Netlify 特有】pnpm 未设 `public-hoist-pattern`，插件可能无法解析 `styled-jsx`

**问题描述** `@netlify/plugin-nextjs/dist/build/content/server.js:238-246` 在拷贝 standalone 后执行 `nextRequire.resolve("styled-jsx")`，失败即抛出明确针对 pnpm 用户的错误（`:244` 的错误文案直接引用了 Netlify 文档的 pnpm 支持链接，要求设置 `public-hoist-pattern[]=*`）。

**现状**：仓库**没有 `.npmrc`**（已确认不存在）；`pnpm-workspace.yaml` 只有 `allowBuilds`。

**为什么是问题**
这是插件自己写下的前置条件。pnpm 的默认隔离式 `node_modules` 结构不满足该 `resolve` 路径，pnpm 用户需要显式提升。**待实测**：Next 16.3.5 + pnpm 12.4.1 的产物是否真的触发。

**修复方案** 新增 `.npmrc`：

```ini
public-hoist-pattern[]=*
```

（或 `node-linker=hoisted`，但后者会改变本地 `node_modules` 形态，影响面更大，不推荐。）

---

### 3.15 【潜在风险·双平台】`pnpm-lock.yaml` 处于已修改但未提交状态

**问题描述** `git status` 显示 `M pnpm-lock.yaml`。同时 `netlify.toml:2` 有 `pnpm install --frozen-lockfile`、`:7` 有 `PNPM_FLAGS = "--frozen-lockfile"`。

**为什么是问题**
`--frozen-lockfile` 在 lockfile 与 `package.json` 记录不一致时**直接失败**（`ERR_PNPM_OUTDATED_LOCKFILE`），不会尝试修复。既然本地一次 `install` 就改动了 lockfile，说明 **HEAD 上的 lockfile 与当前 pnpm 版本/依赖图记录不一致** —— 这会让两个平台的构建在安装阶段就失败，且错误信息指向 lockfile 而非代码，排查成本高。

**修复方案**

1. 提交重新生成的 `pnpm-lock.yaml`（这是首要动作）。
2. `netlify.toml:2` 去掉重复的 `pnpm install --frozen-lockfile`（Netlify buildbot 自身有独立的依赖安装阶段；**该行为待实测**），只保留 `command = "pnpm run build"`，`PNPM_FLAGS` 可保留。
3. 若想彻底避免 pnpm 版本漂移，在 `package.json` 已有 `packageManager: "pnpm@12.4.1+sha512..."`（`:67`）——确保两个平台都尊重该字段。

---

### 3.16 【优化项·双平台】`.gitignore` 未忽略 `.pnpm-store/` 与 `debug.log`

`git status` 显示 `?? .pnpm-store/` 与 `?? debug.log`，而 `.gitignore` 无对应规则。

**修复方案** `.gitignore` 追加：

```
.pnpm-store/
*.log
debug.log
```

（注意 `.gitignore` 已有 `npm-debug.log*` 等具体日志名，但没有通用 `*.log`。）

---

### 3.17 【优化项·Railway 特有】图片优化与缓存都在单进程内，横向扩容会撕裂

**问题描述** Railway 上 `/_next/image` 由 `next start` 进程内处理（`next/dist/server/image-optimizer.js`，运行时 `require('sharp')`，缺失时报 `Module \`sharp\` not found`）；磁盘缓存目录随重新部署清空；`use cache`/`revalidatePath` 也都是进程内状态。

**为什么是问题**
一旦横向扩容到 2 个以上副本：

- `updateTag` / `revalidatePath` **只在命中的那个副本生效**；
- 同一 URL 在不同副本上可能返回新旧混合内容；
- 图片缓存不共享，每个副本各自转码。

Netlify 侧因为没有「多副本共享状态」的假设（缓存在 per-instance LRU + Blobs tag，`revalidatePath` 走插件的 blob 缓存），失效反而能跨 isolate 传播。**这是两个平台在「扩容后一致性」上的反向差异。**

**修复方案**

- 明确 Railway 侧**保持单副本**，并把这个约束写进部署文档（当前 `railway.json` 是单副本，只是没有显式记录这个依赖）。
- 若需要多副本，必须改用 `use cache: remote` + 外部共享缓存（Redis/KV），或 `cacheHandlers.default` 指向自定义 handler。

---

### 3.18 【优化项·双平台】`analyze` 脚本仅 POSIX 可用，且绝不能在平台开启

`package.json:12` `"analyze": "ANALYZE=true next build"` 在 Windows 上直接失败（本机环境）。

**修复方案** 改用 `cross-env`：`"analyze": "cross-env ANALYZE=true next build"`。并确保**平台环境变量里不出现 `ANALYZE`**——`next.config.ts:6` 一旦读到 `"true"` 就会启用 bundle analyzer 并起 HTTP 服务，构建可能挂到超时。

---

### 3.19 【潜在风险·双平台】`next/image` 的 hostname 校验只在开发环境生效，生产漏写 `unoptimized` 会静默 400

**问题描述** 已核对源码：

- `node_modules/next/dist/shared/lib/image-loader.js:62`：`if (process.env.NODE_ENV !== 'production') { ... }`
- `:96-104`：远程 hostname 的白名单校验（`hasRemoteMatch(config.domains, config.remotePatterns, parsedSrc)`）就**包在这个 dev-only 分支里**，不匹配才抛 `Invalid src prop ... hostname "..." is not configured`（E231）。
- `node_modules/next/dist/shared/lib/get-img-props.js:286` 同样是 `if (process.env.NODE_ENV !== 'production')`。

**为什么是问题**
开发/构建期**完全看不出问题**，生产才会由服务端优化器返回 400。两条平台链路还不一样：

- **Railway**：`next start` 的 `next/dist/server/image-optimizer.js` 在服务端校验 `remotePatterns`，不在白名单 → **400**，日志里只有一行 400，没有堆栈。
- **Netlify**：`/_next/image` 被改写到 Netlify Image CDN（见 3.13），拒绝的依据是 `remote_images` 正则（`image-cdn.js:1816-1858`），**行为可能又不一样**。

**当前状态是安全的**：4 处 `next/image` 用法都做了守卫（`posts/[id]/page.tsx:205`、`PostCard.tsx:42`、`Avatar.tsx:22`、`CoverField.tsx:89`，依据 `lib/url.ts:20-27` 只放行本地路径与 `images.pexels.com`）。**这是一个「靠 4 处人工纪律维持」的状态**——新组件漏写一次就会中招，且本地测不出来。

**修复方案**
把 `next/image` 收进**唯一封装组件**（例如 `components/ui/SmartImage.tsx`），在里面统一做 `isOptimizableImageSrc` 判定并自动设置 `unoptimized`，然后在 `eslint.config.mjs` 里禁止直接 `import Image from "next/image"`。这样守卫从「4 处约定」变成「1 处强制 + lint 拦截」。这一条与 1.15 是同一个问题的两个面。

---

### 3.20 【待实测·双平台】首页静态壳里既无「加载失败」也无「近期文章」

本机 `.next/server/app/index.html` 中既没有文章加载失败的 UI，也没有近期文章列表。两种可能：

1. 构建期数据库查询成功但返回 0 篇（`hasPosts === false`，`(home)/page.tsx:120` 的分支）→ 正常；
2. 该段被降级成了动态空洞（PPR 的 `postponed` 段）→ 也正常，但意味着构建期没拿到数据。

`posts.meta` 里有明确的 `postponed` 段，`index.meta` 需单独确认。建议做一次干净的 `next build` 并观察日志，确认构建期是否真的连上了数据库。**这一点与 1.6（`generateStaticParams` 静默降级）是同一类可观测性问题的不同表现。**

---

## 4. 架构 & 代码冗余 / 过度设计专项

判断尺度：**当前业务体量 = 单作者中文博客，`src/**` 实测 198 文件 / 11,907 行 TS/TSX，5 张表 / 43 列 / 10 个索引，4 个 API Route + 约 15 个 Server Action，峰值可预期为个位数 QPS。**

### 4.1 【过度设计·冗余】8 层纵切架构对单作者博客收益为负

**现状**（`README:42-63` 有完整自述）：一次「创建文章」的请求要穿过

```
WriteEditor.tsx → usePosts.ts(useCreatePost) → useAsyncAction.ts
  → post.controller.ts(createPostAction)
    → common/action-result.ts(runAction/ensureNotRateLimited)
    → auth.guard.ts(requireAuthPayload)
    → post.validator.ts(parseCreatePostBody)
    → post.service.ts(createPost)
      → user.service.ts(getUserById → getUserDisplayName)
      → post.repository.ts(insertPostStmt)
      → common/db.ts(atomicBatch)
      → common/policy.ts(PAGE_LIMITS)
    → post.cache.ts(invalidatePostsCache / revalidatePostListPaths)
```

**共 13 个模块、8 个概念层**。

**为什么是问题**

- **收益**：分层唯一实质收益是「唯一碰 Drizzle 的层是 repository」（`README:51`）。这个收益是真实的——它让 SQL 集中、便于审查。
- **成本**：
  1. `user.service.ts` **54 行里有 14 个函数是纯转发**（`getUserById` → `findUserById`、`getUserByEmail` → `findUserByEmail`、`createUser` → `createUserRecord`、`updateUser` → `updateUserRecord`、`invalidateUserSessions` → `incrementTokenVersion`、`getUserPostState` → `findUserPostState`、`getUserWithPostAssociations` → `findUserWithPostAssociations`）。**这个文件对外零业务逻辑。**（`README:32` 甚至承认「只有 repository + service：无面向客户端的动作，也无自有缓存」。）
  2. `post.service.ts:53` 与 `412` 行：`export { updatePostsAuthorName } from "./post.repository"`、`export { incrementPostCounterStmt }`——**纯 re-export**，README:152 自述「是为满足 R1/R2 的跨域 facade，删掉会断依赖」。也就是说**分层规则本身制造了这些转发**。
  3. `post.cache.ts:26` `export { listPostsByAuthor } from "./post.service"` 同理。
  4. 一次读请求 `validate → service → repository` 三层里，有 2 层的函数体是 `return someOtherFn(args)`。
- **对单作者博客的量化**：这套分层为「多人协作、域边界会独立演进」的场景设计。当前 `post` / `comment` / `user` / `auth` 四个域**从不独立部署、不独立演进、没有独立团队**。每一层增加的是**改一个字段要动 4 个文件**的维护成本。

**简化方案**（保留最有价值的那条规则）

```
src/server/
├── db/
│   ├── schema.ts          # 保留
│   └── queries/           # ← 唯一碰 Drizzle 的地方（原 repository 层，保留！）
│       ├── post.ts
│       ├── comment.ts
│       └── user.ts
├── auth.ts                # guard + cookie + service 合并（现在 5 个文件 → 2 个）
├── posts.ts               # service + controller 合并（现在 5 个文件 → 1 个）
├── comments.ts
├── users.ts
└── common/                # db.ts / errors.ts / cache.ts / rate-limit.ts / logger.ts 保留
```

- **保留**：`queries/` 作为唯一 Drizzle 边界（这条规则有价值，且 ESLint 已在强制 `README:59`）。
- **合并**：`*.service.ts` + `*.controller.ts` → 单文件（Server Action 与内部函数同处一处，`"use server"` 只标导出函数）。省掉 4 个文件与 3 层转发。
- **删除**：`user.service.ts` 全部转发，调用方直接 import `queries/user.ts`。
- **删除**：`post.cache.ts` / `comment.cache.ts` 的 re-export。
- **预估**：服务端从约 1,900 行降到约 1,300 行，文件数从 26 降到 12。

### 4.2 【过度设计·冗余】`validation-loader.ts` 是为不存在的包体积问题做的优化

**现状** `lib/validation-loader.ts`（31 行）用 `createLoader` 对 `@/shared/validation/auth` 与 `@/shared/validation/post` 做动态 import；4 处使用（`LoginForm.tsx:27`、`RegisterForm.tsx:27`、`SettingsForm.tsx:32`、`WriteEditor.tsx:29`），并在输入框 `onFocus` 里预热（`LoginForm.tsx:133` 等）。

**为什么是问题**

1. 被延迟的三个 zod/mini schema（`loginSchema`、`registerSchema`、`changePasswordSchema`、`updateProfileSchema`、`postCreateSchema`）**总共不到 6 KB 源码**。zod/mini 本身是 tree-shakeable 的，打包后这部分增量可以忽略。
2. 它**不会减少请求数**：`WriteEditor` 页面本来就要加载 schema 做实时校验。真正的效果是把一次静态 import 换成一次运行时的动态 `import()` 往返——**在 Netlify 函数模型下，这个动态 chunk 也要经过 CDN 拉取**。
3. 它引入了一个**纯为优化而存在的间接层**：调用方必须知道「先用 peek 画界面、await load 才校验」这个协议，`LoginForm.tsx:77` 与 `RegisterForm.tsx:60,103` 都在重复这个仪式。
4. `onFocus` 预热（4 处）是**用副作用掩盖延迟**——如果延迟不重要，就不需要预热；如果重要，说明用户在同一次交互里被加了延迟。

**简化方案** 删除 `validation-loader.ts`，4 处改回静态 import：

```ts
import { loginSchema } from "@/shared/validation/auth";
```

如果投入产出比是关切的，正确的做法是**在构建产物层面验证**（`pnpm analyze`），用数据说明这 6 KB 是否值得。当前没有这个数据支撑。

### 4.3 【过度设计·冗余】13 个骨架组件（924 行）+ 8 个 `loading.tsx` 是两套机制做同一件事

**实测计数**：`src/components/skeletons/` = **13 个文件 / 924 行**（其中 `primitives.ts` 只有 7 行 / 4 个常量）；`src/app/**/loading.tsx` = **8 个文件 / 约 40 行**。参考基线：`src/**` 共 198 文件 / 11,907 行 —— 即**骨架占全项目约 7.8% 的代码量**。

**现状**

- `src/components/skeletons/` 下 **13 个文件 / 924 行**：`HomeSkeleton`(156)、`WriteSkeleton`(164)、`ProfileSkeleton`(148)、`PostDetailSkeleton`(106)、`PostsBodySkeleton`(103)、`SettingsSkeleton`(97)、`RegisterSkeleton`(75)、`LoginSkeleton`(63)、`PostSidebarSkeleton`(47)、`PostsListSkeleton`(29)、`DashboardSkeleton`(29)、`CommentsSkeleton`、`primitives.ts`(7)；
- `src/app/**/loading.tsx` 另有 **8 个**（`(auth)/login`、`(auth)/register`、`(dashboard)/profile|settings|write`、`(home)`、`posts`、`posts/[id]`），每个约 5 行、**纯转发**到一个 Skeleton 组件。

**为什么是问题**

1. `loading.tsx` 是 Next 的约定（自动包 Suspense），骨架是组件——**方向是对的（内容是组件、挂载靠约定）**。但 **13 个骨架里绝大多数是同一个「若干条灰块」**，差异只在行数。
2. `primitives.ts` 只有 7 行，说明**基础原语几乎没有被复用**：`HomeSkeleton.tsx:4-29` 有 8 个局部像素常量，`ProfileSkeleton.tsx:4-20` 有 9 个。内部重复已经出现：`SettingsSkeleton.tsx:8-32`、`WriteSkeleton.tsx:58-86`、`LoginSkeleton.tsx:5-17`、`RegisterSkeleton.tsx:7-27` 的 `Field` 是**同一个组件的 4 份实现**；`PostsBodySkeleton.tsx:12-69` 与 `ProfileSkeleton.tsx:31-61` 的 `CardSkeleton` 是同一张卡片的 2 份实现。
3. 骨架位于首屏关键路径，13 个组件的解析成本叠加在 LCP 上。
4. `CommentsSkeleton` 在 `DeferredComments` 里用于 `ssr:false` 的 `loading`（`DeferredPostWidgets.tsx:13`），同时 `CommentsPreview` 在数据为空时**也**返回 `<CommentsSkeleton />`（`:21`），`CommentsSection` 内部又用 `CommentCardSkeleton`（`CommentsSection.tsx:267`）——**同一个组件在同一屏承担两种语义**。
5. Next 16 的官方指引（`node_modules/next/dist/docs` 的 `loading.md:88-93`）在启用 Cache Components 时建议把 Suspense 放在**数据读取点**（"move uncached data fetching from layout.js into page.js, or wrap the runtime data access in your layout in its own `<Suspense>` boundary"），而不是每个路由段放一个 `loading.tsx`。

**简化方案** 收敛为 3 个参数化原语：

```tsx
// components/skeletons/Skeleton.tsx
export function SkeletonBar({ w }: { w?: string }) { ... }          // 原语
export function SkeletonField({ label = true }: { label?: boolean }) // 替 4 份 Field
export function SkeletonCard({ variant = "vertical" | "horizontal" }) // 替 2 份 CardSkeleton
export function SkeletonList({ rows = 3, variant }: { ... }) { ... }
```

- 各页面的骨架改为**就地声明**在 `page.tsx` 的 `<Suspense fallback={...}>` 里，删除 8 个纯转发的 `loading.tsx` 与约 10 个骨架文件。
- **预估**：924 + 40 → **约 300 行**，净减约 **660 行**，文件数 −18。
- **注意**：唯一需要单独处理的是一直被点名的 `HomeSkeleton.tsx`（156 行，含 8 个局部常量）与 `WriteSkeleton.tsx`（164 行）——这两个体量最大，可以保留为独立文件但内部改为复用 3 个原语。

### 4.4 【结论：保留，不整改】14 个 `texts/` 模块——判定为**合理抽象**

> **本节是修正版。** 初版把 `texts/` 判为「多语言移除后只剩间址」的过度设计并建议内联。经实际统计引用量后，**该建议错误**——内联是净亏。保留结论，但把它从「过度设计」清单移出。

**现状** `src/texts/` 下 14 个模块，共 371 行。

**证据链（量化）**：

- `git log` 显示 commit `c2712c7`「移除多语言支持」、`c699699`「重构文本导入结构，拆分 texts 模块」——拆分确实发生在移除多语言之后，**动机可疑**。
- 但实际统计后，**14 个文件全部被引用**，按模块计 import 语句数：`feedback` 11、`common` 10、`meta` 8、`format` 8、`nav` 7、`write` 6、`errors` 5、`post-detail` 5、`auth` 4、`profile` 4、`post-list` 3、`home` 2、`settings` 2、`footer` 1 —— **合计 67 条 import 语句**。
- **跨端复用**：同一批字符串同时被 Server Component（`layout.tsx:8-9`、`posts/page.tsx:13-16`、`rss/route.ts:6`、`manifest.ts:2`）与 Client Component（`shell/UserMenu.tsx:6`、`shell/MobileMenu.tsx:8`、`post/CommentsSection.tsx:6-9` 等）消费。内联后 `meta.siteTitle` 会在 `layout.tsx` / `manifest.ts` / `global-error.tsx` 等 **6 处**重复。
- **有真实的参数化需求**：`texts/format.ts:5-10` 的 `formatTemplate` 被 **15 处**调用（`{count}` / `{field}` / `{minutes}` / `{status}` 占位符）。
- **净账**：内联需要改约 60 个文件的 import 与约 370 处引用点（约 370 行改动）来删除 371 行 → **净亏约 370 行**，且失去单点维护与跨端一致性。

**判定：保留。** 它确实**不是** i18n 抽象（无 locale 表、无 `t()`、无运行期切换，`texts/auth.ts:1` 就是 `const auth = { loginTitle: "欢迎回来", ... }` 的直接属性访问），因此**它不该被当作 i18n 层来评价**——按「集中存放的字符串常量表」评价时，它是划算的。

**唯一建议（小改动）**：`texts/` 内部存在少量**同义文案的多份副本**，这才是真冗余（见 4.7 的图片 URL 文案，同一句在 4 个文件里各存一份）。合并这些，不要动整体结构。

**同理修正**：本节初版还建议删除 `formatTemplate` 改用模板字符串。鉴于它被 15 处调用且承担了跨端格式化的一致性，**该建议同样撤回**。

---

### 4.5 【潜在风险 + 过度设计·冗余】`shared/markdown.ts` 的双渲染器实现，且**客户端那份没有 XSS 净化**

**现状** `shared/markdown.ts` 里有两套 Markdown 渲染器：

1. `getMarkdownRenderer()`（行 172-233）：动态 import `marked` + `highlight.js/lib/core` + **8 个语言**（js/ts/xml/css/json/bash/python/sql），`new marked.Renderer()`，模块级 promise 缓存。**客户端**使用（`MarkdownPane.tsx:6,47`，写作页的实时预览）。
2. `post.render.ts` 自己的实例（行 60-67）：`new Marked(markedHighlight({...}))` + **14 个语言**（js/ts/python/bash/json/xml/css/sql/go/rust/java/yaml/markdown/shell），服务端使用，并且**带 `sanitize-html` 白名单清洗**（`post.render.ts:148`）。

#### 4.5.1 【潜在风险】客户端预览路径 `marked` 输出未经净化就 `dangerouslySetInnerHTML`

**证据**（已逐行核对）：

- `MarkdownPane.tsx:47-49`：`getMarkdownRenderer().then((render) => render(content)).then((html) => setPreviewHtml(html))`；
- `shared/markdown.ts:228-230`：该渲染器就是 `marked.parse(content, { async: false })`，**没有任何 sanitize**；
- `MarkdownPane.tsx:132` 与 `:141`：两处 `dangerouslySetInnerHTML={{ __html: previewHtml || emptyPreviewHtml }}`；
- 兜底分支 `MarkdownPane.tsx:51` 的 `.catch(() => setPreviewHtml(content))` **把原始 Markdown 文本直接灌进 `dangerouslySetInnerHTML`**——这条路径连 marked 都不经过，`<img src=x onerror=...>` 会被浏览器直接解析执行。

对比：服务端 `post.render.ts:148` 的 `sanitizeHtml(rawHtml, SANITIZE_OPTIONS)` 是完整白名单清洗，**公开文章页是安全的**。

**影响范围（为什么是「潜在风险」而非「严重缺陷」）**：

- 该预览**只出现在 `/write` 写作后台**，且内容来源是**登录作者自己的输入**（`WriteEditor` 的 textarea）。所以这是**self-XSS**，不是存储型 XSS——攻击者无法通过它攻击其他读者。
- 但真实危害仍然存在：(a) 作者从不可信来源（别人发的 Markdown、网页复制粘贴、AI 生成内容）粘贴文本做预览时，会在自己的**已登录会话**里执行任意脚本（该会话可调用所有 Server Action）；(b) 只要未来把预览能力暴露给非作者（如「协作编辑」「草稿分享预览」），它立即升级为存储型 XSS。

**修复方案（推荐，一举解决 4.5 的两个问题）**
不要修客户端渲染器，而是**删掉它**，让预览走服务端同一个已净化的渲染器：

```ts
// server/post/post.preview.ts
"use server";
import { renderPostBody } from "./post.render";
export async function renderPreviewAction(markdown: string): Promise<string> {
  const viewer = await requireAuthPayload(); // 只有登录作者可用
  return renderPostBody(markdown.slice(0, 200_000)); // 复用同一份 sanitize 白名单
}
```

- 客户端 `MarkdownPane` 改为调用该 Server Action（debounce 500ms 已存在，`MarkdownPane.tsx:10`）。
- **顺带收益**：语言表从两份收敛为一份（消除 4.5.2）；客户端不再打包 `marked` + `highlight.js`（省约 120 KB 未压缩 / 约 77 KB + 42.7 KB）；预览与发布渲染**必然一致**。
- 代价：预览需要一次网络往返。对 500ms 防抖的预览来说，Netlify 上可能引入可感知延迟。**若延迟不可接受**，退而求其次的最小修法是给预览单独接一个 `sanitize-html`（`sanitizeHtml(html, SANITIZE_OPTIONS)`，复用 `post.render.ts` 已导出的配置），并**修掉 `:51` 的兜底分支**（改为 `setPreviewHtml("")` 而不是灌原文）。

#### 4.5.2 【过度设计·冗余】两个渲染器的输出不一致

**为什么是问题**

1. **语言白名单不同**（8 vs 14），**高亮插件不同**（`marked-highlight` vs 手写 `renderer.code`），`renderer.code` 的 HTML 结构也不同：
   - `markdown.ts:218`：`<pre><code class="hljs language-${lang || "plaintext"}">`
   - `post.render.ts` 走 `markedHighlight({ langPrefix: "hljs language-" })`，输出结构由该插件决定。
     → **作者在写作页看到的预览，与发布后渲染出的 HTML 可能不同。** 对写代码类文章的博客，这是核心体验问题。
2. `getMarkdownRenderer` 用的是**共享的 marked 单例**（`markdown.ts:224` `marked.setOptions` / `marked.use`），而 `post.render.ts` 用的是独立 `new Marked()`。前者依赖模块级单例状态，后者干净。
3. `registerHighlightLanguages`（`markdown.ts:156-166`）通过 `HIGHLIGHT_ALIASES` 注册别名，服务端与客户端都会调用它，但传入的 `modules` 集合不同——**同一个函数在两处语义不同**。

**实测体量**：客户端 chunk 中 `03-0ut1dz87xe.js` 32.8 KB、`188954s944z0q.js` 19.6 KB、`30ye4ut98elc_.js` 24.8 KB 含 hljs 特征（合计约 77 KB），`15f52xgkl0fxv.js` 42.7 KB 含 marked。这些是 `WriteEditor` 的懒加载 chunk（`getMarkdownRenderer` 是动态 import），所以**不阻塞公开页面首屏**。这一点做对了。

**修复方案** 见 4.5.1 的推荐方案（删客户端渲染器）。若因延迟原因必须保留双渲染器，则**至少让语言表成为单一来源**（两处 import 同一个 `HIGHLIGHT_LANGUAGES` 常量），并给客户端预览补上 sanitize。

### 4.6 【过度设计·冗余】`src/app/template.tsx` 是空壳

**现状** `template.tsx` 全文 3 行：

```tsx
export default function Template({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

**为什么是问题**
`template.tsx` 在 App Router 里意味着「每次导航都重新挂载子树」（与 `layout.tsx` 的状态保留语义相反）。这里包了一个**无任何 className、无任何逻辑的 `<div>`**，于是付出了：

1. 每次客户端导航多一层 DOM 节点；
2. **放弃了 `cacheComponents` 本该带来的状态保留**。`dist/docs/.../cacheComponents.md` 明确说明：启用 `cacheComponents` 时 Next 用 React `<Activity>` 保留路由状态——「导航离开时不卸载，而是把 Activity 设为 hidden，**组件状态被保留，返回时状态完好**」。而 `template.tsx` 会在每次导航时重新创建子树，**恰好抵消了这个特性**。

**简化方案** 删除该文件。这是一个纯负收益的文件。

### 4.7 【过度设计·冗余】`markdown.ts` 中未被使用的 `_role` 解构技巧

**现状** `AuthProvider.tsx:28-31`：

```ts
const { role: _role, ...cacheable } = user;
void _role;
```

为了满足 `noUnusedLocals`（`tsconfig.json:28`）而写 `void _role`。

**为什么是问题** 这是为一个「本来就不该存在」的设计付的税：`role` 是**恒为 `"Writer"` 的常量**（`schema.ts:29` 默认值、`auth.service.ts:62` 硬编码 `role: "Writer"`、`AuthProvider.tsx:10` `PLACEHOLDER_ROLE = "Writer"`、`auth.service.ts` 的 `toSafeUser` 也没有移除它）。为了「将来可能有角色分级」这个不存在的需求，代码在四处维护一个常量，并因此产生了：

- 一个必须剥离再回填的字段（`AuthProvider.tsx:14-24,28-31`）；
- 一个 `void _role` 的 hack；
- `CachedUser = Omit<User, "role">` 与 `User` 两个类型。

**修复方案** 删除 `role` 字段（数据库列、类型、`PLACEHOLDER_ROLE`、缓存剥离逻辑）。若将来真需要 RBAC，那时再加——加的成本不会比现在留着更低。预估删除约 25 行，并消除一个类型分叉。

### 4.8 【过度设计·冗余】`scripts/strip-comments.mjs` + `comment-template/` 自定义工具链

**现状** `package.json:21-22` 有 `strip-comments` / `strip-comments:check`；`comment-template/ts.md`、`tsx.md` 是被 `.prettierignore` 排除的模板；git log 有 commit `1f8e221`「移除所有冗余的文件注释和文档块」、`b8326f3`「补齐 prettier 格式（剥注释遗留空行与 class 排序）」、`b8326f3` 提到「剥注释遗留空行」。

**为什么是问题**

1. 这是一个**自制的、要维护的代码改写工具**。它已经产生了需要额外 commit 修复的副作用（「剥注释遗留空行」、格式回归）。这类工具的风险是：它理解不了 TS 语法，只能做模式匹配，遇到 `//` 出现在字符串/正则/URL 里就会误伤。
2. `comment-template/` 目录与构建完全无关（`README:39` 自述「不参与构建，仅被 .prettierignore 排除」）——**一个只为了让另一个自制工具工作的配置文件**。
3. 项目同时有 `docs/` 缺失、`README` 承载架构文档的情况。**注释被系统性移除，架构知识就只剩 README 一份**，而 README 会漂移（`README:146-152` 的「已知限制」已经与代码出现了部分不同步，例如它说「`updatePostAction`/`deletePostAction` 未接限流」，这点是准确的，但它没说 1.1 那个 token 伪造）。
4. `eslint.config.mjs` 已有 5914 字节的规则，其中 `no-restricted-imports` 体系（`README:59-63`）是有价值的。**如果团队真的在意代码整洁，应该把力气花在 lint 规则上，而不是自制注释剥离器。**

**修复方案**

- **删除** `scripts/strip-comments.mjs`、`comment-template/`、`package.json` 的两个对应脚本、`.prettierignore` 里的相关条目。
- 如果目标是「不留无意义注释」，写成一条 ESLint 规则或干脆靠 code review。
- 删掉后**把关键注释加回来**——尤其是 `post.render.ts` 的 sanitize 白名单理由、`common/db.ts` 的 batch 事务语义、`proxy.ts` 的 Edge 约束（3.1 根因 2）。当前这些关键约束只存在于本报告里。

### 4.9 【过度设计·冗余】`common/policy.ts` 是纯粹为间接而生的常量文件

**现状** 75 行，只有两个对象：`RATE_LIMITS`（11 条策略）和 `PAGE_LIMITS`（5 个常量）。

**为什么是问题**

- 它的存在价值是「集中阈值」。但 `PAGE_LIMITS` 与 `config/site.ts` 的 `PAGE_SIZE`/`HOME_PAGE_SIZE`/`COMMENT_PAGE_SIZE`（`config/site.ts:8-12`）**职责重叠**。`README:151` 已经自曝：「分页常量有两处同名不同源的值：`config/site.ts` 的 `COMMENT_PAGE_SIZE` 与 `common/policy.ts` 的 `PAGE_LIMITS.commentListDefaultLimit`，改一处忘另一处会导致分页错位。」
- 这是**分层规则制造的重复**：`config/site.ts` 在客户端可 import，`common/policy.ts` 是 `server-only`（`policy.ts:1`）。同一个分页尺寸被拆到两个文件，只因为「一个要能在客户端用，一个是服务端策略」。

**修复方案** 合并为 `src/shared/limits.ts`（无 `server-only`），服务端与客户端共用：

```ts
export const PAGE_SIZE = 9;
export const HOME_PAGE_SIZE = 6;
export const COMMENT_PAGE_SIZE = 10;
export const COMMENT_LIST_MAX_LIMIT = 50;
export const POST_LIST_MAX_LIMIT = 100; // 20000 明显过大（见 2.9）
export const POST_TAG_MAX_COUNT = 20;
export const RATE_LIMITS = {/* ... */} as const;
```

并在 `eslint.config.mjs` 里加一条禁止 `config/site.ts` 与 `shared/limits.ts` 出现同名常量（或用 `import/no-duplicates` 类似思路）。**删掉 `policy.ts` 与 `config/site.ts` 的分页部分，合并到一处。**

同时注意 `PAGE_LIMITS.postListMaxLimit = 20_000`（`policy.ts:68`）——这是 `sitemap.ts` 的 20000 来源，与 3.6 的问题同源。客户端可以请求 `?limit=20000` 的列表（`parseNonNegativeInt` 在 `api/posts/[id]/comments/route.ts:15-16` 里用过，而 `listPosts` 的 `limit` 经过 `Math.min(PAGE_LIMITS.postListMaxLimit, ...)`，`post.service.ts:148-151`）——**这允许一个匿名请求触发拉取 2 万篇文章**。**这是一个未被 README 记录的 DoS 面**，建议降到 100。

### 4.10 【过度设计·冗余】`types/` 的类型分叉

**现状** `src/shared/types/` 下 11 个文件。已发现的重复/分叉：

- `Post`（`types/post.ts:1-39`）同时承载列表项与详情（`content` 必填但列表页填空串，见 2.4）。
- `PostsListData`（`types/post.ts:81-91`）与 `CommentsListData`（`types/comment.ts`）结构几乎相同（`items/total/page/limit/totalPages` vs `comments/total/hasMore`）——**分页信封没有统一**，`PostsListData` 用 `page/limit/totalPages`，`CommentsListData` 用 `hasMore`，两套分页协议并存。
- `types/action.ts` 的 `ActionResult<T>` 与 `lib/api-request.ts` 的 `ApiResponse<T>` 是**两套响应信封**（`{ok, data, status, message}` vs `{code, data, message}`），`unwrap`（`api-request.ts:178-181`）专门做转换。
- `ChangePasswordField`（`validation/auth.ts:85`）包含 `"confirmPassword"`，但 `changePasswordFieldsSchema`（行 47-51）**没有 `confirmPassword` 字段**——**类型声明了 schema 里不存在的字段**。

**修复方案**

- 统一分页信封：`interface Page<T> { items: T[]; total: number; hasMore: boolean; }`，`PostsListData = Page<Post>`，`CommentsListData = Page<Comment>`，并让 `listPosts` 也返回 `hasMore`（用 `limit + 1` 探测，与 `listComments` 一致）——**顺带解决 2.10 的精确 count 开销**。
- 统一响应信封：Server Action 直接返回 `{code, data, message}`（与 API Route 一致），删掉 `ActionResult` + `unwrap` + `actionFailure` 这一整套转换。
- 修掉 `ChangePasswordField` 的 `confirmPassword`（schema 里加字段，或从类型里删掉）。

### 4.11 【过度设计·冗余】依赖评估

逐个核对 `package.json:30-66`：

| 依赖                                                             | 实际用量                                                     | 评估                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next` / `react` / `react-dom`                                   | 核心                                                         | ✅ 必需                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `@neondatabase/serverless` + `drizzle-orm`                       | 核心                                                         | ✅ 必需。相比 Prisma 显著更轻，`db:push` 迁移到 Drizzle（commit `b36b75d`）是正确的方向                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `bcryptjs`                                                       | 3 处（`password.ts`、`auth.service.ts`）                     | ✅ 必需。**注意 `bcryptjs` 是纯 JS 实现，比原生 `bcrypt` 慢 2-3 倍**。在 Netlify 函数上，`BCRYPT_SALT_ROUNDS=10` 的每次登录/注册会消耗约 200-400ms CPU（纯 JS）而非常见的 60-100ms。**这是一个 Netlify 函数超时风险点**，建议实测单次登录的 P95，若超过 1s 应考虑 `@node-rs/bcrypt`（Rust 实现）或降低 rounds。                                                                                                                                                                                                                                                                       |
| `jsonwebtoken` + `@types/jsonwebtoken`                           | `token.ts` 3 个函数                                          | ⚠️ **初版建议替换为 `jose`，该建议已撤回。** 初版理由是「不能在 Edge runtime 使用」，但 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:255` 明确：**「Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files.」**（版本表 `:806` 亦确认 v16.0.0 起 Proxy 默认 Node runtime）。既然 Node 是唯一可能的 runtime，`jsonwebtoken` 完全可用，换成 `jose` 只剩「少 4 个传递依赖」这一点收益，**不足以驱动一次有风险的认证代码重写**。→ **保留 `jsonwebtoken`**，只按 1.2b 把 `decodeToken` 的用法改掉。 |
| `marked` + `marked-highlight` + `highlight.js` + `sanitize-html` | `post.render.ts` + `shared/markdown.ts`                      | ⚠️ 四个库做一件事。见 4.5：统一为一个渲染器，并考虑「写入时渲染」以把 highlight.js 从服务端冷启动路径移除。`sanitize-html` 带 4 个传递依赖（`htmlparser2` 等），是白名单清洗的合理选择（**不要**为省体积换成 `DOMPurify` + jsdom，那样更重）。                                                                                                                                                                                                                                                                                                                                        |
| `lucide-react`                                                   | 26 个组件，每个 1-5 个图标                                   | ⚠️ **需核实 tree-shaking**。已测 `.next/static/chunks` 有 `0cz1d0mv5g_q7.js` 110 KB 与 `2xueejv2i9szu.js` 359.4 KB。lucide-react 是 ESM + 具名导出，Turbopack 应能 tree-shake，但**当前没有 `analyze` 的实测数据**（见 3.8：`pnpm analyze` 在 Windows 上不可用）。**建议先在能跑 `analyze` 的环境出一次报告**，确认这 359 KB 里 lucide 占多少。若占比高，改用 `lucide-static`（纯 SVG）或按需 import 具体图标路径。                                                                                                                                                                   |
| `next-themes`                                                    | `Providers.tsx`                                              | ✅ 合理。但注意 `layout.tsx:60` 已有手写 `THEME_INIT_SCRIPT`（`error-page-shell.ts:35`）——**闪烁防护做了两遍**（next-themes 自带 + 手写脚本），需确认两者不冲突（同一个 `localStorage.theme` key，`error-page-shell.ts:35` 读 `"theme"`，next-themes 默认也是 `"theme"`，所以兼容，但属于重复机制）。                                                                                                                                                                                                                                                                                 |
| `sonner`                                                         | `ui/Sonner.tsx` + `lib/toast.ts`                             | ✅ 合理，体积可控（约 15 KB）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `server-only`                                                    | 30+ 文件的 `import "server-only"`                            | ✅ 零成本，价值高（编译期阻止服务端代码进客户端 bundle），**保留并继续使用**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `zod`（`zod/mini` 子路径）                                       | 全部校验                                                     | ✅ **选择正确**。`zod/mini` 比完整 zod 小得多，`eslint.config.mjs` 强制只允许 `zod/mini`（`README:15`）——这是一个高质量的工程约束。                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `@next/bundle-analyzer`                                          | `next.config.ts:2`                                           | ⚠️ devDependency 但被生产构建的配置文件 import。见 3.8：`ANALYZE` 必须只在本地设置。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@netlify/plugin-nextjs`                                         | `netlify.toml:10`                                            | ✅ 必需                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `drizzle-kit`                                                    | 脚本                                                         | ✅ 必需                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `dotenv`                                                         | `drizzle.config.ts:1`、`scripts/db-push.mjs:6`               | ⚠️ Next 自身会加载 `.env.local`，`dotenv` 只被构建工具与脚本用。合理，但注意 `drizzle.config.ts:4-6` 只在 `NODE_ENV !== "production"` 时加载，生产环境依赖外部注入。                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `eslint-config-prettier`、`prettier-plugin-tailwindcss`          | 工具链                                                       | ✅ 合理                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm-workspace.yaml` 的 `allowBuilds`                           | `@prisma/client` / `@prisma/engines` / `prisma` 全部 `false` | ⚠️ **残留物**。commit `b36b75d` 已迁移到 Drizzle（`package.json` 里确实没有 prisma 依赖），但为了「显式禁止其 postinstall」而保留三条配置。它们所针对的包只在 `drizzle-orm` 的可选 peer 里出现，**实际不会被安装**。这是「为已删技术栈留的配置」。建议删除这 3 行并在 `pnpm-workspace.yaml` 里只保留真正需要的 `@swc/core` / `@parcel/watcher` / `unrs-resolver` / `esbuild`。                                                                                                                                                                                                        |

**总体判断**：依赖选择**基本合理**，没有发现「用了 5% 功能的重型库」。唯二建议替换的是 `jsonwebtoken → jose`（同时解决体积与 Edge 约束）与 `bcryptjs` 的性能实测。`pnpm-workspace.yaml` 的 prisma 残留应清理。

### 4.12 【优化项】`tsconfig.json` 的宽松项

- `allowJs: true`（行 5）：项目是纯 TS/TSX，无 `.js` 源文件（`scripts/*.mjs` 不被 tsconfig 包含，见 `include` 未含 `scripts`）。**可关掉**，能捕获「误引入 JS 文件」。
- `include` 里有 `.next/dev/types/**/*.ts` 与 `.next/dev/dev/types/**/*.ts`（行 38-39）——**后者很可能是笔误**（`.next/dev/dev/` 路径），需核实。
- `noUnusedLocals` + `noUnusedParameters`（行 28-29）是好的，但正是它催生了 `void _role`（4.7）这类 hack。**这两个规则本身有价值，应保留**，代价是该删的字段要真删。

### 4.13 【优化项】`src/hooks/` 里可合并的 hook

11 个 hook 的逐个判断：

| hook                 | 使用处                               | 判断                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAsyncAction`     | 5 个 hook 内部                       | ⚠️ 有价值（统一 pending 态 + 回调），但含死代码（1.16）。**保留并精简**                                                                                                                                                                                                                                                                                                                                         |
| `useAuth`            | `AuthProvider` 内 + `useCurrentUser` | ✅ 合理                                                                                                                                                                                                                                                                                                                                                                                                         |
| `useComments`        | `CommentsSection`                    | ⚠️ 165 行手写数据层。**如果去掉 `ssr:false`（1.8），首次拉取逻辑可以整个删掉**，只剩 `loadMore`/`appendComment`/`replaceComment`/`removeComment`——可缩到约 60 行                                                                                                                                                                                                                                                |
| `useCurrentUser`     | `AuthorActions`、`usePostPageAuth`   | ⚠️ **12 行、两处使用、逻辑是 `me ?? ssrUser ?? null`**。凡传 `ssrUser` 的地方都是 `undefined`（`AuthorActions.tsx:17` 调用未传、`PostActions.tsx:32` 传的是服务端给的 `null`）。→ **`ssrUser` 参数是死参数**，4 个组件的 `ssrUser` prop 都是 `null`/`undefined`（`posts/[id]/page.tsx:228` 显式传 `user={null}`）。建议直接 `const { user } = useAuth()`，删掉该 hook 与所有 `ssrUser` prop 透传（涉及 5 处）。 |
| `useDismissable`     | `MobileMenu`、`UserMenu`             | ✅ 合理（点击外部关闭是通用逻辑）                                                                                                                                                                                                                                                                                                                                                                               |
| `useLogoutRedirect`  | `UserMenu`                           | ⚠️ 需核实是否只是 `router.push` 的包装                                                                                                                                                                                                                                                                                                                                                                          |
| `usePostPageAuth`    | `CommentsSection`、`PostActions`     | ⚠️ **21 行、2 处使用、只是把 3 个已有 hook 组合**。可内联                                                                                                                                                                                                                                                                                                                                                       |
| `usePosts`           | 多处                                 | ✅ 合理                                                                                                                                                                                                                                                                                                                                                                                                         |
| `useRequireAuth`     | `usePostPageAuth`                    | ⚠️ **20 行、1 处使用**，逻辑是 `if (!user) router.push(loginUrl) else action()`。可内联                                                                                                                                                                                                                                                                                                                         |
| `useTabListKeyboard` | `ProfileTabs`                        | ⚠️ 需核实是否只是 keydown 处理                                                                                                                                                                                                                                                                                                                                                                                  |
| `useThrottledScroll` | `PostToc`、`BackToTop`               | ✅ 合理（但 `PostToc` 是客户端解析 DOM 生成目录，见下）                                                                                                                                                                                                                                                                                                                                                         |
| `useUnsavedGuard`    | `WriteEditor`                        | ✅ 合理                                                                                                                                                                                                                                                                                                                                                                                                         |

**建议**：`useCurrentUser` + `useRequireAuth` + `usePostPageAuth` 三者合计 54 行，只为 2 个组件服务，且互相包装。→ **合并成 1 个 `usePostViewer()`**，或直接删掉改用 `useAuth()`。预估删除 40 行 + 5 处 prop 透传。

### 4.14 【优化项】`PostToc` 客户端解析 DOM

`PostToc.tsx` 依赖 `contentId="post-content"`（`posts/[id]/page.tsx:243`）在客户端读取 DOM 生成目录。

**问题**：服务端已经生成了带 `id` 的标题（`post.render.ts:79-97` 的 `postprocess` hook 正是为此而写，且有重复标题去重逻辑）。**目录结构本可以在服务端一次性算出**（渲染时就已知所有 `<h2>/<h3>`），却在客户端重新查询一遍 DOM。这导致：

- 目录在 JS 加载并执行前不可见（首屏无目录，LCP 之后才出现）；
- 屏幕阅读器在初始 HTML 里拿不到目录；
- `slugifyHeading` 的逻辑在服务端（`post.render.ts:69-77`）与客户端锚点跳转之间必须保持一致，否则跳转错位。

**修复方案** 让 `renderPostBody` 同时返回 `{ html, toc }`（`post.render.ts` 的 `postprocess` 已经是遍历一次的机会），把 `toc` 作为 prop 传给 `PostToc`，客户端只负责高亮当前项。

### 4.15 【优化项】`lib/` 目录的逐个判断

| 文件                         | 判断                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-request.ts`（181 行）   | ✅ **有价值**。统一超时、401 续期、网络重试的幂等判断（`SAFE_RETRY_METHODS`，行 13）都做对了。**但 `isRedirectingToLogin` 用模块级可变状态 + 5s 定时器（行 32-34,143-154）在多标签页下不共享**，每个标签页各跳一次登录页。建议改用 `sessionStorage` 标志或 BroadcastChannel。                                                                                                                                                                                                                                                                                                                                                                     |
| `auth-status.ts`             | ⚠️ 18 行。`document.cookie.includes("auth_status=1")`（行 6）是**子串匹配**，`OTHER_auth_status=1` 会误判。而且它是「用非 httpOnly cookie 当登录态标志」的整套机制（见 1.x：这个 cookie 的存在本身就是为了让 JS 知道是否要发 `getMeAction`）——**替代方案更简单**：直接无条件调 `getMeAction`（`AuthProvider.tsx:89`），失败即未登录。省掉一个非 httpOnly cookie + 一个 lib + 一套 localStorage 缓存（`USER_CACHE_KEY`）+ 一套跨标签页登出信号（`LOGOUT_SIGNAL`）。当前为了「省一次 401 请求」付出了：一个非 httpOnly cookie、`AuthProvider` 里的 localStorage 缓存读写、`wasLogoutSignaled` 的 storage 事件监听。**这是我判定为过度设计的一处**。 |
| `build-posts-url.ts`         | ✅ 合理（24 行，处理了 `page` 重置这类边界）。若采纳 1.7 的路径化改造则需要重写                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `category.ts`                | ⚠️ 需核实是否只有 `ALL_CATEGORY` 一个常量                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `error-message.ts`（83 行）  | ⚠️ 把 HTTP status → 文案、zod issue → 文案两套映射塞在一个文件。与 `texts/errors.ts`、`texts/feedback.ts` 职责重叠。**建议合并进一处文案表**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `form-feedback.ts`（107 行） | ⚠️ 与 `error-message.ts` 重叠（`resolveSubmitError` 内部大概率调用 `toErrorMessage`/`toValidationError`）。**两者应合并**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `seo.ts`（10 行）            | ⚠️ 只有一个函数返回两个固定字段。**收益 < 文件成本**，可内联                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `toast.ts`                   | ✅ 合理（sonner 的薄封装）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `url.ts`（31 行）            | ✅ 合理，5 个函数都有实际用途（`safeRedirect` 的 open-redirect 防护写对了：行 11 排除了 `//` 前缀）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `validation-loader.ts`       | ❌ 见 4.2，建议删除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `write-draft.ts`             | ⚠️ 需核实（草稿本地持久化？若不是则冗余）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### 4.16 【优化项】`lib/error-message.ts` 的 `HTTP_STATUS_TEXT_KEY` 映射不完整

`error-message.ts:16-24` 只映射了 7 个状态码（0/401/403/404/408/429/500），其余 `< 500` 统一落到 `feedback.common.actionFailed`（行 41）。这意味着 409（冲突，注册重复邮箱）、422（校验失败）都会显示「操作失败」而不是具体原因——**而 `auth.service.ts:32` 的 `DUPLICATE_ACCOUNT_MESSAGE`（"Email or username already in use"）是英文的，会被原样透传给中文界面**。

**为什么是问题** 服务端错误消息（`common/errors/*`、`auth.service.ts`、`post.service.ts`）有大量英文字面量（`"Post not found"`、`"Not authorized to modify this post"`、`"Comment content cannot be empty"`……），它们会通过 `sendError`（`api-response.ts:36`，`statusCode < 500` 时原样返回）和 `toFailure`（`action-result.ts:41`）**直接到达用户界面**。这是一个**中英混杂**的一致性问题，量级是几十处英文字符串。

**修复方案** 服务端错误只返回**错误码**（如 `POST_NOT_FOUND`、`DUPLICATE_ACCOUNT`），客户端按码查 `texts/errors.ts` 出中文文案。这也是「为什么服务端错误消息不应该用自然语言」的标准答案——当前设计把文案耦合进了服务端。

### 4.17 【优化项】`src/shared/types/post.ts` 与数据库 schema 的映射关系

`Post`（`types/post.ts:1-39`）与 `PostRow`（`schema.ts` 推断）字段几乎一一对应，`mapToPost`（`post.repository.ts:27-48`）做转换。这是**必要冗余**（领域模型与存储模型解耦是合理的），且 `coverImage`（`T | null` → `T | undefined`）、`publishedAt`、`authorId` 的转换是有实际意义的（JSON 序列化的 `null` vs `undefined` 差异）。

**判定：合理抽象，不冗余。** 唯一建议是 2.4 提到的把它拆成 `PostSummary` / `PostDetail`。

### 4.18 【判定为合理抽象，不冗余】

为避免报告一边倒，明确列出我认为**做得好、不应改动**的部分：

1. **`server-only` 的普遍使用**（30+ 文件）。零运行时成本，编译期阻止服务端密钥/逻辑泄漏到客户端。这是 Next 生态里最有价值的实践之一。
2. **`drizzle-orm/neon-http` 而非 Prisma**。迁移（commit `b36b75d`）方向正确：无 Rust 引擎、无二进制下载、冷启动更小、schema 即 TS。`db.batch` 提供的单事务原子批（2.1）比 Prisma 的 `$transaction` 更契合 HTTP 驱动。
3. **`db.batch` + CTE 实现原子性**，而非硬上交互式事务。这是对 neon-http 限制的正确应对（2.1）。
4. **repository 作为唯一 Drizzle 边界**，且由 `eslint.config.mjs` 的 `no-restricted-imports` **机器强制**而非文档约定（`README:59`）。这是全套分层里**唯一**我认为收益 > 成本的一层。
5. **`cacheComponents: true` + `use cache` + `cacheTag` 的正确用法**：读路径用 `use cache`（`post.cache.ts:69-74`），写路径用 `updateTag` + `revalidatePath` 双失效（`post.controller.ts:36-40`），并**主动识别出不该缓存的两类查询**（带 `q` 的搜索、依赖 viewer 的查询，`post.cache.ts:64-67,76-79`）。这是对 Next 16 缓存模型的准确理解。`updateTag` 只能用于 Server Action 这个约束（`dist/docs/.../updateTag.md`）也被正确遵守了（grep 确认无 Route Handler 调用）。虽然 3.1 根因 1 指出双平台存储后端不同，但**代码本身是规范的**。
6. **`escapeLike` + 参数化查询**（2.16），无 SQL 注入。
7. **`sanitize-html` 白名单清洗 + `<script>` 标签的 `\u003c` 转义**（`post.render.ts:148`、`posts/[id]/page.tsx:267,292`）。JSON-LD 的 `dangerouslySetInnerHTML` 正确处理了 `</script>` 逃逸。这是很多人会漏的一处。
8. **`safeRedirect` 的 open-redirect 防护**（`lib/url.ts:10-13`）：排除 `//` 前缀与登录页循环。
9. **`PLACEHOLDER_PASSWORD_HASH` 的时间攻击防护**（`auth.service.ts:30,84-87`）：对不存在的用户也做一次 bcrypt 比较。这是防用户枚举的正确做法。
10. **`toSafeUser` 剥离 `password`/`tokenVersion`/`disabled`**（`auth.service.ts:36-44`）。**除了一处**：`User` 类型本身含 `password?: string`（`user.repository.ts:53` 会填充），意味着**这个类型在服务端内部随处携带密码哈希**。当前所有出网路径都经过 `toSafeUser`，所以没泄漏；但类型设计上「密码哈希随 User 到处走」是危险的，建议拆 `UserWithSecret`（仅 `auth.service.ts` 使用）与 `User`（无密码）。
11. **`proxy` 的 matcher 排除了 `_next/static|_next/image|api|` 与静态后缀**（`proxy.ts:25-28`），避免了「auth 逻辑挡住 CSS/JS」（`dist/docs/.../proxy.md` 明确警告的坑）。
12. **`jsonwebtoken.verify` 的 `algorithms: ["HS256"]` 固定 + `issuer` + `audience`**（`token.ts:27-31`），挡住了算法混淆。问题只在 1.1 的 fallback 分支。
13. **`pnpm` + `frozen-lockfile` + `packageManager` 字段固定版本**。可复现构建。
14. **`tsconfig` 的 `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `isolatedModules`**（`tsconfig.json:27,31,12`）。严格度高于 Next 默认模板。
15. **`texts/` 词条集中表**（见 4.4）——经量化后判定保留：67 条 import、15 处参数化调用，内联是净亏。
16. **`lib/error-message.ts` + `lib/form-feedback.ts`**：分别承担「HTTP 状态码 → 文案」「zod issue → 字段级文案」的翻译，被 5 个表单共享（`LoginForm`/`RegisterForm`/`SettingsForm`/`WriteEditor`/`CommentsSection`），统一了「字段错误 / 表单级错误 / toast」三分法。虽然与 4.15 提到的 `texts/errors.ts` 有重叠，但**分层本身是合理的**（翻译逻辑 vs 文案数据），只需合并重复文案，不需拆掉文件。
17. **`components/ui/**`（17 文件 494 行，均值 29 行）**：`Button.tsx`（63 行）处理 button/link 多态 + loading + aria；`Modal.tsx`（116 行）含 focus trap + 焦点归还 + portal + 退场动画。即便只有 1 个消费者，逻辑量自证其价值。
18. **`error-page-shell.ts` 中重复的 design token**：`error.md:163` 明确「Global error UI must define its own `<html>` and `<body>` tags, global styles, fonts...」，`:165` 补充「global-error and the built-in 500 page render their own document and **do not include your global styles**」。因此把 `tokens.css` 的 `oklch` 值复制一份到 `error-page-shell.ts:3-26` 是**必要冗余**（复制范围可以缩小，但机制本身必须存在）。
19. **`hooks/` 的 12 个 hook 无一零引用**（逐个 grep 确认）。不存在「无用 hook」问题，只有 `useAsyncAction` 的死参数（4.4）与 auth 簇的 3 个 hook 重叠（4.13）。
20. **`(dashboard)/profile/page.tsx:10` 的 `export const instant = false`**：与 `cacheComponents: true`（`next.config.ts:9`）配套的合法配置，用于让该段退出静态壳校验。**不是多余代码。**

### 4.19 【已停止怀疑·列入 PASSED】依赖与本机环境

逐个读取 `node_modules/*/package.json` 核对，声明与实际安装一致：`next 16.3.5`、`react/react-dom 19.3.0`、`drizzle-orm 0.45.4`、`@netlify/plugin-nextjs 5.15.13`、`drizzle-kit 0.31.11`、`lucide-react 1.46.0`、`marked 18.0.13`、`bcryptjs 3.0.3`、`@neondatabase/serverless 1.1.0`。

- `marked-highlight@2.2.4` 的 peer `marked >=4 <19` 与 `marked 18.0.13` 兼容。
- `lucide-react 1.46.0` 的 peer 含 `^19.0.0`（React 19 兼容）；安装体积 35 MB 是**磁盘安装量**，不是 bundle 量，且 `sideEffects:false` + ESM 可摇树（53 个不重复图标 / 32 条 barrel import）。**不建议改深路径 import**（该包无 `exports` 字段，改深路径会破坏封装）。
- `sharp 0.35.4` 已作为 Next 的 optionalDependency 安装；lockfile 同时含 linux/win32 的 swc 与 sharp 变体 → **跨平台 `--frozen-lockfile` 不会因平台缺包失败**。
- 无 `quality=` 用法 → `qualities` 校验只会 warn（`get-img-props.js:426`）。
- `cacheComponents` 与 `experimental.globalNotFound` 都是 16.3.5 的合法键（`config-schema.js:239,463`；`config-shared.d.ts:1538,1087`），不会触发 "Invalid next.config"。
- **`tsconfig.tsbuildinfo` 未被 git 跟踪**（`git ls-files` 报 pathspec 不存在）→「已提交的 tsbuildinfo」这个问题**不存在**。
- **`publish = ".next"` 与插件默认一致**（`plugin-context.js:24,37-47`），且 `verifyPublishDir` 只在 `publishDir === 包根` 时 failBuild（`verification.js:26-36`）→ **保留它是对的，不要删也不要改**。
- **`netlify.toml` 不需要 `[functions]`**：插件自写 `___netlify-server-handler.json`（`build/functions/server.js:78-94`），只读取 `netlifyConfig.functions["*"].included_files`（`:33`）。
- **插件确实支持 Next 16 的 `cacheComponents`/`use cache`**，含 Next 16 的 `updateTags`（CacheHandlerV3）与 `expireTags`（V2）：`use-cache-handler.js:1541-1569`；Next 侧契约见 `use-cache/handlers.js:97-122`。**未发现 prerender manifest 被误处理的代码路径** —— 这消除了一项我原本担心的兼容性风险。
- **`/rss` 与 `/sitemap.xml` 并未被预渲染**（`.next/server/app` 下只有 `route.js`，无 `.body`；`prerender-manifest.routes` 里也没有该路由）。真正在构建期访问数据库的只有 `/` 与 `posts/[id]` 的 `generateStaticParams`。这修正了我在 3.6 里把 `/rss`、`/sitemap.xml` 列入构建期数据库访问的表述——它们是**运行时**动态路由。
- **`PORT` 传递正确**：`next/dist/bin/next:181` 的 `.default(3000).env('PORT')`，配合 `dev.mjs:11,147` 的透传 → 「Railway 注入的 PORT 被丢失」这个猜测**不成立**。
- `--start` 分支不会删 `.next`（`dev.mjs:113` 的 `if (!isStart)`）→ 不会自己毁掉构建产物。

---

## 5. 修复优先级建议

> 配套文档：并发进行的「过度设计 / 冗余」专项审计已产出独立的逐文件证据报告，其中包含 23 项发现与可批量执行的 16 步清单（`F1`–`F23` 编号），本报告的 4.x 章节与其结论已对齐。二者互补：本报告侧重安全 / 数据库 / 部署，该报告侧重逐文件冗余量与目标目录树。

按「风险 × 修复成本」排序。**标记说明**：`[已修]` = 本次已改并验证；`[待你定]` = 需要你决策或需真实平台/数据库才能验证。

**P0（立即，安全/数据正确性/构建可用性）**

1. `[已修]` **3.11 Railway 未固定 Node 版本** —— `engines` 改 `>=20.9.0`（Next 16.3.5 实际要求）
2. `[已修]` **2.5.1 `togglePostAssociationAndCounters` 的 `delta` 与实际写入脱钩** —— 让 `delta` 兼看 `added`，消除**永久无法自愈**的点赞计数漂移
3. `[已修]` **2.14b `rate-limit.ts` 的裸 `Date` 插值** —— 改用 `now()`，消除跨时区系统性偏移
4. `[已修]` **1.2 `withDbRetry` 对写重试** —— 改名 `withReadRetry` + 只对可重试 SQLSTATE 白名单重试
5. `[已修]` **2.16b `getDb()` 无 fetch 超时** —— 见下方⚠️，**必须传函数而非求值结果**
6. `[已修]` **4.5.1 客户端 Markdown 预览未净化** —— 走服务端 `renderPostBody`，删除无净化的客户端渲染器
7. `[已修]` **1.7 `postListMaxLimit = 20000`** —— 降到 500；`sitemap` 改分批拉取
8. `[已修]` **3.10 Netlify 上 `headers()` 不覆盖 CDN 直出的静态资源** —— `netlify.toml` 补 `[[headers]]`
9. `[已修]` **3.3 去掉 `netlify.toml` 里重复的 `pnpm install`**
10. `[已修]` **3.14 补 `.npmrc`** 的 `public-hoist-pattern[]=*`
11. `[已修]` **`.gitignore` 补 `.pnpm-store/`、`*.log`**
12. `[已修]` **CSP 补 `object-src 'none'`**；`deviceSizes` 补回 1080/1920
13. `[待你定]` **3.12 `NEXT_PUBLIC_BASE_URL`** —— 你说两平台已配，**请确认是配在「构建环境变量」**（`NEXT_PUBLIC_*` 构建期内联，只在运行时配无效）；本地 `.env.local` 该行仍是空值
14. `[待你定]` **3.15 `pnpm-lock.yaml` 已修改未提交** —— 需要你决定是否提交（我未擅自提交）
15. `[待你定]` **1.1 IP 伪造绕过限流** —— 需**在 Railway 实测**头行为后才能定策略；当前代码未改
16. `[待你定]` **1.1b 限流 fail-open** —— 已加 `mode` 参数（默认 `fail-closed`）但**未改调用点**，因为改成 fail-closed 会在 DB 故障时把登录全部拒绝，这是产品取舍
17. `[待你定]` **1.6 删除/更新无限流** —— 需确认阈值
18. `[待你定]` **2.14 email/`q`/`category`/`tag` 长度上限** —— 需确认阈值（改上限会影响既有客户端校验）

> ⚠️ **第 5 条的写法有坑（我在修复过程中踩到并纠正）**：`AbortSignal.timeout()` 是一次性的，
> 到期后**永久**处于 aborted。`getDb()` 的 client 跨请求复用，所以
> `fetchOptions: { signal: AbortSignal.timeout(N) }` 只对**第一个**请求有效，
> 之后每次查询都在毫秒级以 `The operation was aborted due to timeout` 失败。必须传**函数**：
>
> ```ts
> neon(url, { fetchOptions: () => ({ signal: AbortSignal.timeout(8_000) }) });
> ```
>
> 依据：驱动在每个请求里把 `fetchOptions` 展开进 fetch init（`@neondatabase/serverless/index.js:1285`）。
> **这个 bug 只在并发下暴露**——顺序连打 3 次全正常，一上 dev server 就全线失败。
> 已在 E2E 中验证修复（连续 6 次 `/api/health` 全 200）。

**P1（本周，会话生命周期与部署一致性）**

19. `[已修]` **1.4 登出失败仍清本地状态** —— 仅在服务端确认成功后清（避免"界面已登出、服务端会话仍可用"）
20. `[已修]` **3.4 健康检查改请求期执行** —— `/api/health` 加 `await connection()`；`railway.json` 的 `healthcheckPath` 仍需你改为 `/api/health`
21. `[已修]` **1.6 的 `generateStaticParams` 静默失败** —— `catch {}` 改为 `logger.error` + 明确注释
22. `[已修]` **评论区删除的授权 TOCTOU** —— 授权条件并入同一条 SQL，并把 `comments_count` 加 `GREATEST(...,0)`
23. `[已修]` **首页错误恢复路径崩溃** —— `EmptyState action` 传 `onClick` 给 Server Component 会抛
    "Event handlers cannot be passed to Client Component props"，导致**DB 故障时唯一的刷新入口自己崩掉**；改为 `href`
24. `[已修]` **补 `import "server-only"`** 到 `errors/app-error.ts`、`errors/index.ts`、`logger.ts`、`zod.ts`
25. `[待你定]` **1.2b 刷新宽限路径** —— 需你确认是否接受 `ignoreExpiration` 重验签 + 缩短宽限期（会改变现有会话行为）
26. `[待你定]` **1.3 Server Action 的 401 不触发 refresh** —— 需新增统一 `callAction` 包装，改动面较大
27. `[待你定]` **1.5 搜索索引** —— 需真实数据库与 `EXPLAIN` 验证
28. `[待你定]` **2.11 迁移机制** —— 需你决定迁移流程与生产/本地分离库
29. `[待你定]` **2.9 补缺失索引** —— 涉及 schema 变更，需 `db:push` 到真实库
30. `[待你定]` **3.13 / 3.18** —— 文档补充；`analyze` 需装 `cross-env`
31. `[待你定]` **1.12 `revalidatePath` 批量失效** —— 需实测 `revalidatePath("/", "layout")` 的覆盖范围

**P2（架构瘦身；多数为零低风险纯删除）**

32. `[已修]` 删 `src/app/template.tsx`
33. `[已修]` 删死导出：`DashboardSkeleton`、`peekPostValidation`、`PostInsert`、`isValidPostId` 的导出位
34. `[已修]` 删 `useAsyncAction` 的 `retry` 段（8 个调用点均未传，纯死代码）
35. `[已修]` 删 `lib/validation-loader.ts`（连同 6 处 `onFocus` 预热 hack 改回静态 import）
36. `[已修]` 分页常量去重 —— `POST_PAGE_SIZE`/`HOME_PAGE_SIZE`/`COMMENT_PAGE_SIZE` 收敛到 `@shared/limits`，删掉 `policy.ts` 的 `PAGE_LIMITS`
37. `[已修]` 去掉 `Number.MAX_SAFE_INTEGER` 当 LIMIT 占位（改为不写 LIMIT）
38. `[保留]` **`comment-template/` + `scripts/strip-comments.mjs`** —— 按你要求**保留**（我一度删除，已全部恢复）
39. `[待你定]` 骨架收敛为 3 个原语 + Suspense 就地声明（−约 660 行）—— 改动面大、需逐页目视
40. `[待你定]` `FormField` 加必填 `htmlFor`、删 `findChildControlId`（需改 12 处）
41. `[待你定]` `next/image` 收进唯一封装组件 + lint 禁止直接 import
42. `[待你定]` 合并 `toFailure`/`sendError`、合并图片 URL 校验的 4 份定义与 4 份同义文案
43. `[待你定]` 清理 `updateUserRecord` 里 2 条永不执行的 SELECT
44. `[待你定]` 4.1 服务端分层合并（8 层 → 3 层，约 −700 行）
45. `[待你定]` `server/user/user.service.ts` 整层删除 + 4 处 re-export 收直（会触动 README 里机器强制的分层规则 R1/R2，需你确认是否放弃该规则）
46. `[待你定]` `railway.json` 的 `startCommand` 改直连 `next start`

> **撤回项**：初版曾建议「4.4 `texts/` 收敛（删除约 800 行）」与「4.11 替换 `jsonwebtoken` → `jose`」。经量化核对（texts 有 67 条 import、15 处 `formatTemplate` 调用，内联净亏约 370 行；Proxy 固定 Node runtime，`jose` 无必要），**两条均已撤回**，见 4.4 与 4.11 的修正说明。

**P3（择机）**

47. 1.8 `/posts` 路径化改造
48. 1.9 评论区 SSR 化
49. 2.6 浏览量聚合表（消除热行争用与 `after()` 时限截断丢计数）
50. 2.2 / 2.10 分页改为单次往返（`count(*) over ()` 或游标分页），消除 total 与数据的双快照竞态
51. 2.3 / 2.4 类型诚实化（`PostSummary` / `PostDetail`）
52. 4.9 / 4.10 常量与类型合并
53. 4.13 hook 合并、4.14 TOC 服务端化、4.16 错误码化
54. 2.5.4 增量计数的对账/回填脚本

---

## 6. 需要实测验证的项（本地源码无法确证）

诚实标注，建议部署后逐项验证：

1. **Railway 是否覆盖 `x-real-ip` / `x-forwarded-for`**（1.1）。验证：两个 curl 各带一个伪造头，看服务端记录的 IP。
2. **Netlify 上 AVIF 的实际产出是否与 `next start` 一致**（3.10）。验证：两个环境 `curl -sI /_next/image?...`。
3. **Netlify 上 Turbopack 产物 + `@netlify/plugin-nextjs@5.15.13` 的运行时兼容性**（3.1 根因 4）。验证：部署后逐个访问 `/`、`/posts`、`/posts/<id>`、`/api/health`、`/rss`、`/sitemap.xml`。失败时第一个动作是换 `next build --webpack`。
4. **`revalidatePath("/", "layout")` 在 `cacheComponents: true` 下的实际覆盖范围**（1.12）。
5. **`bcryptjs` 纯 JS 实现在 Netlify 函数上的登录 P95 耗时**（4.11）。若 > 1s 需换实现或降 rounds。
6. **Netlify 的 node-middleware 桥接是否覆盖 `src/proxy.ts` 实际用到的 API 面**（3.1 根因 2）。当前 proxy 只做 cookie 存在性检查，风险低；若采纳建议把 `verifyToken` 接进 proxy，必须先确认 `jsonwebtoken` 的依赖树在 shim 下可加载（纯 JS，预期可行，但仍应实测一次）。
7. **Next 16 是否允许在 `proxy.ts` 中 `export const runtime = 'nodejs'`**（3.1 根因 2）。文档未明确。
8. **`lucide-react` 在实际 bundle 中的体积占比**（4.11）。需要先在非 Windows 环境跑通 `pnpm analyze`。

---

## 附：本报告的核心源码证据索引

| 结论                                                                | 证据位置                                                                                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `db.batch` 是单事务                                                 | `drizzle-orm/neon-http/session.js:117-133`、`@neondatabase/serverless/index.js:1266,1282-1293`                                     |
| neon-http 不支持交互式事务                                          | `drizzle-orm/neon-http/session.js:151-153`                                                                                         |
| `decode` 不验签                                                     | `jsonwebtoken/decode.js:5`                                                                                                         |
| Next 16 默认 Turbopack                                              | `next/dist/lib/bundler.js`（`parseBundlerArgs` 末尾：`process.env.TURBOPACK='auto'; return 0`）                                    |
| `proxy` 编译进 `functions-config-manifest.json` 且是 nodejs runtime | `.next/server/functions-config-manifest.json`（本机实测产物）                                                                      |
| `middleware-manifest.json` 为空                                     | `.next/server/middleware-manifest.json`（本机实测产物）                                                                            |
| `/posts/[id]` 是 PPR 静态壳                                         | `.next/prerender-manifest.json` → `dynamicRoutes["/posts/[id]"].renderingMode = "PARTIALLY_STATIC"`                                |
| `/posts/placeholder` 真实产出                                       | `.next/server/app/posts/placeholder.html`（57623 字节）                                                                            |
| `/posts` 静态壳 + postponed                                         | `.next/server/app/posts.meta`                                                                                                      |
| Netlify 强制 standalone                                             | `@netlify/plugin-nextjs/dist/index.js:54` → `next/dist/server/config-shared.js:142`                                                |
| Netlify 的 `use cache` 是进程内 LRU + Blobs tag                     | `@netlify/plugin-nextjs/dist/run/handlers/use-cache-handler.js:1392-1404,1571-1575`                                                |
| Netlify 改写 `/_middleware` 的 matcher                              | `@netlify/plugin-nextjs/dist/build/content/server.js:279-298`                                                                      |
| `cacheComponents` 用 `<Activity>` 保留状态                          | `next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`                                            |
| `after()` 不是 request-time API                                     | `next/dist/docs/01-app/03-api-reference/04-functions/after.md`                                                                     |
| Route Handler GET 默认 dynamic（v15 起）                            | `next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md:669`                                                          |
| `updateTag` 只能用于 Server Action                                  | `next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md`                                                                 |
| `next start` 会把 `NODE_ENV` 设为 production                        | `next/dist/bin/next:84`（Commander `preAction`）                                                                                   |
| `pnpm start` 确实执行 `next start` 且透传 PORT                      | `scripts/dev.mjs:11,145-148`                                                                                                       |
| 客户端含 hljs/marked chunk（约 120 KB 未压缩）                      | `.next/static/chunks/03-0ut1dz87xe.js`(32.8KB)、`188954s944z0q.js`(19.6KB)、`30ye4ut98elc_.js`(24.8KB)、`15f52xgkl0fxv.js`(42.7KB) |
