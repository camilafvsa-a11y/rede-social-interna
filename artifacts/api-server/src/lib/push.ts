import Expo from "expo-server-sdk";
import { db, pushTokensTable, notificationsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const expo = new Expo({ useFcmV1: false });

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  icon?: string;
  priority?: "high" | "medium" | "low";
  entityType?: string;
  entityId?: number;
  routePath?: string;
  data?: Record<string, any>;
}

export async function sendPushToUsers(
  userIds: number[],
  notification: NotificationPayload
) {
  if (userIds.length === 0) return;

  await db.insert(notificationsTable).values(
    userIds.map((userId) => ({
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      icon: notification.icon ?? null,
      priority: notification.priority ?? "medium",
      entityType: notification.entityType ?? null,
      entityId: notification.entityId ?? null,
      routePath: notification.routePath ?? null,
      data: notification.data ? JSON.stringify(notification.data) : null,
      read: false,
      isArchived: false,
    }))
  );

  const tokens = await db
    .select()
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds));

  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.token));
  if (validTokens.length === 0) return;

  const messages = validTokens.map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, type: notification.type, routePath: notification.routePath },
    sound: "default" as const,
    priority: notification.priority === "high" ? "high" as const : "normal" as const,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error("[Push] Send error:", e);
    }
  }
}

export function parseMentions(content: string): string[] {
  const matches = content.match(/@([A-Za-zÀ-ÿ0-9 ._-]+?)(?=[\s,!?.@]|$)/g) ?? [];
  return matches.map((m) => m.slice(1).trim()).filter(Boolean);
}
