import { Router } from "express";
import {
  db, postsTable, postLikesTable, commentsTable, commentReportsTable,
  usersTable, channelsTable, channelAllowedPostersTable,
  postMediaTable, savedPostsTable, postSharesTable, postReportsTable,
} from "@workspace/db";
import { eq, and, sql, desc, or, ilike, inArray } from "drizzle-orm";
import { requireAuth, formatUserBasic } from "../lib/auth.js";
import { sendPushToUsers, parseMentions } from "../lib/push.js";
import { processGamificationEvent } from "./gamification.js";

const router = Router();

// ── Enrich a single post with all derived fields ─────────────────────────────
async function enrichPost(post: any, userId: number, includeSharedFrom = true): Promise<any> {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, post.authorId)).limit(1);
  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.id, post.channelId)).limit(1);
  const [likeCountResult] = await db.select({ count: sql<number>`count(*)` }).from(postLikesTable).where(eq(postLikesTable.postId, post.id));
  const [commentCountResult] = await db.select({ count: sql<number>`count(*)` }).from(commentsTable).where(eq(commentsTable.postId, post.id));
  const [liked] = await db.select().from(postLikesTable).where(and(eq(postLikesTable.postId, post.id), eq(postLikesTable.userId, userId))).limit(1);
  const [saved] = await db.select().from(savedPostsTable).where(and(eq(savedPostsTable.postId, post.id), eq(savedPostsTable.userId, userId))).limit(1);
  const media = await db.select().from(postMediaTable).where(eq(postMediaTable.postId, post.id)).then((rows) => rows.sort((a, b) => (a.mediaOrder ?? 0) - (b.mediaOrder ?? 0)));

  // If this post shares another, load that embedded post (one level deep)
  let sharedFrom = null;
  if (post.sharedFromId && includeSharedFrom) {
    const [orig] = await db.select().from(postsTable).where(eq(postsTable.id, post.sharedFromId)).limit(1);
    if (orig) sharedFrom = await enrichPost(orig, userId, false);
  }

  return {
    id: post.id,
    content: post.content,
    imageUrl: post.imageUrl,
    videoUrl: post.videoUrl ?? null,
    media,
    authorId: post.authorId,
    author: author ? formatUserBasic(author) : { id: post.authorId, name: "Usuário", role: "user" },
    channelId: post.channelId,
    channel: channel ? { id: channel.id, name: channel.name, icon: channel.icon, isInternalComm: channel.isInternalComm ?? false } : { id: post.channelId, name: "Canal", isInternalComm: false },
    targetUserId: post.targetUserId ?? null,
    likeCount: Number(likeCountResult?.count ?? 0),
    commentCount: Number(commentCountResult?.count ?? 0),
    shareCount: post.shareCount ?? 0,
    saveCount: post.saveCount ?? 0,
    viewCount: post.viewCount ?? 0,
    likedByMe: !!liked,
    savedByMe: !!saved,
    isPinned: post.isPinned ?? false,
    isHighlighted: post.isHighlighted ?? false,
    isOfficial: (post.isOfficial ?? false) || (channel?.isInternalComm ?? false),
    category: post.category ?? null,
    sharedFromId: post.sharedFromId ?? null,
    sharedFrom,
    createdAt: post.createdAt?.toISOString?.() ?? post.createdAt,
  };
}

