import { Router } from "express";
import { db, dmConversationsTable, dmMessagesTable, usersTable } from "@workspace/db";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { requireAuth, formatUserBasic } from "../lib/auth.js";

const router = Router();

function getOtherUserId(conv: any, myId: number) {
  return conv.user1Id === myId ? conv.user2Id : conv.user1Id;
}

async function enrichConversation(conv: any, myId: number) {
  const otherId = getOtherUserId(conv, myId);
  const [other] = await db.select().from(usersTable).where(eq(usersTable.id, otherId)).limit(1);
  const [lastMsg] = await db.select().from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, conv.id))
    .orderBy(desc(dmMessagesTable.createdAt))
    .limit(1);

  const unreadCount = await db.select().from(dmMessagesTable)
    .where(and(
      eq(dmMessagesTable.conversationId, conv.id),
      eq(dmMessagesTable.senderId, otherId),
      isNull(dmMessagesTable.readAt),
    ));

  return {
    id: conv.id,
    otherUser: other ? formatUserBasic(other) : { id: otherId, name: "Usuário" },
    lastMessage: lastMsg
      ? {
          content: lastMsg.content,
          senderId: lastMsg.senderId,
          createdAt: lastMsg.createdAt?.toISOString?.() ?? lastMsg.createdAt,
        }
      : null,
    unreadCount: unreadCount.length,
    lastMessageAt: conv.lastMessageAt?.toISOString?.() ?? conv.lastMessageAt,
    createdAt: conv.createdAt?.toISOString?.() ?? conv.createdAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const convs = await db.select().from(dmConversationsTable)
    .where(or(
      eq(dmConversationsTable.user1Id, user.id),
      eq(dmConversationsTable.user2Id, user.id),
    ))
    .orderBy(desc(dmConversationsTable.lastMessageAt));

  const enriched = await Promise.all(convs.map((c) => enrichConversation(c, user.id)));
  res.json(enriched);
});

router.get("/unread-count", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const convs = await db.select().from(dmConversationsTable)
    .where(or(
      eq(dmConversationsTable.user1Id, user.id),
      eq(dmConversationsTable.user2Id, user.id),
    ));

  let total = 0;
  for (const conv of convs) {
    const otherId = getOtherUserId(conv, user.id);
    const unread = await db.select().from(dmMessagesTable)
      .where(and(
        eq(dmMessagesTable.conversationId, conv.id),
        eq(dmMessagesTable.senderId, otherId),
        isNull(dmMessagesTable.readAt),
      ));
    total += unread.length;
  }

  res.json({ count: total });
});

router.get("/with/:userId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const otherId = parseInt(req.params.userId);

  const [other] = await db.select().from(usersTable).where(eq(usersTable.id, otherId)).limit(1);
  if (!other) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const u1 = Math.min(user.id, otherId);
  const u2 = Math.max(user.id, otherId);

  let [conv] = await db.select().from(dmConversationsTable)
    .where(and(
      eq(dmConversationsTable.user1Id, u1),
      eq(dmConversationsTable.user2Id, u2),
    )).limit(1);

  if (!conv) {
    [conv] = await db.insert(dmConversationsTable)
      .values({ user1Id: u1, user2Id: u2, lastMessageAt: new Date() })
      .returning();
  }

  res.json(await enrichConversation(conv, user.id));
});

router.get("/:convId/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const convId = parseInt(req.params.convId);

  const [conv] = await db.select().from(dmConversationsTable).where(eq(dmConversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
  if (conv.user1Id !== user.id && conv.user2Id !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const msgs = await db.select().from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, convId))
    .orderBy(desc(dmMessagesTable.createdAt))
    .limit(60);

  res.json(msgs.reverse().map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content,
    mediaUrl: m.mediaUrl ?? null,
    mediaType: m.mediaType ?? null,
    readAt: m.readAt?.toISOString?.() ?? m.readAt ?? null,
    createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
  })));
});

router.post("/:convId/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const convId = parseInt(req.params.convId);
  const { content, mediaUrl, mediaType } = req.body;

  if (!content?.trim() && !mediaUrl) { res.status(400).json({ error: "Conteúdo ou anexo são obrigatórios" }); return; }

  const [conv] = await db.select().from(dmConversationsTable).where(eq(dmConversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
  if (conv.user1Id !== user.id && conv.user2Id !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const [msg] = await db.insert(dmMessagesTable)
    .values({
      conversationId: convId,
      senderId: user.id,
      content: content?.trim() || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
    })
    .returning();

  await db.update(dmConversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(dmConversationsTable.id, convId));

  res.json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    mediaUrl: msg.mediaUrl ?? null,
    mediaType: msg.mediaType ?? null,
    readAt: null,
    createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
  });
});

router.post("/:convId/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const convId = parseInt(req.params.convId);

  const [conv] = await db.select().from(dmConversationsTable).where(eq(dmConversationsTable.id, convId)).limit(1);
  if (!conv) { res.status(404).json({ error: "Conversa não encontrada" }); return; }
  if (conv.user1Id !== user.id && conv.user2Id !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const otherId = getOtherUserId(conv, user.id);

  await db.update(dmMessagesTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(dmMessagesTable.conversationId, convId),
      eq(dmMessagesTable.senderId, otherId),
      isNull(dmMessagesTable.readAt),
    ));

  res.json({ success: true });
});

export default router;
