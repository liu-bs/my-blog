"use server";

/**
 * @file blog.controller.ts
 * @description 文章模块 Server Action 控制器（"use server" 边界）。写操作（增删改）经 runMutation
 * 统一鉴权 + 全量失效缓存 + 多语言页面 revalidate；点赞/收藏经 runToggle 走 IP 限流 +
 * 小范围缓存失效（有意区分互动与内容变更的失效范围）；所有错误经 toFailure 转 ActionResult。
 */
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

/** 失效本地化的列表页路由（首页与文章列表页） */
function revalidateListPages(): void {
  revalidatePath("/[locale]", "page");
  revalidatePath("/[locale]/posts", "page");
}

/**
 * 文章写操作（创建/更新/删除）统一包装
 * 强制登录 → 执行业务 → invalidateBlogCache 全量失效 + 各语言页面 revalidate
 * @param mutate 业务回调，返回响应数据及涉及的文章 id（用于精确失效）
 * @returns ActionResult
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
 * 创建文章 Server Action
 * IP 限流 10 次/5 分钟；成功后全量失效博客缓存
 * @param input 文章表单数据
 * @returns ActionResult，成功携带新文章
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
 * 更新文章 Server Action（仅作者可改）
 * @param id 文章 id
 * @param input 文章表单数据
 * @returns ActionResult，成功携带更新后的文章
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
 * 删除文章 Server Action（仅作者可删）
 * @param id 文章 id
 * @returns ActionResult，data 恒为 null
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
 * 点赞/收藏 toggle 的统一包装
 * IP 限流 30 次/分钟 → 鉴权 → 执行业务 → invalidatePostCache 小范围失效 + 页面 revalidate
 * @param kind 互动类型（限流 key 与错误定位用）
 * @param postId 文章 id
 * @param mutate 业务回调（service 层的 likePost/toggleFavorite）
 * @returns ActionResult，成功携带互动结果
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
 * 点赞/取消点赞 Server Action，需登录；IP 限流 30 次/分钟
 * @param postId 文章 id
 * @returns ActionResult，成功携带点赞状态与最新点赞数
 */
export async function toggleLikeAction(postId: string): Promise<ActionResult<LikeData>> {
  return runToggle("like", postId, (id, userId) => likePost(id, userId));
}

/**
 * 收藏/取消收藏 Server Action，需登录；IP 限流 30 次/分钟
 * @param postId 文章 id
 * @returns ActionResult，成功携带收藏状态与最新收藏数
 */
export async function toggleFavoriteAction(
  postId: string,
): Promise<ActionResult<FavoriteToggleData>> {
  return runToggle("favorite", postId, (id, userId) => toggleFavorite(id, userId));
}

/**
 * 查询当前用户对文章的点赞/收藏状态 Server Action
 * 未登录时返回全 false 而不报错，便于匿名页面回显按钮态
 * @param postId 文章 id
 * @returns ActionResult，成功携带点赞/收藏布尔状态
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
