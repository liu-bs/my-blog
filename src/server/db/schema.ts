import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsCol = (name: string) => timestamp(name, { mode: "date", precision: 3 });

export const users = pgTable(
  "users",
  (_) => ({
    id: text("id").notNull().primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    username: text("username").notNull(),
    avatar: text("avatar").notNull().default(""),
    coverImage: text("cover_image").notNull().default(""),
    bio: text("bio").notNull().default(""),
    location: text("location").notNull().default(""),
    website: text("website").notNull().default(""),
    joined: tsCol("joined").notNull(),
    role: text("role").notNull().default("Writer"),
    company: text("company").notNull().default(""),
    verified: boolean("verified").notNull().default(false),
    disabled: boolean("disabled").notNull().default(false),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    socialTwitter: text("social_twitter").notNull().default(""),
    socialGithub: text("social_github").notNull().default(""),
    socialLinkedin: text("social_linkedin").notNull().default(""),

    statsArticles: integer("stats_articles").notNull().default(0),
    statsLikes: integer("stats_likes").notNull().default(0),
    statsViews: integer("stats_views").notNull().default(0),

    password: text("password"),
    tokenVersion: integer("token_version").notNull().default(0),

    createdAt: tsCol("created_at").notNull(),
    updatedAt: tsCol("updated_at").notNull(),
  }),
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    uniqueIndex("users_username_key").on(t.username),
  ],
);

export const posts = pgTable(
  "posts",
  (_) => ({
    id: text("id").notNull().primaryKey(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull(),
    tags: text("tags").array().notNull(),
    createdAt: tsCol("created_at").notNull(),
    updatedAt: tsCol("updated_at").notNull(),
    publishedAt: tsCol("published_at"),
    isDraft: boolean("is_draft").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    coverImage: text("cover_image"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name"),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    favorites: integer("favorites").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
  }),
  (t) => [
    index("posts_category_idx").on(t.category),
    index("posts_author_id_idx").on(t.authorId),
    index("posts_published_at_idx").on(t.publishedAt),
    index("posts_is_draft_published_at_idx").on(t.isDraft, t.publishedAt),
    index("posts_created_at_idx").on(t.createdAt),
    index("posts_tags_idx").using("gin", t.tags),

    index("posts_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
    index("posts_content_trgm_idx").using("gin", sql`${t.content} gin_trgm_ops`),
  ],
);

export const userPostLikes = pgTable(
  "user_post_likes",
  (_) => ({
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const userPostFavorites = pgTable(
  "user_post_favorites",
  (_) => ({
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
  }),
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const comments = pgTable(
  "comments",
  (_) => ({
    id: text("id").notNull().primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userName: text("user_name").notNull(),
    userAvatar: text("user_avatar"),
    content: text("content").notNull(),
    createdAt: tsCol("created_at").notNull(),
    updatedAt: tsCol("updated_at").notNull(),
  }),
  (t) => [index("comments_post_id_idx").on(t.postId), index("comments_user_id_idx").on(t.userId)],
);

export const rateLimits = pgTable(
  "rate_limits",
  (_) => ({
    id: text("id").notNull().primaryKey(),
    count: integer("count").notNull().default(0),
    expiresAt: tsCol("expires_at").notNull(),
  }),
  (t) => [index("rate_limits_expires_at_idx").on(t.expiresAt)],
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type PostRow = typeof posts.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
