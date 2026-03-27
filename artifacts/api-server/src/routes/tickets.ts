import { Router } from "express";
import { db, ticketsTable, ticketMessagesTable, ticketHandlersTable, ticketReadsTable, usersTable, type Ticket } from "@workspace/db";
import { eq, desc, and, gt } from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";

const router = Router();

async function canViewTicket(user: { id: number; role: string }, ticket: Ticket) {
  if (user.role === "admin" || user.role === "master_admin") return true;
  if (ticket.authorId === user.id) return true;
  const [handler] = await db
    .select()
    .from(ticketHandlersTable)
    .where(and(eq(ticketHandlersTable.userId, user.id), eq(ticketHandlersTable.category, ticket.category)))
    .limit(1);
  return !!handler;
}

async function enrichTicket(t: Ticket) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, t.authorId)).limit(1);
  const msgRows = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, t.id));

  let assignedTo = null;
  if (t.assignedToId) {
    const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, t.assignedToId)).limit(1);
    if (assignee) assignedTo = formatUserBasic(assignee);
  }

  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    category: t.category,
    authorId: t.authorId,
    author: author ? formatUserBasic(author) : { id: t.authorId, name: "Usuário", role: "user" },
    assignedToId: t.assignedToId ?? null,
    assignedTo,
    assignedAt: t.assignedAt?.toISOString?.() ?? t.assignedAt ?? null,
    messageCount: msgRows.length,
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
    updatedAt: t.updatedAt?.toISOString?.() ?? t.updatedAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status, category, mine } = req.query as { status?: string; category?: string; mine?: string };
  let tickets = await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt));

  const handlerEntries = await db.select().from(ticketHandlersTable).where(eq(ticketHandlersTable.userId, user.id));
  const handlerCategories = handlerEntries.map((h) => h.category);
  const isHandler = handlerCategories.length > 0;

  if (mine === "true") {
    // Always return only the current user's own tickets
    tickets = tickets.filter((t) => t.authorId === user.id);
  } else if (user.role !== "admin" && user.role !== "master_admin") {
    if (isHandler) {
      tickets = tickets.filter((t) => handlerCategories.includes(t.category));
    } else {
      tickets = tickets.filter((t) => t.authorId === user.id);
    }
  }

  if (status) tickets = tickets.filter((t) => t.status === status);
  if (category) tickets = tickets.filter((t) => t.category === category);

  const enriched = await Promise.all(tickets.map((t) => enrichTicket(t)));
  res.json(enriched);
});

router.post("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { title, description, category } = req.body;
  const [ticket] = await db.insert(ticketsTable).values({ title, description, category, authorId: user.id }).returning();
  res.json(await enrichTicket(ticket));
});

// ── Unread tracking (must be before /:id) ────────────────────────────────────

router.get("/unread-count", requireAuth, async (req, res) => {
  const user = (req as any).user;

  let tickets = await db.select().from(ticketsTable);
  const handlerEntries = await db.select().from(ticketHandlersTable).where(eq(ticketHandlersTable.userId, user.id));
  const handlerCategories = handlerEntries.map((h) => h.category);

  if (user.role !== "admin" && user.role !== "master_admin") {
    if (handlerCategories.length > 0) {
      tickets = tickets.filter((t) => handlerCategories.includes(t.category));
    } else {
      tickets = tickets.filter((t) => t.authorId === user.id);
    }
  }

  const reads = await db.select().from(ticketReadsTable).where(eq(ticketReadsTable.userId, user.id));
  const readMap = new Map(reads.map((r) => [r.ticketId, r.lastReadAt]));

  let unread = 0;
  for (const ticket of tickets) {
    const lastRead = readMap.get(ticket.id);
    if (!lastRead) {
      const [msg] = await db.select().from(ticketMessagesTable)
        .where(eq(ticketMessagesTable.ticketId, ticket.id)).limit(1);
      if (msg) unread++;
    } else {
      const [newMsg] = await db.select().from(ticketMessagesTable)
        .where(and(eq(ticketMessagesTable.ticketId, ticket.id), gt(ticketMessagesTable.createdAt, lastRead)))
        .limit(1);
      if (newMsg) unread++;
    }
  }

  res.json({ count: unread });
});

router.get("/handler/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const entries = await db.select().from(ticketHandlersTable).where(eq(ticketHandlersTable.userId, user.id));
  res.json(entries.map((e) => ({
    id: e.id,
    category: e.category,
    addedAt: e.addedAt?.toISOString?.() ?? e.addedAt,
  })));
});

router.get("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, parseInt(id))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!await canViewTicket(user, ticket)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(await enrichTicket(ticket));
});

