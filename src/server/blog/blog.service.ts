/**
 * @file blog.service.ts
 * @description 文章业务服务层。实现列表查询（含草稿可见性判定）、单篇读取（markdown 渲染）、
 * 增删改（仅作者可操作，事务内同步作者发文/获赞统计）、点赞/收藏 toggle（事务内原子切换
 * 用户关联 + 文章计数 + 作者获赞统计）、浏览量异步自增（after() 不阻塞响应）及相邻文章等辅助查询。
 */
import "server-only";

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
import { stripMarkdown } from "@/lib/markdown";
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

/**
 * 从 markdown 原文提取纯文本生成摘要（≤100 字符，超长补省略号）
 * @param content markdown 原文
 * @returns 摘要文本，无有效内容时返回占位文案
 */
function generateSummary(content: string): string {
  const plain = stripMarkdown(content)
    .replace(/\n{2,}/g, " ")
    .trim();
  if (!plain) return "(No content summary)";
  const summary = plain.slice(0, 100);
  return plain.length > 100 ? `${summary}...` : summary;
}

/** 生成文章 id：时间戳 + 8 位 UUID 片段，生成后做合法性断言 */
function generatePostId(): string {
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  assertValidPostId(id);
  return id;
}

/**
 * 规整标签输入：兼容逗号分隔字符串或数组，去空白、转小写、去重，最多保留 20 个
 * @param input 原始标签输入
 * @returns 规整后的标签数组
 */
function parseTags(input: string | string[] | undefined): string[] {
  if (input === undefined || input === null) return [];
  const rawArray = Array.isArray(input) ? input : input.split(",");
  const tags = [
    ...new Set(rawArray.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)),
  ].slice(0, 20);
  return tags;
}

/**
 * 校验封面图 URL 安全性（协议与域名白名单）
 * @param value 封面图地址，空/undefined 跳过
 * @throws 不安全 URL 抛出 UnprocessableEntityError
 */
function validateCoverImage(value: string | undefined): void {
  if (value === undefined || value === "") return;
  if (!isSafeImageUrl(value)) {
    throw new UnprocessableEntityError(`Invalid cover image URL: ${IMAGE_URL_INVALID_MESSAGE}`);
  }
}

/**
 * 校验并规整必填文本字段（去空白，空值抛错）
 * @param value 原始值
 * @param field 字段名（用于错误提示）
 * @returns 规整后的文本
 * @throws 去空白后为空抛 ValidationError
 */
function normalizeText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  return trimmed;
}

/**
 * 校验当前用户是否为文章作者（写操作前置权限断言）
 * @param post 目标文章
 * @param currentUserId 当前登录用户 id
 * @throws 文章无作者信息或非作者本人时抛 ForbiddenError
 */
function assertPostOwner(post: Post, currentUserId: string): void {
  if (!post.authorId) {
    throw new ForbiddenError("This post has no author info, cannot perform action");
  }
  if (post.authorId !== currentUserId) {
    throw new ForbiddenError("Not authorized to modify this post");
  }
}

/**
 * 列表内存排序：草稿模式按更新时间倒序；公开模式置顶优先，其余按发布时间（缺省回退创建时间）倒序
 * @param posts 待排序文章数组（原地排序）
 * @param isDraftMode 是否草稿模式
 * @returns 排序后的数组（原引用）
 */
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
 * 分页查询文章列表
 * 草稿模式必须携带登录用户（只看本人草稿）；internal 调用放宽单页上限以支持全量拉取
 * @param options 列表查询选项（草稿/分类/标签/搜索/分页/调用方）
 * @returns 列表数据（含总数与分页信息）
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
 * 按 id 读取单篇文章：草稿仅作者本人可见（对非作者统一报 404 不暴露存在性）；
 * 返回的 content 为渲染后的 HTML，contentRaw 保留 markdown 原文
 * @param id 文章 id
 * @param user 可选的当前登录用户
 * @returns 文章数据
 * @throws 不存在或不可见时抛 NotFoundError
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
 * 浏览量自增：仅对已发布文章生效
 * 通过 next/server 的 after() 在响应返回后异步写库（文章浏览数 +1、作者浏览统计 +1），
 * 不阻塞页面响应；草稿或不存在时静默忽略，写库失败仅记日志
 * @param id 文章 id
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
 * 创建文章：规整标题/内容/分类、校验封面图、生成 id 与摘要后落库；
 * 非草稿发布时记录 publishedAt 并在同一事务内给作者发文数 +1
 * @param dto 已校验的创建数据（含作者 id）
 * @returns 创建后的 Post
 * @throws 作者不存在抛 NotFoundError；必填字段为空抛 ValidationError；封面图非法抛 UnprocessableEntityError
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
    authorName: `${author.firstName} ${author.lastName}`.trim() || author.username,
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
 * 更新文章（仅作者可操作）：字段级合并更新，摘要随内容变化自动重生成；
 * 草稿↔发布互转时维护 publishedAt，并在事务内同步作者发文数 ±1
 * @param id 文章 id
 * @param dto 已校验的更新数据（undefined 字段保持不变）
 * @param currentUserId 当前登录用户 id
 * @returns 更新后的 Post
 * @throws 文章不存在抛 NotFoundError；非作者抛 ForbiddenError；必填字段清空抛 ValidationError
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
 * 删除文章（仅作者可操作）：事务内删除记录并回冲作者统计（非草稿发文数 -1、获赞数按剩余点赞数扣减）
 * @param id 文章 id
 * @param currentUserId 当前登录用户 id
 * @throws 文章不存在抛 NotFoundError；非作者抛 ForbiddenError
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
 * 切换当前用户对文章的点赞状态
 * @param id 文章 id
 * @param currentUserId 当前登录用户 id
 * @returns 点赞后的状态与文章最新点赞数
 */
