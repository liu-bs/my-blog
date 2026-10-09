import "server-only";

/**
 * @file 博客域业务服务层
 * @description 文章 CRUD、点赞/收藏、浏览计数与读权限断言的业务逻辑；位于 controller（Server Action）
 * 与 blog.repository（Prisma）之间。所有跨表计数变更（文章计数 + 作者统计）都包在 runInTransaction 事务内；
 * 浏览量写入通过 next/server 的 after() 延后到响应之后，不阻塞渲染。
 */

import { randomUUID } from "node:crypto";
import { after } from "next/server";

import type { Post } from "@shared";
import {
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
  ForbiddenError,
} from "@server/common/errors";
import { logger } from "@server/common/logger";
import type {
  CreatePostDto,
  ListPostsOptions,
  PostsListData,
  UpdatePostDto,
  NeighborPostsData,
} from "@shared";
import {
  IMAGE_URL_INVALID_MESSAGE,
  assertValidPostId,
  isSafeImageUrl,
  isValidPostId,
} from "@shared";
import { stripMarkdown } from "@shared/markdown";
import { joinName } from "@shared/format";
import { runInTransaction } from "@server/common/db";
import { renderMarkdown } from "./markdown.service";
import type { PostUpdateData } from "./blog.repository";
import {
  findPostById,
  findPosts,
  countPosts,
  createPostRecord,
  updatePostRecord,
  deletePostRecord,
  incrementPostField,
  findRenamedPostId as findRenamedPostIdInDb,
  findNeighborPosts,
  findPostStatus,
  updatePostAuthorName,
} from "./blog.repository";
import {
  findUserById,
  findUserPostState,
  incrementUserStats,
  toggleUserAssociation,
} from "@server/user/user.repository";

/** 由 Markdown 正文生成纯文本摘要：剥掉标记、压缩空行，截断 100 字符加省略号 */
function generateSummary(content: string): string {
  const plain = stripMarkdown(content)
    .replace(/\n{2,}/g, " ")
    .trim();
  if (!plain) return "(No content summary)";
  const summary = plain.slice(0, 100);
  return plain.length > 100 ? `${summary}...` : summary;
}

/** 生成文章 ID：时间戳 + UUID 前 8 位（可读且单调倾向），落库前断言符合 ID 格式规范 */
function generatePostId(): string {
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  assertValidPostId(id);
  return id;
}

/** 归一化标签输入：字符串按逗号切分或数组直取，trim + 转小写 + 去重，最多保留 20 个 */
function parseTags(input: string | string[] | undefined): string[] {
  if (input === undefined || input === null) return [];
  const rawArray = Array.isArray(input) ? input : input.split(",");
  const tags = [
    ...new Set(rawArray.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)),
  ].slice(0, 20);
  return tags;
}

/** 封面 URL 安全校验：空值放行，非法协议/域名抛 422（防 XSS 与外链注入） */
function validateCoverImage(value: string | undefined): void {
  if (value === undefined || value === "") return;
  if (!isSafeImageUrl(value)) {
    throw new UnprocessableEntityError(`Invalid cover image URL: ${IMAGE_URL_INVALID_MESSAGE}`);
  }
}

/** trim 必填文本字段，全空白视为缺失抛 400 */
function normalizeText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  return trimmed;
}

/** 所有权断言：无作者信息或作者不匹配均抛 403 */
function assertPostOwner(post: Post, currentUserId: string): void {
  if (!post.authorId) {
    throw new ForbiddenError("This post has no author info, cannot perform action");
  }
  if (post.authorId !== currentUserId) {
    throw new ForbiddenError("Not authorized to modify this post");
  }
}

