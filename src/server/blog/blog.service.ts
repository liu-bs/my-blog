/**
 * @file blog.service.ts
 * @description 文章领域核心业务层：负责文章的增删改查、草稿 / 发布状态流转、置顶与排序、
 * 浏览量 / 点赞 / 收藏的统计联动，以及 Markdown 正文的服务端渲染。
 * 所有涉及多表写入的操作都用 $transaction 包裹，保证文章数据与用户统计保持一致
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
import { getPrisma } from "@server/common/db";
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
 * 从 Markdown 正文生成摘要
 * @description 先剥离 Markdown 语法得到纯文本，再把连续空行折叠成空格，最后截断到 100 字符；
 * 超长时追加省略号。无有效内容时给出占位文案，保证列表卡片不会出现空摘要
 * @param content Markdown 原文
 * @returns 摘要纯文本
 */
function generateSummary(content: string): string {
  const plain = stripMarkdown(content)
    .replace(/\n{2,}/g, " ")
    .trim();
  if (!plain) return "(No content summary)";
  const summary = plain.slice(0, 100);
  return plain.length > 100 ? `${summary}...` : summary;
}

/**
 * 生成文章 ID
 * @description 采用「毫秒时间戳 + 8 位随机串」：时间戳让 ID 大致有序、便于排查，
 * 随机串避免同一毫秒内碰撞；生成后立即用 assertValidPostId 校验，防止非法字符进入 URL
 * @returns 合法且近乎唯一的文章 ID
 */
function generatePostId(): string {
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  assertValidPostId(id);
  return id;
}

/**
 * 归一化标签输入
 * @description 兼容前端传来的逗号分隔字符串或字符串数组；统一去空白、转小写后去重，
 * 最多保留 20 个，避免标签爆炸
 * @param input 原始标签输入，可为字符串、字符串数组或 undefined
 * @returns 去重后的标签数组
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
 * 校验封面图 URL 是否安全
 * @description 只允许 https 链接或站内 `/` 开头的路径，阻断 `javascript:`、`data:` 等危险协议；
 * 空值视为未设置封面，直接放行
 * @param value 封面图 URL
 * @throws UnprocessableEntityError URL 非法时抛出
 */
function validateCoverImage(value: string | undefined): void {
  if (value === undefined || value === "") return;
  if (!isSafeImageUrl(value)) {
    throw new UnprocessableEntityError(`Invalid cover image URL: ${IMAGE_URL_INVALID_MESSAGE}`);
  }
}

/**
 * 去除首尾空白并校验非空
 * @param value 原始文本
 * @param field 字段名，用于拼接错误信息
 * @returns 去除首尾空白后的文本
 * @throws ValidationError 去除空白后为空时抛出
 */
function normalizeText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  return trimmed;
}

/**
 * 校验当前用户是否为文章作者
 * @description 改动 / 删除文章前的鉴权：作者信息缺失视为不可操作，非作者一律拒绝
 * @param post 目标文章
 * @param currentUserId 当前登录用户 ID
 * @throws ForbiddenError 无作者信息或非本人时抛出
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
 * 对文章列表排序
 * @description 两种排序语义：
 * - 草稿模式：按 updatedAt 倒序，让「最近动过的草稿」排在最前，便于继续编辑；
 * - 发布模式：置顶优先，其次按发布时间倒序（publishedAt 缺失时回退 createdAt）。
 * sort 会原地修改数组，入参来自查询结果，无共享引用风险
 * @param posts 待排序的文章数组
 * @param isDraftMode 是否草稿模式
 * @returns 排序后的同一数组
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
 * 查询文章列表（带分页）
 * @description 可见性规则：草稿模式必须登录，否则直接返回空列表（而不是报错）；
 * 草稿模式只查当前用户自己的草稿。分页上限 `maxLimit` 区分调用来源——
 * 内部调用（internal=true，如缓存层 / 站点地图等需要一次性取全量）放宽到 20000，
 * 对外接口收紧到 100，避免被构造大 limit 拖库
 * @param options 列表查询条件，含草稿模式、过滤项、分页、当前用户与是否内部调用
 * @returns 分页结果 {@link PostsListData}
 */
