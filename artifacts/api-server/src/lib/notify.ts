/**
 * Central notification helper
 * Every notification type goes through here for consistency.
 */
import { db, usersTable } from "@workspace/db";
import { ne, eq } from "drizzle-orm";
import { sendPushToUsers } from "./push.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function preview(text: string | null | undefined, len = 80): string {
  if (!text) return "📷 Mídia";
  return text.length > len ? text.slice(0, len - 1) + "…" : text;
}

// ── New post in internal-comm channel → notify all users ─────────────────────
export async function notifyInternalCommPost(opts: {
  postId: number;
  channelId: number;
  channelName: string;
  authorName: string;
  content: string | null;
  authorId: number;
}) {
  const all = await db.select({ id: usersTable.id }).from(usersTable)
    .where(ne(usersTable.id, opts.authorId));
  const ids = all.map((u) => u.id);
  if (!ids.length) return;
  await sendPushToUsers(ids, {
    type: "comunicacao_interna",
    title: `📢 ${opts.channelName}`,
    body: `${opts.authorName}: ${preview(opts.content)}`,
    icon: "megaphone",
    priority: "high",
    entityType: "post",
    entityId: opts.postId,
    routePath: `/post/${opts.postId}`,
    data: { postId: opts.postId, channelId: opts.channelId },
  });
}

// ── New comment on a post → notify post author ───────────────────────────────
export async function notifyNewComment(opts: {
  postId: number;
  postAuthorId: number;
  commentAuthorId: number;
  commentAuthorName: string;
  content: string | null;
  commentId: number;
}) {
  if (opts.postAuthorId === opts.commentAuthorId) return;
  await sendPushToUsers([opts.postAuthorId], {
    type: "comment",
    title: `💬 ${opts.commentAuthorName} comentou`,
    body: preview(opts.content, 70),
    icon: "message-circle",
    priority: "medium",
    entityType: "post",
    entityId: opts.postId,
    routePath: `/post/${opts.postId}`,
    data: { postId: opts.postId, commentId: opts.commentId },
  });
}

// ── Reply to comment → notify comment author ─────────────────────────────────
export async function notifyCommentReply(opts: {
  postId: number;
  parentCommentAuthorId: number;
  replyAuthorId: number;
  replyAuthorName: string;
  content: string | null;
  commentId: number;
}) {
  if (opts.parentCommentAuthorId === opts.replyAuthorId) return;
  await sendPushToUsers([opts.parentCommentAuthorId], {
    type: "comment_reply",
    title: `↩️ ${opts.replyAuthorName} respondeu seu comentário`,
    body: preview(opts.content, 70),
    icon: "corner-down-right",
    priority: "medium",
    entityType: "post",
    entityId: opts.postId,
    routePath: `/post/${opts.postId}`,
    data: { postId: opts.postId, commentId: opts.commentId },
  });
}

// ── New DM message → notify recipient ────────────────────────────────────────
export async function notifyNewDM(opts: {
  recipientId: number;
  senderId: number;
  senderName: string;
  convId: number;
  content: string | null;
}) {
  if (opts.recipientId === opts.senderId) return;
  await sendPushToUsers([opts.recipientId], {
    type: "dm",
    title: `✉️ ${opts.senderName}`,
    body: preview(opts.content, 60),
    icon: "mail",
    priority: "high",
    entityType: "dm",
    entityId: opts.convId,
    routePath: `/messages/${opts.convId}`,
    data: { convId: opts.convId, senderId: opts.senderId },
  });
}

// ── New document → notify users ───────────────────────────────────────────────
export async function notifyNewDocument(opts: {
  docKey: string;
  docTitle: string;
  requiresSign: boolean;
  requiresRead: boolean;
  targetUserIds: number[] | "all";
  authorId?: number;
}) {
  let ids: number[];
  if (opts.targetUserIds === "all") {
    const all = await db.select({ id: usersTable.id }).from(usersTable);
    ids = all.map((u) => u.id).filter((id) => id !== opts.authorId);
  } else {
    ids = opts.targetUserIds.filter((id) => id !== opts.authorId);
  }
  if (!ids.length) return;

  let title = "📄 Novo documento disponível";
  let type = "doc_new";
  let icon = "file-text";
  if (opts.requiresSign) {
    title = "✍️ Documento aguardando sua assinatura";
    type = "doc_sign_required";
    icon = "edit-3";
  } else if (opts.requiresRead) {
    title = "📖 Novo documento obrigatório para leitura";
    type = "doc_read_required";
    icon = "book-open";
  }

  await sendPushToUsers(ids, {
    type,
    title,
    body: opts.docTitle,
    icon,
    priority: opts.requiresSign ? "high" : "medium",
    entityType: "doc",
    routePath: `/integra`,
    data: { docKey: opts.docKey },
  });
}

// ── Mention in post or comment ────────────────────────────────────────────────
export async function notifyMentions(opts: {
  mentionedIds: number[];
  authorId: number;
  authorName: string;
  postId: number;
  commentId?: number;
  content: string | null;
}) {
  const ids = opts.mentionedIds.filter((id) => id !== opts.authorId);
  if (!ids.length) return;
  await sendPushToUsers(ids, {
    type: "mention",
    title: `🔔 ${opts.authorName} mencionou você`,
    body: preview(opts.content),
    icon: "at-sign",
    priority: "medium",
    entityType: "post",
    entityId: opts.postId,
    routePath: `/post/${opts.postId}`,
    data: { postId: opts.postId, ...(opts.commentId ? { commentId: opts.commentId } : {}) },
  });
}

// ── Onboarding / Integra reminder ────────────────────────────────────────────
export async function notifyOnboardingPending(opts: {
  userId: number;
  step: string;
}) {
  const stepMessages: Record<string, { title: string; body: string }> = {
    photo:       { title: "📷 Adicione sua foto de perfil", body: "Complete seu onboarding adicionando uma foto." },
    values:      { title: "📋 Confirme os valores da empresa", body: "Você ainda não confirmou a leitura dos valores." },
    docs:        { title: "📄 Documentos pendentes", body: "Você tem documentos para ler ou assinar." },
    image_term:  { title: "🖊️ Termo de uso de imagem pendente", body: "Responda o termo de uso de imagem para concluir." },
    default:     { title: "⚠️ Onboarding incompleto", body: "Conclua seu onboarding para acessar todos os recursos." },
  };
  const msg = stepMessages[opts.step] ?? stepMessages.default;
  await sendPushToUsers([opts.userId], {
    type: "onboarding_pending",
    title: msg.title,
    body: msg.body,
    icon: "alert-circle",
    priority: "medium",
    entityType: "onboarding",
    routePath: "/onboarding",
    data: { step: opts.step },
  });
}

// ── Admin broadcast ───────────────────────────────────────────────────────────
export async function notifyBroadcast(opts: {
  title: string;
  body: string;
  authorId: number;
  routePath?: string;
}) {
  const all = await db.select({ id: usersTable.id }).from(usersTable)
    .where(ne(usersTable.id, opts.authorId));
  const ids = all.map((u) => u.id);
  if (!ids.length) return;
  await sendPushToUsers(ids, {
    type: "broadcast",
    title: opts.title,
    body: opts.body,
    icon: "bell",
    priority: "high",
    entityType: "broadcast",
    routePath: opts.routePath ?? null,
    data: {},
  });
}