// ── GET /posts ────────────────────────────────────────────────────────────────
// Query params: channelId, page, limit, type (image|video|text), sort (recent|popular|pinned), q (search), onlyOfficial, onlyPinned, authorId
router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const {
    channelId, page = "1", limit = "20",
    type, sort = "recent", q, onlyOfficial, onlyPinned, authorId,
  } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

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

  let allPosts = await db.select().from(postsTable)
    .orderBy(desc(postsTable.isPinned), desc(postsTable.createdAt))
    .limit(200);

  // Filter by accessible channels
  allPosts = allPosts.filter((p) => accessible.includes(p.channelId));

  // Filter by specific channel
  if (channelId) allPosts = allPosts.filter((p) => p.channelId === parseInt(channelId));

  // Filter by author
  if (authorId) allPosts = allPosts.filter((p) => p.authorId === parseInt(authorId));

  // Filter by type
  if (type === "image") allPosts = allPosts.filter((p) => !!p.imageUrl);
  if (type === "video") allPosts = allPosts.filter((p) => !!p.videoUrl);
  if (type === "text") allPosts = allPosts.filter((p) => !p.imageUrl && !p.videoUrl);

  // Filter only official
  if (onlyOfficial === "true") allPosts = allPosts.filter((p) => p.isOfficial);

  // Filter only pinned
  if (onlyPinned === "true") allPosts = allPosts.filter((p) => p.isPinned || p.isHighlighted);

  // Search query
  if (q && q.length > 0) {
    const ql = q.toLowerCase();
    allPosts = allPosts.filter((p) => (p.content || "").toLowerCase().includes(ql));
  }

  // Sorting (after filter)
  if (sort === "popular") {
    // We can't easily sort by likes without fetching them all, so we keep by date for now
    // and sort popular after enriching (or just rely on pinned first)
  } else if (sort === "pinned") {
    allPosts = allPosts.filter((p) => p.isPinned || p.isHighlighted);
  }

  // Paginate
  const paginated = allPosts.slice(offset, offset + limitNum);
  const enriched = await Promise.all(paginated.map((p) => enrichPost(p, user.id)));

  // Sort popular by like count after enriching
  if (sort === "popular") {
    enriched.sort((a, b) => b.likeCount - a.likeCount);
  }

  res.json({ posts: enriched, total: allPosts.length, page: pageNum, hasMore: offset + limitNum < allPosts.length });
});

// ── GET /posts/saved ──────────────────────────────────────────────────────────
router.get("/saved", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const saves = await db.select().from(savedPostsTable).where(eq(savedPostsTable.userId, user.id)).orderBy(desc(savedPostsTable.savedAt));
  const postIds = saves.map((s) => s.postId);
  if (postIds.length === 0) { res.json({ posts: [] }); return; }
  const posts = await db.select().from(postsTable).where(inArray(postsTable.id, postIds));
  const enriched = await Promise.all(posts.map((p) => enrichPost(p, user.id)));
  res.json({ posts: enriched });
});

// ── POST /posts ───────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { content, imageUrl, channelId, videoUrl, targetUserId, category, isOfficial, sharedFromId, media: mediaItems } = req.body;

  const [ch] = await db.select().from(channelsTable).where(eq(channelsTable.id, channelId)).limit(1);
  if (!ch) { res.status(404).json({ error: "Canal não encontrado" }); return; }

  if (ch.isInternalComm && user.role !== "admin" && user.role !== "master_admin") {
    const [poster] = await db.select().from(channelAllowedPostersTable)
      .where(and(eq(channelAllowedPostersTable.channelId, channelId), eq(channelAllowedPostersTable.userId, user.id))).limit(1);
    if (!poster) {
      console.warn(`[SECURITY] User ${user.id} (${user.email}) attempted to post in internal comm channel ${channelId} without permission`);
      res.status(403).json({ error: "Você não tem permissão para postar neste canal oficial" }); return;
    }
  }

  // Block reposts/shares INTO internal communication channels
  if (sharedFromId && ch.isInternalComm) {
    console.warn(`[SECURITY] User ${user.id} attempted to repost into internal comm channel ${channelId}`);
    res.status(403).json({ error: "Não é permitido compartilhar posts no canal de Comunicação Interna" }); return;
  }

  // Only admins can set isOfficial
  const officialFlag = isOfficial && (user.role === "admin" || user.role === "master_admin") ? true : false;

  // If this is a repost, update share count on original
  if (sharedFromId) {
    await db.execute(sql`UPDATE posts SET share_count = COALESCE(share_count, 0) + 1 WHERE id = ${sharedFromId}`);
    await db.insert(postSharesTable).values({ originalPostId: sharedFromId, userId: user.id, comment: content ?? null });
  }

  const [post] = await db.insert(postsTable).values({
    content: content ?? null,
    imageUrl: imageUrl ?? null,
    videoUrl: videoUrl ?? null,
    authorId: user.id,
    channelId,
    targetUserId: targetUserId ?? null,
    category: category ?? null,
    isOfficial: officialFlag,
    sharedFromId: sharedFromId ?? null,
  }).returning();

  // Insert multiple media items if provided
  if (Array.isArray(mediaItems) && mediaItems.length > 0) {
    await db.insert(postMediaTable).values(
      mediaItems.map((m: any, idx: number) => ({
        postId: post.id,
        mediaType: m.type ?? "image",
        url: m.url,
        thumbnailUrl: m.thumbnailUrl ?? null,
        mediaOrder: idx,
      }))
    );
  }

  const enriched = await enrichPost(post, user.id);
  res.json(enriched);

  setImmediate(async () => {
    try {
      const authorName = user.name || "Alguém";
      const safeContent = content ?? "";
      const preview = safeContent.length > 80 ? safeContent.slice(0, 77) + "…" : safeContent || "📷 Mídia";
      if (ch.isInternalComm) {
        const allUsers = await db.select({ id: usersTable.id }).from(usersTable)
          .where(sql`${usersTable.id} != ${user.id}`);
        const targetIds = allUsers.map((u) => u.id);
        if (targetIds.length > 0) {
          await sendPushToUsers(targetIds, {
            type: "comunicacao_interna",
            title: `📢 ${ch.name}`,
            body: `${authorName}: ${preview}`,
            data: { postId: post.id, channelId },
          });
        }
      }
      const mentionedNames = parseMentions(safeContent);
      if (mentionedNames.length > 0) {
        const allUsers = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
          .where(sql`${usersTable.id} != ${user.id}`);
        const mentionedIds = allUsers
          .filter((u) => mentionedNames.some((m) => u.name?.toLowerCase() === m.toLowerCase()))
          .map((u) => u.id)
          .filter((_id) => !ch.isInternalComm);
        if (mentionedIds.length > 0) {
          await sendPushToUsers(mentionedIds, {
            type: "mention",
            title: `🔔 ${authorName} mencionou você`,
            body: preview,
            data: { postId: post.id, channelId },
          });
        }
      }
    } catch (e) { console.error("[Notify post]", e); }
  });
});

