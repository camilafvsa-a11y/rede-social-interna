import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  authorId: integer("author_id").notNull(),
  channelId: integer("channel_id"),
  targetUserId: integer("target_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Social feed extensions
  isPinned: boolean("is_pinned").default(false),
  isHighlighted: boolean("is_highlighted").default(false),
  isOfficial: boolean("is_official").default(false),
  category: text("category"),
  shareCount: integer("share_count").default(0),
  saveCount: integer("save_count").default(0),
  viewCount: integer("view_count").default(0),
  sharedFromId: integer("shared_from_id"),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;

export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PostLike = typeof postLikesTable.$inferSelect;

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;

export const commentReportsTable = pgTable("comment_reports", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  reporterId: integer("reporter_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CommentReport = typeof commentReportsTable.$inferSelect;

// Multiple media items per post
export const postMediaTable = pgTable("post_media", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  mediaType: text("media_type").notNull(), // 'image' | 'video'
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  mediaOrder: integer("media_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PostMedia = typeof postMediaTable.$inferSelect;

// Saved/bookmarked posts
export const savedPostsTable = pgTable("saved_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
  savedAt: timestamp("saved_at").notNull().defaultNow(),
});

export type SavedPost = typeof savedPostsTable.$inferSelect;

// Post shares/reposts
export const postSharesTable = pgTable("post_shares", {
  id: serial("id").primaryKey(),
  originalPostId: integer("original_post_id").notNull(),
  userId: integer("user_id").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PostShare = typeof postSharesTable.$inferSelect;

// Post reports (moderation)
export const postReportsTable = pgTable("post_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  reporterId: integer("reporter_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("pending"), // 'pending' | 'reviewed' | 'dismissed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PostReport = typeof postReportsTable.$inferSelect;
