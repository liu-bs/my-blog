"use server";

/**
 * @file 博客域 Server Action 控制器
 * @description 文章创建/更新/删除与点赞/收藏的服务端入口。薄编排层：限流 → 鉴权 → 校验（blog.validator）
 * → 业务（blog.service）→ 缓存失效（blog.cache）+ 路由再验证。
 * 所有 Action 返回值均为 ActionResult（成功 ok:true / 失败带 status+message），错误不穿透到客户端。
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
  revalidatePostPath,
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

/** 再验证文章列表相关的路由页（首页与 /posts 列表页） */
function revalidateListPages(): void {
  revalidatePath("/", "page");
  revalidatePath("/posts", "page");
}

/**
 * 文章写操作通用编排：鉴权 → 执行变更 → 全量失效博客缓存 + 列表/详情页再验证
 * @description 缓存失效时序固定在业务成功之后、返回之前，保证客户端刷新拿到新数据
 * @param mutate 接收 token payload 的变更函数；返回数据及可选 postId（用于按文章 tag 精确失效）
 * @returns ActionResult：成功含数据，失败经 toFailure 归一化
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
    if (postId) revalidatePostPath(postId);

    return { ok: true, data };
  } catch (err) {
    return toFailure(err, "Posts");
  }
}

/**
 * 创建文章 Action
 * @description 先按 IP 限流（10 次/5 分钟），再走 runMutation 编排；作者 ID 取自 token，不信任前端传参
 * 调用方 UI：src/hooks/usePosts.ts（编辑器/发布页）
 * @param input 创建文章 DTO（标题、正文、分类、标签、封面等）
 * @returns 新建文章数据
 * @throws 限流（429）、未登录（401）、校验失败（400）、封面 URL 不安全（422）
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
 * 更新文章 Action（局部更新，草稿/发布切换亦走此入口）
 * @description 所有权校验在 blog.service.updatePost 内完成
 * 调用方 UI：src/hooks/usePosts.ts（编辑器/管理页）
 * @param id 文章 ID
 * @param input 更新 DTO（仅传入的字段被覆盖）
 * @returns 更新后的文章数据
 * @throws 未登录（401）、文章不存在（404）、非本人文章（403）、校验失败（400）
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
 * 删除文章 Action
 * @description 作者统计回退与文章删除在同一事务内完成（见 blog.service.deletePost）
 * 调用方 UI：src/hooks/usePosts.ts（管理页删除按钮）
 * @param id 文章 ID
 * @returns 成功时 data 为 null
 * @throws 未登录（401）、文章不存在（404）、非本人文章（403）
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
 * 点赞/收藏切换通用编排：IP 限流 30 次/分钟 → 鉴权 → 变更 → 精确失效该文章缓存
 * @param kind 交互类型，参与限流 key（posts:like:/posts:favorite:）
 * @param postId 文章 ID
 * @param mutate 实际调用的 service 切换函数
 * @returns ActionResult，失败经 toFailure 归一化
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
    revalidatePostPath(id);
    return { ok: true, data: result };
  } catch (err) {
    return toFailure(err, "Interaction");
  }
}

/**
 * 点赞切换 Action
 * @description 点赞数与作者 likes 统计在同一事务内增减（见 blog.service）
 * 调用方 UI：src/hooks/usePosts.ts、文章详情页点赞按钮
 * @param postId 文章 ID
 * @returns 当前是否已点赞及最新点赞数
 * @throws 限流（429）、未登录（401）、文章不存在（404）、草稿不可点赞（403）
 */
export async function toggleLikeAction(postId: string): Promise<ActionResult<LikeData>> {
  return runToggle("like", postId, (id, userId) => likePost(id, userId));
}

/**
 * 收藏切换 Action
 * 调用方 UI：src/hooks/usePosts.ts、文章详情页收藏按钮
 * @param postId 文章 ID
 * @returns 当前是否已收藏及最新收藏数
 * @throws 限流（429）、未登录（401）、文章不存在（404）、草稿不可收藏（403）
 */
export async function toggleFavoriteAction(
  postId: string,
): Promise<ActionResult<FavoriteToggleData>> {
  return runToggle("favorite", postId, (id, userId) => toggleFavorite(id, userId));
}

/**
 * 查询"我"对某文章的点赞/收藏状态 Action
 * @description 只读操作，不做限流；未登录返回 false/false 而非 401，保证匿名页可渲染
 * 调用方 UI：src/components/blog/PostActions.tsx
 * @param postId 文章 ID
 * @returns liked/favorited 两个布尔状态
 * @throws 文章 ID 为空时 404
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