// ── GET /posts/:id ────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, parseInt(id))).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(await enrichPost(post, user.id));
});

// ── DELETE /posts/:id ─────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, parseInt(id))).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (post.authorId !== user.id && user.role !== "admin" && user.role !== "master_admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(postMediaTable).where(eq(postMediaTable.postId, parseInt(id)));
  await db.delete(savedPostsTable).where(eq(savedPostsTable.postId, parseInt(id)));
  await db.delete(postLikesTable).where(eq(postLikesTable.postId, parseInt(id)));
  await db.delete(commentsTable).where(eq(commentsTable.postId, parseInt(id)));
  await db.delete(postsTable).where(eq(postsTable.id, parseInt(id)));
  res.json({ success: true, message: "Deleted" });
});

// ── POST /posts/:id/like ──────────────────────────────────────────────────────
router.post("/:id/like", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const postId = parseInt(req.params.id);
  const [existing] = await db.select().from(postLikesTable).where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, user.id))).limit(1);
  if (existing) {
    await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, user.id)));
  } else {
    await db.insert(postLikesTable).values({ postId, userId: user.id });
  }
  const [likeCountResult] = await db.select({ count: sql<number>`count(*)` }).from(postLikesTable).where(eq(postLikesTable.postId, postId));
  const liked = !existing;
  res.json({ liked, likeCount: Number(likeCountResult?.count ?? 0) });
  if (liked) {
    setImmediate(async () => {
      try {
        await processGamificationEvent({ userId: user.id, actionType: "like", entityType: "post", entityId: postId, idempotencyKey: `like_${user.id}_${postId}` });
      } catch (e) { console.error("[Gamification like]", e); }
    });
  }
});

// ── POST /posts/:id/save ──────────────────────────────────────────────────────
router.post("/:id/save", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const postId = parseInt(req.params.id);
  const [existing] = await db.select().from(savedPostsTable).where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id))).limit(1);
  if (existing) {
    await db.delete(savedPostsTable).where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, user.id)));
    await db.execute(sql`UPDATE posts SET save_count = GREATEST(COALESCE(save_count, 0) - 1, 0) WHERE id = ${postId}`);
    res.json({ saved: false });
  } else {
    await db.insert(savedPostsTable).values({ userId: user.id, postId });
    await db.execute(sql`UPDATE posts SET save_count = COALESCE(save_count, 0) + 1 WHERE id = ${postId}`);
    res.json({ saved: true });
  }
});