router.patch("/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { status, assignedToId } = req.body;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, parseInt(id))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const handlerEntry = await db.select().from(ticketHandlersTable)
    .where(and(eq(ticketHandlersTable.userId, user.id), eq(ticketHandlersTable.category, ticket.category)))
    .limit(1);
  const isHandlerForCategory = handlerEntry.length > 0;

  if (user.role !== "admin" && user.role !== "master_admin" && !isHandlerForCategory) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  type TicketStatus = "open" | "in_progress" | "closed";
  type TicketUpdatePayload = {
    updatedAt: Date;
    status?: TicketStatus;
    assignedToId?: number | null;
    assignedAt?: Date | null;
  };

  const updateData: TicketUpdatePayload = { updatedAt: new Date() };

  if (status !== undefined) {
    const validStatuses: TicketStatus[] = ["open", "in_progress", "closed"];
    if (!validStatuses.includes(status as TicketStatus)) {
      res.status(400).json({ error: "Invalid status value" }); return;
    }
    updateData.status = status as TicketStatus;
  }
  if (assignedToId !== undefined) {
    if (assignedToId === null) {
      updateData.assignedToId = null;
      updateData.assignedAt = null;
    } else {
      if (typeof assignedToId !== "number" && !/^\d+$/.test(String(assignedToId))) {
        res.status(400).json({ error: "Invalid assignedToId" }); return;
      }
      const numId = Number(assignedToId);
      const [validHandler] = await db.select().from(ticketHandlersTable)
        .where(and(eq(ticketHandlersTable.userId, numId), eq(ticketHandlersTable.category, ticket.category)))
        .limit(1);
      if (!validHandler) {
        res.status(400).json({ error: "User does not handle this ticket category" }); return;
      }
      updateData.assignedToId = numId;
      updateData.assignedAt = new Date();
    }
  }

  const [updated] = await db.update(ticketsTable).set(updateData).where(eq(ticketsTable.id, parseInt(id))).returning();
  res.json(await enrichTicket(updated));
});

router.get("/:id/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, parseInt(id))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!await canViewTicket(user, ticket)) { res.status(403).json({ error: "Forbidden" }); return; }

  const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, parseInt(id)));
  const enriched = await Promise.all(messages.map(async (m) => {
    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, m.authorId)).limit(1);
    return {
      id: m.id, ticketId: m.ticketId, content: m.content, mediaUrl: m.mediaUrl ?? null, mediaType: m.mediaType ?? null, authorId: m.authorId,
      author: author ? formatUserBasic(author) : { id: m.authorId, name: "Usuário", role: "user" },
      createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
    };
  }));
  res.json(enriched);
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { content, mediaUrl, mediaType } = req.body;
  if (!content?.trim() && !mediaUrl) {
    res.status(400).json({ error: "Conteúdo ou anexo são obrigatórios" }); return;
  }
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, parseInt(id))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!await canViewTicket(user, ticket)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId: parseInt(id),
    content: content?.trim() || null,
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    authorId: user.id,
  }).returning();
  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, parseInt(id)));
  res.json({
    id: msg.id, ticketId: msg.ticketId, content: msg.content, mediaUrl: msg.mediaUrl ?? null, mediaType: msg.mediaType ?? null, authorId: msg.authorId,
    author: formatUserBasic(user),
    createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
  });
});

router.get("/admin/handlers", requireAdmin, async (req, res) => {
  const handlers = await db.select().from(ticketHandlersTable).orderBy(ticketHandlersTable.userId, ticketHandlersTable.category);
  const enriched = await Promise.all(handlers.map(async (h) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, h.userId)).limit(1);
    return {
      id: h.id, userId: h.userId, category: h.category,
      user: user ? formatUserBasic(user) : { id: h.userId, name: "Usuário", role: "user" },
      addedAt: h.addedAt?.toISOString?.() ?? h.addedAt,
    };
  }));
  res.json(enriched);
});

router.post("/admin/handlers", requireAdmin, async (req, res) => {
  const { userId, category } = req.body;
  if (!userId || !category) {
    res.status(400).json({ error: "userId and category are required" }); return;
  }
  await db.insert(ticketHandlersTable).values({ userId, category }).onConflictDoNothing();
  res.json({ success: true, message: "Added" });
});

router.delete("/admin/handlers/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(ticketHandlersTable).where(eq(ticketHandlersTable.id, parseInt(id)));
  res.json({ success: true, message: "Removed" });
});

router.post("/:id/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const ticketId = parseInt(id);

  await db.insert(ticketReadsTable)
    .values({ userId: user.id, ticketId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [ticketReadsTable.userId, ticketReadsTable.ticketId],
      set: { lastReadAt: new Date() },
    });

  res.json({ success: true });
});

export default router;
