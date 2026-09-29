/**
 * @file blog.controller.ts
 * @description 文章领域的 Server Actions 编排层（"use server"）：统一处理鉴权、限流、入参校验、
 * 调用 service 执行业务，并在写操作后失效缓存 / revalidate 相关页面路径。
 * 所有 Action 返回统一的 {@link ActionResult}，前端据此判断成功或错误，不抛出到客户端
 */
"use server";

import { revalidatePath } from "next/cache";
import { getAuthPayload } from "@server/auth/auth.service";
import {
  createPost,
  updatePost,
  deletePost,
  likePost,
  toggleFavorite,
  getMyPostState,
} from "@server/blog/blog.service";
import { parseCreatePostBody, parseUpdatePostBody } from "@server/blog/blog.validator";
import {
  invalidateBlogCache,
  invalidatePostCache,
  revalidatePostPathAllLocales,
} from "@server/blog/blog.cache";
import { isRateLimited } from "@server/common/rate-limit";
import { NotFoundError, RateLimitError, UnauthorizedError } from "@server/common/errors";
import { toFailure, runAction, clientIp, type ActionResult } from "@server/common/action-result";
import type {
  AuthPayload,
  CreatePostDto,
  PostData,
  PostUserStateData,
  UpdatePostDto,
  LikeData,
  FavoriteToggleData,
} from "@shared";

export type { ActionResult };

/**
 * 失效首页与文章列表页的页面缓存
 * @description 文章增删改会影响列表展示（首页最近文章、posts 列表），二者都按 locale 路由渲染，
 * 故对带 [locale] 动态段的两条路由做 revalidatePath
 */
function revalidateListPages(): void {
  revalidatePath("/[locale]", "page");
  revalidatePath("/[locale]/posts", "page");
}

/**
 * 文章写操作的公共外壳
 * @description 固定流程：取登录态（未登录直接 Unauthorized）→ 执行 mutate 得到数据（可选带上受影响的 postId）
 * → 失效文章缓存、revalidate 列表页、若给出 postId 再 revalidate 所有语言的文章详情路径 → 返回成功结果。
 * 异常统一经 toFailure 转成失败结果，保证调用方始终拿到 ActionResult
 * @param mutate 实际执行业务的回调，接收当前用户
 * @returns 成功时 `{ ok: true, data }`，失败时 `{ ok: false, status, message }`
 */
async function runMutation<T>(
  mutate: (user: AuthPayload) => Promise<{ data: T; postId?: string }>,
): Promise<ActionResult<T>> {
  try {
    const user = await getAuthPayload();
    if (!user) throw new UnauthorizedError();

    const { data, postId } = await mutate(user);

    invalidateBlogCache(postId);
    revalidateListPages();
    if (postId) revalidatePostPathAllLocales(postId);

    return { ok: true, data };
  } catch (err) {
    return toFailure(err, "Posts");
  }
}

/**
 * 创建文章
 * @description 限流按「客户端 IP」计：5 分钟内最多 10 次，防刷帖；通过后校验入参并写入文章。
 * 作者 ID 取自登录态，不接受客户端传入
 * @param input 创建文章的原始入参
 * @returns 成功返回新文章 `{ post }`
 */
export async function createPostAction(input: CreatePostDto): Promise<ActionResult<PostData>> {
  if (await isRateLimited(`posts:create:${await clientIp()}`, 10, 5 * 60_000)) {
    return toFailure(new RateLimitError("Posting too frequent, please try again later"), "Posts");
  }

  return runMutation(async (user) => {
    const dto = parseCreatePostBody(input);
    const post = await createPost({ ...dto, authorId: user.id });

    return { data: { post } };
  });
}

/**
 * 更新文章
 * @description 仅作者本人可改（service 内鉴权）；返回 postId 以便失效该文章详情缓存。
 * id 先 trim，空串按「文章不存在」处理
 * @param id 文章 ID
 * @param input 局部更新入参
 * @returns 成功返回更新后的文章 `{ post }`
 */
export async function updatePostAction(
  id: string,
  input: UpdatePostDto,
): Promise<ActionResult<PostData>> {
  return runMutation(async (user) => {
    const postId = id?.trim();
    if (!postId) throw new NotFoundError("Post not found");

    const dto = parseUpdatePostBody(input);
    const post = await updatePost(postId, dto, user.id);
    return { data: { post }, postId };
  });
}

/**
 * 删除文章
 * @description 仅作者本人可删（service 内鉴权），并在同一事务里回退作者统计
 * @param id 文章 ID
 * @returns 成功返回 `data: null`
 */
export async function deletePostAction(id: string): Promise<ActionResult<null>> {
  return runMutation(async (user) => {
    const postId = id?.trim();
    if (!postId) throw new NotFoundError("Post not found");

    await deletePost(postId, user.id);
    return { data: null, postId };
  });
}

/**
 * 点赞 / 收藏交互的公共外壳
 * @description 与文章 CRUD 的差异：限流窗口更短（1 分钟 30 次，交互频率天然更高）；
 * 不 revalidate 列表页——交互只改变单片文章的计数，无需刷新整页列表，只失效该文章缓存与详情路径
 * @param kind 交互类型，用于区分限流 key
 * @param postId 目标文章 ID
 * @param mutate 执行交互的回调，返回交互后的计数信息
 * @returns 交互结果
 */
async function runToggle<T>(
  kind: "like" | "favorite",
  postId: string,
  mutate: (postId: string, userId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  if (await isRateLimited(`posts:${kind}:${await clientIp()}`, 30, 60_000)) {
    return toFailure(
      new RateLimitError("Action too frequent, please try again later"),
      "Interaction",
    );
  }

  try {
    const user = await getAuthPayload();
    if (!user) throw new UnauthorizedError();

    const id = postId?.trim();
    if (!id) throw new NotFoundError("Post not found");

    const result = await mutate(id, user.id);

    invalidatePostCache(id);
    revalidatePostPathAllLocales(id);
    return { ok: true, data: result };
  } catch (err) {
    return toFailure(err, "Interaction");
  }
}

/**
 * 切换点赞
 * @param postId 文章 ID
 * @returns `{ liked, likes }` 操作后的点赞状态与最新点赞数
 */
export async function toggleLikeAction(postId: string): Promise<ActionResult<LikeData>> {
  return runToggle("like", postId, (id, userId) => likePost(id, userId));
}

/**
 * 切换收藏
 * @param postId 文章 ID
 * @returns `{ favorited, favorites }` 操作后的收藏状态与最新收藏数
 */
export async function toggleFavoriteAction(
  postId: string,
): Promise<ActionResult<FavoriteToggleData>> {
  return runToggle("favorite", postId, (id, userId) => toggleFavorite(id, userId));
}

/**
 * 查询当前用户对某篇文章的点赞 / 收藏状态
 * @description 唯一允许匿名的 Action：未登录时返回未点赞未收藏，而不是报未授权，
 * 便于详情页在游客态渲染默认按钮状态
 * @param postId 文章 ID
 * @returns `{ liked, favorited }`
 */
export async function getMyPostStateAction(
  postId: string,
): Promise<ActionResult<PostUserStateData>> {
  return runAction("Interaction", async ({ authPayload }) => {
    const user = await authPayload();
    if (!user) return { ok: true, data: { liked: false, favorited: false } };

    const id = postId?.trim();
    if (!id) throw new NotFoundError("Post not found");

    return { ok: true, data: await getMyPostState(id, user.id) };
  });
}
