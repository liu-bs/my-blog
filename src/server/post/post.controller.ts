"use server";

import type {
  CreatePostDto,
  FavoriteToggleData,
  LikeToggleData,
  PostData,
  UpdatePostDto,
  UserPostState,
} from "@shared";
import { getAuthPayload, requireAuthPayload } from "@server/auth/auth.guard";
import {
  clientIp,
  ensureNotRateLimited,
  requireId,
  runAction,
  type ActionResult,
} from "@server/common/action-result";
import { RATE_LIMITS } from "@server/common/policy";
import { getUserPostState } from "@server/user/user.service";
import {
  invalidatePostCache,
  invalidatePostsCache,
  revalidatePostListPaths,
  revalidatePostPath,
} from "./post.cache";
import {
  createPost,
  deletePost,
  renderPostPreview,
  togglePostFavorite,
  togglePostLike,
  updatePost,
} from "./post.service";
import { parseCreatePostBody, parseUpdatePostBody } from "./post.validator";

function invalidateAfterContentWrite(postId?: string): void {
  invalidatePostsCache(postId);
  revalidatePostListPaths();
  if (postId) revalidatePostPath(postId);
}

export async function createPostAction(input: CreatePostDto): Promise<ActionResult<PostData>> {
  return runAction("Posts", async () => {
    await ensureNotRateLimited(`posts:create:${await clientIp()}`, RATE_LIMITS.postCreateByIp);
    const viewer = await requireAuthPayload();

    const dto = parseCreatePostBody(input);
    const post = await createPost({ ...dto, authorId: viewer.id });

    invalidateAfterContentWrite();
    return { ok: true, data: { post } };
  });
}

export async function updatePostAction(
  postId: string,
  input: UpdatePostDto,
): Promise<ActionResult<PostData>> {
  return runAction("Posts", async () => {
    const viewer = await requireAuthPayload();
    const id = requireId(postId, "Post not found");

    const dto = parseUpdatePostBody(input);
    const post = await updatePost(id, dto, viewer.id);

    invalidateAfterContentWrite(id);
    return { ok: true, data: { post } };
  });
}

export async function deletePostAction(postId: string): Promise<ActionResult<null>> {
  return runAction("Posts", async () => {
    const viewer = await requireAuthPayload();
    const id = requireId(postId, "Post not found");

    await deletePost(id, viewer.id);

    invalidateAfterContentWrite(id);
    return { ok: true, data: null };
  });
}

export async function toggleLikeAction(postId: string): Promise<ActionResult<LikeToggleData>> {
  return runAction("Interaction", async () => {
    await ensureNotRateLimited(`posts:like:${await clientIp()}`, RATE_LIMITS.postReactByIp);
    const viewer = await requireAuthPayload();
    const id = requireId(postId, "Post not found");

    const data = await togglePostLike(id, viewer.id);

    invalidatePostCache(id);
    revalidatePostPath(id);
    return { ok: true, data };
  });
}

export async function toggleFavoriteAction(
  postId: string,
): Promise<ActionResult<FavoriteToggleData>> {
  return runAction("Interaction", async () => {
    await ensureNotRateLimited(`posts:favorite:${await clientIp()}`, RATE_LIMITS.postReactByIp);
    const viewer = await requireAuthPayload();
    const id = requireId(postId, "Post not found");

    const data = await togglePostFavorite(id, viewer.id);

    invalidatePostCache(id);
    revalidatePostPath(id);
    return { ok: true, data };
  });
}

export async function getUserPostStateAction(postId: string): Promise<ActionResult<UserPostState>> {
  return runAction("Interaction", async () => {
    const viewer = await getAuthPayload();
    if (!viewer) return { ok: true, data: { liked: false, favorited: false } };

    return {
      ok: true,
      data: await getUserPostState(viewer.id, requireId(postId, "Post not found")),
    };
  });
}

const PREVIEW_MAX_LENGTH = 200_000;

/**
 * 写作页实时预览：复用与公开文章页完全相同的渲染与白名单清洗。
 * 不要在客户端用 marked 自行渲染——那条路径没有 sanitize，且语言集与线上不一致。
 */
export async function renderPreviewAction(content: string): Promise<ActionResult<string>> {
  return runAction("Preview", async () => {
    await requireAuthPayload();
    const markdown = typeof content === "string" ? content.slice(0, PREVIEW_MAX_LENGTH) : "";
    return { ok: true, data: renderPostPreview(markdown) };
  });
}