export async function likePost(
  id: string,
  currentUserId: string,
): Promise<{ liked: boolean; likes: number }> {
  const result = await toggleUserPostAssociation(id, currentUserId, "likedArticles", "likes");
  return { liked: !result.wasPresent, likes: result.count };
}

/**
 * 切换当前用户对文章的收藏状态
 * @param id 文章 id
 * @param currentUserId 当前登录用户 id
 * @returns 收藏后的状态与文章最新收藏数
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
 * 点赞/收藏的共用事务核心
 * 事务内三步联动：toggle 用户关联表 → 增减文章对应计数字段 →
 * （仅点赞场景）同步增减作者 statsLikes；收藏不计入作者统计
 * @param id 文章 id
 * @param currentUserId 当前登录用户 id
 * @param userField 用户关联字段（点赞/收藏）
 * @param postField 文章计数字段（likes/favorites）
 * @returns wasPresent 是否为取消（原已关联）、count 最新计数、authorId 文章作者
 * @throws 文章不存在抛 NotFoundError；草稿不可互动抛 ForbiddenError
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
 * 查询当前用户收藏的文章列表（按公开列表排序规则排序）
 * @param currentUserId 当前登录用户 id
 * @returns 收藏的文章数组
 * @throws 用户不存在抛 NotFoundError
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

/** 查询指定作者的已发布文章（置顶优先，作者主页用） */
export async function listPostsByAuthor(authorId: string): Promise<Post[]> {
  const posts = await findPosts({ authorId, isDraft: false });
  return sortPosts(posts, false);
}

/**
 * 查询当前用户对某文章的点赞/收藏状态（供前端回显按钮态）
 * @param postId 文章 id
 * @param userId 用户 id
 */
export async function getMyPostState(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; favorited: boolean }> {
  return findUserPostState(userId, postId);
}

/**
 * 查询当前文章的前一篇/后一篇（按发布时间相邻）
 * @param id 当前文章 id
 * @returns 相邻文章，无则对应项为 null；文章不存在时两项均为 null
 */
export async function getNeighborPosts(
  id: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const post = await findPostById(id);
  if (!post) return { prev: null, next: null };
  return findNeighborPosts(id, post.publishedAt ?? null, post.createdAt);
}

/**
 * 断言文章对指定用户可读（互动/评论等场景的前置校验）
 * 草稿仅作者可读，对非作者统一报 404 不暴露存在性
 * @param postId 文章 id
 * @param userId 可选的当前用户 id
 * @returns 文章状态（id/authorId/isDraft）
 * @throws 不存在或不可读抛 NotFoundError
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
 * 断言文章可评论：必须存在且非草稿
 * @param postId 文章 id
 * @throws 不存在抛 NotFoundError；草稿抛 ForbiddenError
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
 * 旧格式文章 id 的新 id 查询（历史 id 迁移兼容）
 * @param oldId 旧文章 id
 * @returns 迁移后的新 id，无需迁移或迁移记录无效时为 null
 */
export async function findRenamedPostId(oldId: string): Promise<string | null> {
  if (isValidPostId(oldId)) return null;
  const newId = await findRenamedPostIdInDb(oldId);
  return newId && isValidPostId(newId) ? newId : null;
}

/**
 * 同步更新该作者全部文章的 authorName 冗余字段（用户改名后调用）
 * @param userId 作者用户 id
 * @param authorName 新作者名
 */
export async function syncPostAuthorName(userId: string, authorName: string): Promise<void> {
  await updatePostAuthorName(userId, authorName);
}

export type { NeighborPostsData };