export async function listPosts(options: ListPostsOptions): Promise<PostsListData> {
  const isDraftMode = options.draft === true;
  const hasUser = !!options.user;

  // 草稿列表属于私密数据，未登录直接返回空结果
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

  // isDraft 恒为布尔值参与过滤；草稿模式额外按当前作者收窄，其余条件为空时不下推
  const whereOpts = {
    isDraft: isDraftMode ? true : false,
    ...(isDraftMode && options.user ? { authorId: options.user!.id } : {}),
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
    ...(q ? { q } : {}),
  };

  // 列表与总数并行查询，二者共用同一组过滤条件
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
 * 查询单篇文章详情
 * @description 草稿只对作者本人可见：非作者（含未登录）统一按「文章不存在」处理，
 * 避免通过错误信息泄露草稿的存在。返回前把 Markdown 正文渲染成 HTML，
 * 同时保留 contentRaw 供编辑页回填
 * @param id 文章 ID
 * @param user 当前登录用户，可选；不传表示匿名访问
 * @returns 渲染后的文章领域模型
 * @throws NotFoundError 文章不存在，或草稿对当前访问者不可见
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
 * 记录一次文章浏览
 * @description 浏览量属于「可容忍最终一致」的统计：先同步确认文章存在且已发布，
 * 真正的计数写入放到 `after()` 回调中，在本响应发送之后再执行，
 * 从而不阻塞页面首字节返回。文章计数与作者累计浏览量在同一事务内 +1 保持一致
 * @param id 文章 ID
 */
export async function incrementView(id: string): Promise<void> {
  const post = await findPostStatus(id);
  if (!post || post.isDraft) return;

  const postId = post.id;
  const authorId = post.authorId;

  after(async () => {
    try {
      await getPrisma().$transaction(async (tx) => {
        await incrementPostField(postId, "views", 1, tx);
        if (authorId) {
          await incrementUserStats(authorId, "views", 1, tx);
        }
      });

      logger.info("View recorded", { postId });
    } catch (err) {
      // 计数失败不影响用户，仅记录日志，避免污染 after 回调
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
 * @description 状态流转要点：
 * - isDraft=true 时草稿不参与发布排序，pinned 强制为 false，且不写 publishedAt、不累加作者文章数；
 * - isDraft=false 时立即写入 publishedAt，并在事务中把作者统计的 articles +1。
 * 作者名以「姓名」优先、缺省回退用户名的快照形式冗余写入
 * @param dto 创建入参（已在 controller 层校验）+ 当前作者 ID
 * @returns 新建的文章领域模型
 * @throws ValidationError 标题 / 正文 / 分类为空
 * @throws UnprocessableEntityError 封面图 URL 非法
 * @throws NotFoundError 作者不存在
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
    // 草稿不允许置顶
    pinned: isDraft ? false : Boolean(dto.pinned),
    coverImage: dto.coverImage?.trim() || undefined,
    authorId: dto.authorId,
    authorName: `${author.firstName} ${author.lastName}`.trim() || author.username,
    views: 0,
    likes: 0,
    favorites: 0,
    commentsCount: 0,
  };

  // 直接发布才补发布时间
  if (!isDraft) {
    post.publishedAt = now;
  }

  // 建文章与作者文章数 +1 必须同事务，避免出现「有文章但统计没加」的脏数据
  await getPrisma().$transaction(async (tx) => {
    await createPostRecord(post, tx);

    if (!isDraft) {
      await incrementUserStats(dto.authorId, "articles", 1, tx);
    }
  });

  return post;
}

/**
 * 更新文章
 * @description 支持部分字段更新：未传入的字段沿用数据库原值。状态流转与统计联动是重点：
 * - 草稿 → 发布（wasDraft && !isDraft）：补写 publishedAt，作者 articles +1；
 * - 发布 → 草稿（!wasDraft && isDraft）：清空 publishedAt，作者 articles -1；
 * - 草稿状态下 pinned 一律强制为 false。
 * 摘要若显式传入则以其为准，否则仅在正文变更时重新生成。所有写入与统计调整在同一事务内
 * @param id 文章 ID
 * @param dto 局部更新入参
 * @param currentUserId 当前用户 ID，用于作者鉴权
 * @returns 更新后的文章领域模型
 * @throws NotFoundError 文章不存在
 * @throws ForbiddenError 非作者本人操作
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

  // 摘要优先级：显式传入 > 正文变更后重新生成 > 保留原值
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
    // 草稿状态下置顶无意义，强制关闭
    pinned: isDraft ? false : dto.pinned !== undefined ? Boolean(dto.pinned) : existing.pinned,
    coverImage: dto.coverImage !== undefined ? dto.coverImage.trim() || null : existing.coverImage,
    updatedAt: now,
  };

  // 草稿首次发布：补上发布时间
  if (wasDraft && !isDraft) {
    updateData.publishedAt = now;
  }

  // 已发布文章退回草稿：清空发布时间
  if (!wasDraft && isDraft) {
    updateData.publishedAt = null;
  }

  return getPrisma().$transaction(async (tx) => {
    const updated = await updatePostRecord(id, updateData, tx);

    // 以「更新后的实际状态」判断是否跨越了草稿边界，据此增减作者文章数
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
 * @description 同一事务内完成删除与作者统计回退：已发布文章对应 articles -1；
 * 文章的历史获赞要按当前 likes 数从作者累计点赞中扣减，保证作者统计不残留。
 * 评论 / 点赞 / 收藏关联记录由数据库外键级联删除
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID，用于作者鉴权
 * @throws NotFoundError 文章不存在
 * @throws ForbiddenError 非作者本人操作
 */
export async function deletePost(id: string, currentUserId: string): Promise<void> {
  const post = await findPostById(id);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  assertPostOwner(post, currentUserId);

  await getPrisma().$transaction(async (tx) => {
    await deletePostRecord(id, tx);
    if (post.authorId) {
      // 草稿本就不计入文章数，无需回退
      if (!post.isDraft) {
        await incrementUserStats(post.authorId, "articles", -1, tx);
      }

      // 扣减该文章为作者累计的点赞数
      if (post.likes > 0) {
        await incrementUserStats(post.authorId, "likes", -post.likes, tx);
      }
    }
  });
}

/**
 * 切换点赞状态（幂等 toggle）
 * @description 已赞则取消、未赞则点赞；返回值经 `!wasPresent` 换算成「操作后的点赞状态」
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID
 * @returns `{ liked }` 操作后的点赞状态与文章最新点赞总数
 */
export async function likePost(
  id: string,
  currentUserId: string,
): Promise<{ liked: boolean; likes: number }> {
  const result = await toggleUserPostAssociation(id, currentUserId, "likedArticles", "likes");
  return { liked: !result.wasPresent, likes: result.count };
}

/**
 * 切换收藏状态（幂等 toggle）
 * @description 已收藏则取消、未收藏则收藏；收藏不影响作者累计点赞，仅更新文章收藏数
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID
 * @returns `{ favorited }` 操作后的收藏状态与文章最新收藏总数
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
 * 点赞 / 收藏的通用幂等切换实现
 * @description 一次事务内完成三件事，保证「用户关联记录」「文章计数」「作者统计」三者一致：
 * 1. 在 UserPostLike / UserPostFavorite 关联表上做 toggle（底层先删后增，返回切换前是否存在）；
 * 2. 按 delta（存在则 -1、不存在则 +1）原子增减文章对应计数；
 * 3. 仅点赞会联动作者累计点赞（收藏不计入作者统计），且作者已注销（authorId 为空）时跳过。
 * 草稿文章不可交互，且关联记录与文章计数必须在同一事务，避免出现「已取消点赞但计数没减」的中间态
 * @param id 文章 ID
 * @param currentUserId 当前用户 ID
 * @param userField 用户侧关联字段，决定操作点赞还是收藏
 * @param postField 文章侧计数字段，与 userField 对应
 * @returns `{ wasPresent, count, authorId }`：切换前是否已存在、文章最新计数、作者 ID
 * @throws NotFoundError 文章不存在
 * @throws ForbiddenError 对草稿文章操作
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
  // 仅点赞需要同步作者累计点赞，收藏不进入作者统计
  const tracksAuthorStats = userField === "likedArticles";

  return getPrisma().$transaction(async (tx) => {
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
 * 查询当前用户收藏的文章
 * @description 收藏关系存在用户的 favoritedArticles 关联上，先取 ID 集合再批量查已发布文章，
 * 最后按「置顶优先 + 发布时间倒序」排序；无收藏时直接返回空数组省一次查询
 * @param currentUserId 当前用户 ID
 * @returns 收藏的文章列表（不含正文）
 * @throws NotFoundError 用户不存在
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
 * 查询某个作者的全部已发布文章
 * @description 公开主页用，只取已发布内容并沿用统一的发布排序规则
 * @param authorId 作者用户 ID
 * @returns 该作者的文章列表（不含正文）
 */
export async function listPostsByAuthor(authorId: string): Promise<Post[]> {
  const posts = await findPosts({ authorId, isDraft: false });
  return sortPosts(posts, false);
}

/**
 * 查询当前用户对某篇文章的点赞 / 收藏状态
 * @description 供详情页初始化交互按钮的选中态，避免用户刷新后状态丢失
 * @param postId 文章 ID
 * @param userId 当前用户 ID
 * @returns `{ liked, favorited }`
 */
export async function getMyPostState(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; favorited: boolean }> {
  return findUserPostState(userId, postId);
}

/**
 * 查询文章的上一篇 / 下一篇
 * @description 先取当前文章以获得排序基准时间，再把 publishedAt（缺失则 createdAt）传给 Repository 做相邻判定；
 * 文章不存在时返回空结果而非报错，供详情页容错展示
 * @param id 文章 ID
 * @returns `{ prev, next }`，无相邻文章时为 null
 */
export async function getNeighborPosts(
  id: string,
): Promise<{ prev: Post | null; next: Post | null }> {
  const post = await findPostById(id);
  if (!post) return { prev: null, next: null };
  return findNeighborPosts(id, post.publishedAt ?? null, post.createdAt);
}

/**
 * 断言文章对指定读者可读
 * @description 评论等下游操作的前置校验：文章必须存在；草稿仅作者本人可访问，
 * 其他访问者按「不存在」处理以免泄露草稿
 * @param postId 文章 ID
 * @param userId 当前用户 ID，可选
 * @returns 文章的精简状态 `{ id }`
 * @throws NotFoundError 文章不存在或草稿对当前用户不可见
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
 * 断言文章允许评论
 * @description 评论接口的前置校验：文章须存在且不得为草稿
 * @param postId 文章 ID
 * @throws NotFoundError 文章不存在
 * @throws ForbiddenError 文章为草稿
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
 * 解析旧文章 ID 到当前 ID
 * @description ID 规则迁移后用于兼容历史链接：若入参本身已是合法的新 ID，则无需映射直接返回 null；
 * 否则查询 PostIdMap，并再次校验映射结果合法，避免脏映射把非法 ID 带入后续流程
 * @param oldId 历史 / 旧格式文章 ID
 * @returns 对应的当前合法 ID；无需或无法映射时返回 null
 */
export async function findRenamedPostId(oldId: string): Promise<string | null> {
  if (isValidPostId(oldId)) return null;
  const newId = await findRenamedPostIdInDb(oldId);
  return newId && isValidPostId(newId) ? newId : null;
}

/**
 * 同步文章的作者名快照
 * @description 用户改资料 / 改名后由 user 领域调用，把该作者名下所有文章的冗余 authorName 批量刷新，
 * 避免列表展示出现旧的作者名
 * @param userId 作者用户 ID
 * @param authorName 新的作者展示名
 */
export async function syncPostAuthorName(userId: string, authorName: string): Promise<void> {
  await updatePostAuthorName(userId, authorName);
}

export type { NeighborPostsData };
