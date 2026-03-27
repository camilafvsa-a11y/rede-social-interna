import { Router } from "express";
import { db, ticketsTable, ticketMessagesTable, ticketHandlersTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, formatUserBasic } from "../lib/auth.js";

const router = Router();

async function canViewTicket(user: any, ticket: any) {
  if (user.role === "admin" || user.role === "master_admin") return true;
  if (ticket.authorId === user.id) return true;
  const [handler] = await db.select().from(ticketHandlersTable).where(eq(ticketHandlersTable.userId, user.id)).limit(1);
  return !!handler;
}

async function enrichTicket(t: any, includeMessages = false) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, t.authorId)).limit(1);
  const msgRows = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, t.id));

  let assignedTo = null;
  if (t.assignedToId) {
    const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, t.assignedToId)).limit(1);
    if (assignee) assignedTo = formatUserBasic(assignee);
  }

  const base = {
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

  if (includeMessages) {
    (base as any).messages = await Promise.all(msgRows.map(async (m: any) => {
      const [msgAuthor] = await db.select().from(usersTable).where(eq(usersTable.id, m.authorId)).limit(1);
      return {
        id: m.id, ticketId: m.ticketId, content: m.content, authorId: m.authorId,
        author: msgAuthor ? formatUserBasic(msgAuthor) : { id: m.authorId, name: "Usuário", role: "user" },
        createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
      };
    }));
  }

  return base;
}

router.get("/", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status, category } = req.query as { status?: string; category?: string };
  let tickets = await db.select().from(ticketsTable).orderBy(desc(ticketsTable.createdAt));

  const isHandler = (await db.select().from(ticketHandlersTable).where(eq(ticketHandlersTable.userId, user.id)).limit(1)).length > 0;

  if (user.role !== "admin" && user.role !== "master_admin" && !isHandler) {
    tickets = tickets.filter((t) => t.authorId === user.id);
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

  const isHandler = (await db.select().from(ticketHandlersTable).where(eq(ticketHandlersTable.userId, user.id)).limit(1)).length > 0;
  if (user.role !== "admin" && user.role !== "master_admin" && !isHandler) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const updateData: any = { updatedAt: new Date() };
  if (status !== undefined) updateData.status = status;
  if (assignedToId !== undefined) {
    updateData.assignedToId = assignedToId === null ? null : parseInt(assignedToId);
    updateData.assignedAt = assignedToId === null ? null : new Date();
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
      id: m.id, ticketId: m.ticketId, content: m.content, authorId: m.authorId,
      author: author ? formatUserBasic(author) : { id: m.authorId, name: "Usuário", role: "user" },
      createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
    };
  }));
  res.json(enriched);
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { content } = req.body;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, parseInt(id))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!await canViewTicket(user, ticket)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [msg] = await db.insert(ticketMessagesTable).values({ ticketId: parseInt(id), content, authorId: user.id }).returning();
  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, parseInt(id)));
  res.json({
    id: msg.id, ticketId: msg.ticketId, content: msg.content, authorId: msg.authorId,
    author: formatUserBasic(user),
    createdAt: msg.createdAt?.toISOString?.() ?? msg.createdAt,
  });
});

router.get("/admin/handlers", requireAdmin, async (req, res) => {
  const handlers = await db.select().from(ticketHandlersTable);
  const enriched = await Promise.all(handlers.map(async (h) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, h.userId)).limit(1);
    return {
      id: h.id, userId: h.userId,
      user: user ? formatUserBasic(user) : { id: h.userId, name: "Usuário", role: "user" },
      addedAt: h.addedAt?.toISOString?.() ?? h.addedAt,
    };
  }));
  res.json(enriched);
});

router.post("/admin/handlers", requireAdmin, async (req, res) => {
  const { userId } = req.body;
  await db.insert(ticketHandlersTable).values({ userId }).onConflictDoNothing();
  res.json({ success: true, message: "Added" });
});

router.delete("/admin/handlers/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  await db.delete(ticketHandlersTable).where(eq(ticketHandlersTable.userId, parseInt(userId)));
  res.json({ success: true, message: "Removed" });
});

export default router;