// ── POST /posts/:id/share ─────────────────────────────────────────────────────
// Body: { comment?, channelId?, shareToTimeline? }
// shareToTimeline=true  → post on personal timeline (channelId = null)
// channelId provided    → post in that specific channel
// neither               → post in original channel (legacy behaviour)
router.post("/:id/share", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const originalPostId = parseInt(req.params.id);
  const { comment, channelId, shareToTimeline } = req.body;
  const [orig] = await db.select().from(postsTable).where(eq(postsTable.id, originalPostId)).limit(1);
  if (!orig) { res.status(404).json({ error: "Post não encontrado" }); return; }

  // Determine target channel: null = personal timeline, provided = chosen channel, else original channel
  const targetChannelId: number | null = shareToTimeline
    ? null
    : channelId != null
      ? parseInt(channelId)
      : orig.channelId;

  // Block sharing INTO internal communication channels
  if (targetChannelId !== null) {
    const [targetCh] = await db.select().from(channelsTable).where(eq(channelsTable.id, targetChannelId)).limit(1);
    if (targetCh?.isInternalComm) {
      console.warn(`[SECURITY] User ${user.id} attempted to share post ${originalPostId} into internal comm channel ${targetChannelId}`);
      res.status(403).json({ error: "Não é permitido compartilhar posts no canal de Comunicação Interna" }); return;
    }
  }

  await db.execute(sql`UPDATE posts SET share_count = COALESCE(share_count, 0) + 1 WHERE id = ${originalPostId}`);
  await db.insert(postSharesTable).values({ originalPostId, userId: user.id, comment: comment ?? null });
  const [newPost] = await db.insert(postsTable).values({
    content: comment ?? null,
    authorId: user.id,
    channelId: targetChannelId,
    sharedFromId: originalPostId,
  }).returning();
  const enriched = await enrichPost(newPost, user.id);
  res.json(enriched);
});

// ── PUT /posts/:id/pin ────────────────────────────────────────────────────────
router.put("/:id/pin", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "master_admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const postId = parseInt(req.params.id);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  const newVal = !(post.isPinned ?? false);
  await db.update(postsTable).set({ isPinned: newVal }).where(eq(postsTable.id, postId));
  res.json({ isPinned: newVal });
});

// ── PUT /posts/:id/highlight ──────────────────────────────────────────────────
router.put("/:id/highlight", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "master_admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const postId = parseInt(req.params.id);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  const newVal = !(post.isHighlighted ?? false);
  await db.update(postsTable).set({ isHighlighted: newVal }).where(eq(postsTable.id, postId));
  res.json({ isHighlighted: newVal });
});

// ── POST /posts/:id/report ────────────────────────────────────────────────────
router.post("/:id/report", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "Reason required" }); return; }
  await db.insert(postReportsTable).values({ postId: parseInt(req.params.id), reporterId: user.id, reason });
  res.json({ success: true });
});

// ── GET /posts/:id/comments ───────────────────────────────────────────────────
router.get("/:id/comments", requireAuth, async (req, res) => {
  const { id } = req.params;
  const comments = await db.select().from(commentsTable)
    .where(eq(commentsTable.postId, parseInt(id)))
    .orderBy(commentsTable.createdAt);
  const enriched = await Promise.all(comments.map(async (c) => {
    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, c.authorId)).limit(1);
    return {
      id: c.id, content: c.content, authorId: c.authorId,
      author: author ? formatUserBasic(author) : { id: c.authorId, name: "Usuário", role: "user" },
      postId: c.postId, parentId: c.parentId ?? null,
      createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
    };
  }));
  res.json(enriched);
});

// ── POST /posts/:id/comments ──────────────────────────────────────────────────
router.post("/:id/comments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { content, parentId } = req.body;
  const postId = parseInt(id);
  const [comment] = await db.insert(commentsTable).values({
    content, postId, authorId: user.id, parentId: parentId ?? null,
  }).returning();
  res.json({
    id: comment.id, content: comment.content, authorId: comment.authorId,
    author: formatUserBasic(user), postId: comment.postId, parentId: comment.parentId ?? null,
    createdAt: comment.createdAt?.toISOString?.() ?? comment.createdAt,
  });
  setImmediate(async () => {
    try {
      await processGamificationEvent({ userId: user.id, actionType: "comment", entityType: "post", entityId: postId, commentContent: content, idempotencyKey: `comment_${user.id}_${comment.id}` });
    } catch (e) { console.error("[Gamification comment]", e); }
    try {
      const mentionedNames = parseMentions(content ?? "");
      if (mentionedNames.length === 0) return;
      const preview = (content ?? "").length > 80 ? (content ?? "").slice(0, 77) + "…" : content || "💬 Comentário";
      const allUsers = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(sql`${usersTable.id} != ${user.id}`);
      const mentionedIds = allUsers.filter((u) => mentionedNames.some((m) => u.name?.toLowerCase() === m.toLowerCase())).map((u) => u.id);
      if (mentionedIds.length > 0) {
        await sendPushToUsers(mentionedIds, { type: "mention", title: `💬 ${user.name || "Alguém"} mencionou você`, body: preview, data: { postId, commentId: comment.id } });
      }
    } catch (e) { console.error("[Notify comment]", e); }
  });
});