/** 内存排序：草稿按更新时间倒序；已发布按置顶优先、发布时间（缺失回退创建时间）倒序 */
function sortPosts(posts: Post[], isDraftMode: boolean): Post[] {
  if (isDraftMode) {
    return posts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return posts.sort((a, b) => {
    const pinnedA = a.pinned ? 1 : 0;
    const pinnedB = b.pinned ? 1 : 0;
    if (pinnedA !== pinnedB) return pinnedB - pinnedA;
    const pa = a.publishedAt || a.createdAt;
    const pb = b.publishedAt || b.createdAt;
    return pb.localeCompare(pa);
  });
}

/**
 * 文章列表查询（分页 + 分类/标签/关键词过滤 + 草稿模式）
 * @param options 列表选项；user 决定草稿可见性，internal=true 时放开 limit 上限到 20000（服务端全量场景）
 * @returns 分页结构 { posts, total, page, limit, totalPages }
 * @warning 非 internal 时 limit 被钳制在 1..100；匿名访问草稿列表直接返回空而非 401
 */
export async function listPosts(options: ListPostsOptions): Promise<PostsListData> {
  const isDraftMode = options.draft === true;
  const hasUser = !!options.user;

  if (isDraftMode && !hasUser) {
    return {
      posts: [],
      total: 0,
      page: options.page ?? 1,
      limit: options.limit ?? 10,
      totalPages: 0,
    };
  }

  const maxLimit = options.internal ? 20000 : 100;
  const limit = Math.min(maxLimit, Math.max(1, options.limit ?? 10));
  const page = Math.max(1, options.page ?? 1);
  // 页码从 1 开始，换算为 Prisma skip 偏移量
  const skip = (page - 1) * limit;

  const category = options.category?.trim();
  const tag = options.tag?.trim();
  const q = options.q?.trim();

  const whereOpts = {
    isDraft: isDraftMode ? true : false,
    ...(isDraftMode && options.user ? { authorId: options.user!.id } : {}),
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
    ...(q ? { q } : {}),
  };

  const [posts, total] = await Promise.all([
    findPosts({
      ...whereOpts,
      orderBy: isDraftMode
        ? { field: "updatedAt", direction: "desc" }
        : { field: "publishedAt", direction: "desc" },
      pinnedFirst: !isDraftMode,
      skip,
      take: limit,
    }),
    countPosts(whereOpts),
  ]);

  return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * 读取单篇文章：正文渲染为 HTML，原文保留在 contentRaw 供编辑器使用
 * @param id 文章 ID
 * @param user 可选当前用户（草稿仅作者可见）
 * @returns 含渲染正文与原始 Markdown 的文章数据
 * @throws NotFoundError——文章不存在（404）；草稿且访问者非作者也报 404（不暴露草稿存在性）
 */
export async function getPost(id: string, user?: { id: string }): Promise<Post> {
  const post = await findPostById(id);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  if (post.isDraft) {
    if (!user || user.id !== post.authorId) {
      throw new NotFoundError("Post not found");
    }
  }

  return {
    ...post,
    content: renderMarkdown(post.content),
    contentRaw: post.content,
  };
}

/**
 * 记录一次浏览：草稿不计数；实际写库经 after() 延迟到响应发出之后，不阻塞页面渲染
 * @param id 文章 ID
 * @warning 事务同时递增文章 views 与作者 stats.views；写失败只记日志，静默丢失单次计数
 */
export async function incrementView(id: string): Promise<void> {
  const post = await findPostStatus(id);
  if (!post || post.isDraft) return;

  const postId = post.id;
  const authorId = post.authorId;

  after(async () => {
    try {
      await runInTransaction(async (tx) => {
        await incrementPostField(postId, "views", 1, tx);
        if (authorId) {
          await incrementUserStats(authorId, "views", 1, tx);
        }
      });

      logger.info("View recorded", { postId });
    } catch (err) {
      logger.error("Failed to record view count", {
        postId,
        authorId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * 创建文章
 * @description 归一化文本/标签/摘要 → 校验封面与作者 → 事务内落库；直接发布（非草稿）时同步递增作者 articles 统计
 * @param dto 创建参数 + 服务端注入的 authorId
 * @returns 新文章数据（ID 已生成）
 * @throws ValidationError——必填文本为空（400）；UnprocessableEntityError——封面 URL 非法（422）；NotFoundError——作者不存在（404）
 * @warning 文章落库与作者统计在同一事务内，要么同时成功；草稿发布态切换见 updatePost 的对称处理
 */
export async function createPost(dto: CreatePostDto & { authorId: string }): Promise<Post> {
  const title = normalizeText(dto.title, "title");
  const content = normalizeText(dto.content, "content");
  const category = normalizeText(dto.category, "category");
  validateCoverImage(dto.coverImage);

  const author = await findUserById(dto.authorId);
  if (!author) {
    throw new NotFoundError("Author not found");
  }

  const now = new Date().toISOString();
  const tags = parseTags(dto.tags);
  const summary = dto.summary?.trim() || generateSummary(content);
  const isDraft = Boolean(dto.isDraft);

  const post: Post = {
    id: generatePostId(),
    title,
    summary,
    content,
    category,
    tags,
    createdAt: now,
    updatedAt: now,
    isDraft,

    pinned: isDraft ? false : Boolean(dto.pinned),
    coverImage: dto.coverImage?.trim() || undefined,
    authorId: dto.authorId,
    authorName: joinName(author.firstName, author.lastName) || author.username,
    views: 0,
    likes: 0,
    favorites: 0,
    commentsCount: 0,
  };

  if (!isDraft) {
    post.publishedAt = now;
  }

  await runInTransaction(async (tx) => {
    await createPostRecord(post, tx);

    if (!isDraft) {
      await incrementUserStats(dto.authorId, "articles", 1, tx);
    }
  });

  return post;
}

/**
 * 更新文章（局部更新，含草稿/发布切换）
 * @description 先断言所有权；仅传入的字段被覆盖，content 变更且未显式给 summary 时自动重生成摘要
 * @param id 文章 ID
 * @param dto 更新参数
 * @param currentUserId 当前用户 ID（须为作者）
 * @returns 更新后的文章完整记录
 * @throws NotFoundError——文章不存在（404）；ForbiddenError——非本人文章（403）；ValidationError/UnprocessableEntityError 同 createPost
 * @warning 草稿↔发布切换在同一事务内同步加减作者 articles 统计并设置/清空 publishedAt，防止计数漂移
 */
export async function updatePost(
  id: string,
  dto: UpdatePostDto,
  currentUserId: string,
): Promise<Post> {
  const existing = await findPostById(id);
  if (!existing) {
    throw new NotFoundError("Post not found");
  }
  assertPostOwner(existing, currentUserId);

  const title = dto.title !== undefined ? normalizeText(dto.title, "title") : existing.title;
  const content =
    dto.content !== undefined ? normalizeText(dto.content, "content") : existing.content;
  const category =
    dto.category !== undefined ? normalizeText(dto.category, "category") : existing.category;

  if (dto.coverImage !== undefined) {
    validateCoverImage(dto.coverImage);
  }

  const isDraft = dto.isDraft !== undefined ? Boolean(dto.isDraft) : existing.isDraft;
  const wasDraft = existing.isDraft;

  let summary = existing.summary;
  if (dto.summary !== undefined) {
    summary = dto.summary.trim();
  } else if (dto.content !== undefined) {
    summary = generateSummary(content);
  }

  const now = new Date().toISOString();

  const updateData: PostUpdateData = {
    title,
    content,
    category,
    summary,
    tags: dto.tags !== undefined ? parseTags(dto.tags) : existing.tags,
    isDraft,

    pinned: isDraft ? false : dto.pinned !== undefined ? Boolean(dto.pinned) : existing.pinned,
    coverImage: dto.coverImage !== undefined ? dto.coverImage.trim() || null : existing.coverImage,
    updatedAt: now,
  };

  // 草稿↔发布切换维护发布时间：首次发布盖上 now，撤回草稿则清空
  if (wasDraft && !isDraft) {
    updateData.publishedAt = now;
  }

  if (!wasDraft && isDraft) {
    updateData.publishedAt = null;
  }

  return runInTransaction(async (tx) => {
    const updated = await updatePostRecord(id, updateData, tx);

    if (wasDraft && !updated.isDraft) {
      if (existing.authorId) {
        await incrementUserStats(existing.authorId, "articles", 1, tx);
      }
    } else if (!wasDraft && updated.isDraft) {
      if (existing.authorId) {
        await incrementUserStats(existing.authorId, "articles", -1, tx);
      }
    }
    return updated;
  });
}

/**
 * 删除文章
 * @description 断言所有权后事务删除；已发布文章回退作者 articles 计数，likes>0 时同步回退作者 likes 统计
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID（须为作者）
 * @throws NotFoundError——文章不存在（404）；ForbiddenError——非本人文章（403）
 */
export async function deletePost(id: string, currentUserId: string): Promise<void> {
  const post = await findPostById(id);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  assertPostOwner(post, currentUserId);

  await runInTransaction(async (tx) => {
    await deletePostRecord(id, tx);
    if (post.authorId) {
      if (!post.isDraft) {
        await incrementUserStats(post.authorId, "articles", -1, tx);
      }

      if (post.likes > 0) {
        await incrementUserStats(post.authorId, "likes", -post.likes, tx);
      }
    }
  });
}

/**
 * 点赞切换（已点则取消，未点则点赞）
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID
 * @returns 切换后的 liked 状态与最新点赞总数
 * @throws NotFoundError（404）、ForbiddenError——草稿或无作者（403）
 */
export async function likePost(
  id: string,
  currentUserId: string,
): Promise<{ liked: boolean; likes: number }> {
  const result = await toggleUserPostAssociation(id, currentUserId, "likedArticles", "likes");
  return { liked: !result.wasPresent, likes: result.count };
}

/**
 * 收藏切换（已藏则取消，未藏则收藏）
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID
 * @returns 切换后的 favorited 状态与最新收藏总数
 * @throws NotFoundError（404）、ForbiddenError——草稿（403）
 */
export async function toggleFavorite(
  id: string,
  currentUserId: string,
): Promise<{ favorited: boolean; favorites: number }> {
  const result = await toggleUserPostAssociation(
    id,
    currentUserId,
    "favoritedArticles",
    "favorites",
  );
  return { favorited: !result.wasPresent, favorites: result.count };
}

/**
 * 点赞/收藏共用的关联切换：事务内原子完成 关联表翻转 → 文章计数增减 →（仅点赞）作者 likes 统计增减
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID
 * @param userField 用户侧关联集合字段（决定读写点赞表还是收藏表）
 * @param postField 文章侧计数字段
 * @returns wasPresent（切换前是否已存在关联）、切换后的最新计数、作者 ID
 * @throws NotFoundError——文章不存在（404）；ForbiddenError——草稿不可交互（403）
 * @warning 三步写库同在一个事务内回滚，任一失败不会出现"有关联无计数"的漂移
 */
async function toggleUserPostAssociation(
  id: string,
  currentUserId: string,
  userField: "likedArticles" | "favoritedArticles",
  postField: "likes" | "favorites",
): Promise<{ wasPresent: boolean; count: number; authorId?: string }> {
  const post = await findPostStatus(id);
  if (!post) throw new NotFoundError("Post not found");
  if (post.isDraft) throw new ForbiddenError("Cannot perform action on draft post");

  const authorId = post.authorId;

  // 只有点赞需要回写作者的 likes 统计，收藏不影响作者数字
  const tracksAuthorStats = userField === "likedArticles";

  return runInTransaction(async (tx) => {
    const wasPresent = await toggleUserAssociation(currentUserId, userField, id, tx);
    const delta = wasPresent ? -1 : 1;

    const count = await incrementPostField(id, postField, delta, tx);

    if (tracksAuthorStats && authorId) {
      await incrementUserStats(authorId, "likes", delta, tx);
    }

    return { wasPresent, count, authorId: authorId ?? undefined };
  });
}

/**
 * 当前用户的收藏文章列表（不含草稿，置顶优先按发布时间排序）
 * @param currentUserId 当前用户 ID
 * @returns 收藏的文章列表
 * @throws NotFoundError——用户不存在（404）
 */
export async function listFavoritePosts(currentUserId: string): Promise<Post[]> {
  const user = await findUserById(currentUserId, { withAssociations: true });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  const favoritedIds = user.favoritedArticles ?? [];
  if (favoritedIds.length === 0) {
    return [];
  }

  const posts = await findPosts({ ids: favoritedIds, isDraft: false });
  return sortPosts(posts, false);
}

/**
 * 指定作者的已发布文章列表（作者主页用）
 * @param authorId 作者用户 ID
 * @returns 按发布时间倒序、置顶优先的文章列表
 */
export async function listPostsByAuthor(authorId: string): Promise<Post[]> {
  const posts = await findPosts({ authorId, isDraft: false });
  return sortPosts(posts, false);
}

/**
 * 查询当前用户对某文章的点赞/收藏状态
 * @param postId 文章 ID
 * @param userId 当前用户 ID
 * @returns liked 与 favorited 两个布尔状态
 */
export async function getMyPostState(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; favorited: boolean }> {
  return findUserPostState(userId, postId);
}

/**
 * 上一篇/下一篇：文章不存在时返回双 null（不抛错，缓存路径容忍）
 * @param id 当前文章 ID
 * @returns prev/next 邻居文章数据
 */
export async function getNeighborPosts(
  id: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const post = await findPostById(id);
  if (!post) return { prev: null, next: null };
  return findNeighborPosts(id, post.publishedAt ?? null, post.createdAt);
}

/**
 * 读权限断言：文章须存在；草稿仅作者可读，其他人一律 404（不泄露草稿存在性）
 * @param postId 文章 ID
 * @param userId 可选当前用户 ID
 * @returns 含 id/isDraft/authorId 的状态对象
 * @throws NotFoundError——不存在或无权读取（404）
 */
export async function assertPostReadable(postId: string, userId?: string): Promise<{ id: string }> {
  const post = await findPostStatus(postId);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  if (post.isDraft && post.authorId !== userId) {
    throw new NotFoundError("Post not found");
  }
  return post;
}

/**
 * 评论前置断言：文章须存在且非草稿
 * @param postId 文章 ID
 * @throws NotFoundError——文章不存在（404）；ForbiddenError——草稿不可评论（403）
 */
export async function assertPostCommentable(postId: string): Promise<void> {
  const post = await findPostStatus(postId);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  if (post.isDraft) {
    throw new ForbiddenError("Cannot comment on draft posts");
  }
}

/**
 * 旧 ID 重命名映射查询：仅当传入 ID 不合法时才查映射表，且新 ID 也须合法才返回
 * @param oldId 请求中的（可能过时的）文章 ID
 * @returns 有效的新文章 ID；无有效映射时 null
 */
export async function findRenamedPostId(oldId: string): Promise<string | null> {
  if (isValidPostId(oldId)) return null;
  const newId = await findRenamedPostIdInDb(oldId);
  return newId && isValidPostId(newId) ? newId : null;
}

/**
 * 同步某作者所有文章的 authorName 冗余字段（用户改名后由 auth.service.updateProfile 级联调用）
 * @param userId 作者用户 ID
 * @param authorName 新的展示名
 */
export async function syncPostAuthorName(userId: string, authorName: string): Promise<void> {
  await updatePostAuthorName(userId, authorName);
}

export type { NeighborPostsData };
