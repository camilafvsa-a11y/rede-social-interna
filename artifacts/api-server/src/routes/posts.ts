import { Router } from "express";
import { db, postsTable, postLikesTable, commentsTable, commentReportsTable, usersTable, channelsTable, channelAllowedPostersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, formatUserBasic } from "../lib/auth.js";

const router = Router();

async function enrichPost(post: any, userId: number) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, post.authorId)).limit(1);
  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, post.channelId)).limit(1);
  const [likeCountResult] = await db.select({ count: sql<number>`count(*)` }).from(postLikesTable).where(eq(postLikesTable.postId, post.id));
  const [commentCountResult] = await db.select({ count: sql<number>`count(*)` }).from(commentsTable).where(eq(commentsTable.postId, post.id));
  const [liked] = await db.select().from(postLikesTable).where(and(eq(postLikesTable.postId, post.id), eq(postLikesTable.userId, userId))).limit(1);

  return {
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl,
    authorId: post.authorId,
    author: author ? formatUserBasic(author) : { id: post.authorId, name: "Usuário", role: "user" },
    channelId: post.channelId,
    channel: channel ? { id: channel.id, name: channel.name, icon: channel.icon } : { id: post.channelId, name: "Canal" },
    likeCount: Number(likeCountResult?.count ?? 0),
    commentCount: Number(commentCountResult?.count ?? 0),
    likedByMe: !!liked,
    createdAt: post.createdAt?.toISOString?.() ?? post.createdAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { channelId, page = "1", limit = "20" } = req.query as { channelId?: string; page?: string; limit?: string };
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  let posts;
  if (channelId) {
    posts = await db.select().from(postsTable)
      .where(eq(postsTable.channelId, parseInt(channelId)))
      .orderBy(desc(postsTable.createdAt))
      .limit(limitNum).offset(offset);
  } else {
    const accessibleChannels = await db.select().from(channelsTable);
    const accessible = accessibleChannels
      .filter((ch) => {
        if (user.role === "admin" || user.role === "master_admin") return true;
        const tags = JSON.parse(ch.allowedTags || "[]");
        if (tags.length === 0) return true;
        return user.tag && tags.includes(user.tag);
      })
      .map((ch) => ch.id);

    if (accessible.length === 0) {
      res.json({ posts: [], total: 0, page: pageNum, hasMore: false }); return;
    }

    posts = await db.select().from(postsTable)
      .orderBy(desc(postsTable.createdAt))
      .limit(limitNum).offset(offset);
    posts = posts.filter((p) => accessible.includes(p.channelId));
  }

  const enriched = await Promise.all(posts.map((p) => enrichPost(p, user.id)));
  res.json({ posts: enriched, total: enriched.length, page: pageNum, hasMore: enriched.length === limitNum });
});

router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { content, imageUrl, channelId } = req.body;

  const [ch] = await db.select().from(channelsTable).where(eq(channelsTable.id, channelId)).limit(1);
  if (!ch) { res.status(404).json({ error: "Canal não encontrado" }); return; }

  if (ch.isInternalComm && user.role !== "admin" && user.role !== "master_admin") {
    const [poster] = await db.select().from(channelAllowedPostersTable)
      .where(and(eq(channelAllowedPostersTable.channelId, channelId), eq(channelAllowedPostersTable.userId, user.id))).limit(1);
    if (!poster) {
      res.status(403).json({ error: "Você não tem permissão para postar neste canal" }); return;
    }
  }

  const [post] = await db.insert(postsTable).values({ content, imageUrl, authorId: user.id, channelId }).returning();
  const enriched = await enrichPost(post, user.id);
  res.json(enriched);
});

router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, parseInt(id))).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(await enrichPost(post, user.id));
});

router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, parseInt(id))).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.authorId !== user.id && user.role !== "admin" && user.role !== "master_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(postsTable).where(eq(postsTable.id, parseInt(id)));
  res.json({ success: true, message: "Deleted" });
});

router.post("/:id/like", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const postId = parseInt(id);
  const [existing] = await db.select().from(postLikesTable).where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, user.id))).limit(1);

  if (existing) {
    await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, user.id)));
  } else {
    await db.insert(postLikesTable).values({ postId, userId: user.id });
  }

  const [likeCountResult] = await db.select({ count: sql<number>`count(*)` }).from(postLikesTable).where(eq(postLikesTable.postId, postId));
  res.json({ liked: !existing, likeCount: Number(likeCountResult?.count ?? 0) });
});

router.get("/:id/comments", requireAuth, async (req, res) => {
  const { id } = req.params;
  const comments = await db.select().from(commentsTable).where(eq(commentsTable.postId, parseInt(id)));
  const enriched = await Promise.all(comments.map(async (c) => {
    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, c.authorId)).limit(1);
    return {
      id: c.id,
      content: c.content,
      authorId: c.authorId,
      author: author ? formatUserBasic(author) : { id: c.authorId, name: "Usuário", role: "user" },
      postId: c.postId,
      createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
    };
  }));
  res.json(enriched);
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { content } = req.body;
  const [comment] = await db.insert(commentsTable).values({ content, postId: parseInt(id), authorId: user.id }).returning();
  res.json({
    id: comment.id,
    content: comment.content,
    authorId: comment.authorId,
    author: formatUserBasic(user),
    postId: comment.postId,
    createdAt: comment.createdAt?.toISOString?.() ?? comment.createdAt,
  });
});

router.delete("/comments/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, parseInt(id))).limit(1);
  if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
  if (comment.authorId !== user.id && user.role !== "admin" && user.role !== "master_admin" && user.role !== "moderator") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(commentsTable).where(eq(commentsTable.id, parseInt(id)));
  res.json({ success: true, message: "Deleted" });
});

router.post("/comments/:id/report", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { reason } = req.body;
  await db.insert(commentReportsTable).values({ commentId: parseInt(id), reporterId: user.id, reason });
  res.json({ success: true, message: "Reported" });
});

router.get("/reports/all", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "master_admin" && user.role !== "moderator") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const reports = await db.select().from(commentReportsTable);
  const enriched = await Promise.all(reports.map(async (r) => {
    const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, r.commentId)).limit(1);
    const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, r.reporterId)).limit(1);
    const commentAuthor = comment ? await db.select().from(usersTable).where(eq(usersTable.id, comment.authorId)).limit(1).then(([u]) => u) : null;
    return {
      id: r.id,
      commentId: r.commentId,
      comment: comment ? {
        id: comment.id, content: comment.content, authorId: comment.authorId,
        author: commentAuthor ? formatUserBasic(commentAuthor) : { id: comment.authorId, name: "Usuário", role: "user" },
        postId: comment.postId, createdAt: comment.createdAt?.toISOString?.() ?? comment.createdAt,
      } : null,
      reporterId: r.reporterId,
      reporter: reporter ? formatUserBasic(reporter) : { id: r.reporterId, name: "Usuário", role: "user" },
      reason: r.reason,
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    };
  }));
  res.json(enriched);
});

export default router;