// ── DELETE /comments/:id ──────────────────────────────────────────────────────
router.delete("/comments/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, parseInt(req.params.id))).limit(1);
  if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
  if (comment.authorId !== user.id && user.role !== "admin" && user.role !== "master_admin" && user.role !== "moderator") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(commentsTable).where(eq(commentsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

// ── POST /comments/:id/report ─────────────────────────────────────────────────
router.post("/comments/:id/report", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { reason } = req.body;
  await db.insert(commentReportsTable).values({ commentId: parseInt(req.params.id), reporterId: user.id, reason });
  res.json({ success: true });
});

// ── GET /reports/all (admin) ──────────────────────────────────────────────────
router.get("/reports/all", requireAuth, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "master_admin" && user.role !== "moderator") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const reports = await db.select().from(commentReportsTable).orderBy(desc(commentReportsTable.createdAt));
  const enriched = await Promise.all(reports.map(async (r) => {
    const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, r.commentId)).limit(1);
    const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, r.reporterId)).limit(1);
    const commentAuthor = comment ? await db.select().from(usersTable).where(eq(usersTable.id, comment.authorId)).limit(1).then(([u]) => u) : null;
    return {
      id: r.id, commentId: r.commentId,
      comment: comment ? {
        id: comment.id, content: comment.content, authorId: comment.authorId,
        author: commentAuthor ? formatUserBasic(commentAuthor) : { id: comment.authorId, name: "Usuário", role: "user" },
        postId: comment.postId, createdAt: comment.createdAt?.toISOString?.() ?? comment.createdAt,
      } : null,
      reporterId: r.reporterId,
      reporter: reporter ? formatUserBasic(reporter) : { id: r.reporterId, name: "Usuário", role: "user" },
      reason: r.reason, createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    };
  }));
  res.json(enriched);
});

// ── GET /timeline/:userId — posts by or on the wall of a user ─────────────────
router.get("/timeline/:userId", requireAuth, async (req, res) => {
  const me = (req as any).user;
  const targetId = parseInt(req.params.userId);
  const { page = "1", limit = "20", type } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  let allPosts = await db.select().from(postsTable)
    .orderBy(desc(postsTable.createdAt)).limit(300);
  allPosts = allPosts.filter((p) => p.authorId === targetId || p.targetUserId === targetId);

  if (type === "image") allPosts = allPosts.filter((p) => !!p.imageUrl);
  if (type === "video") allPosts = allPosts.filter((p) => !!p.videoUrl);

  const paginated = allPosts.slice(offset, offset + limitNum);
  const enriched = await Promise.all(paginated.map((p) => enrichPost(p, me.id)));
  res.json({ posts: enriched, total: allPosts.length, hasMore: offset + limitNum < allPosts.length });
});

// ── GET /user-stats/:userId — public stats for a user profile ─────────────────
router.get("/user-stats/:userId", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const [postCountResult] = await db.select({ count: sql<number>`count(*)` }).from(postsTable).where(eq(postsTable.authorId, targetId));
  const userPosts = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.authorId, targetId));
  const postIds = userPosts.map((p) => p.id);

  let totalLikes = 0;
  let totalComments = 0;
  if (postIds.length > 0) {
    const [likesResult] = await db.select({ count: sql<number>`count(*)` }).from(postLikesTable).where(inArray(postLikesTable.postId, postIds));
    const [commentsResult] = await db.select({ count: sql<number>`count(*)` }).from(commentsTable).where(inArray(commentsTable.postId, postIds));
    totalLikes = Number(likesResult?.count ?? 0);
    totalComments = Number(commentsResult?.count ?? 0);
  }

  res.json({
    userId: targetId,
    user: formatUserBasic(user),
    postCount: Number(postCountResult?.count ?? 0),
    totalLikesReceived: totalLikes,
    totalCommentsReceived: totalComments,
  });
});

export default router;
