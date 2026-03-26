import Expo from "expo-server-sdk";
import { db, pushTokensTable, notificationsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const expo = new Expo({ useFcmV1: false });

export async function sendPushToUsers(
  userIds: number[],
  notification: {
    type: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }
) {
  if (userIds.length === 0) return;

  await db.insert(notificationsTable).values(
    userIds.map((userId) => ({
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data ? JSON.stringify(notification.data) : null,
      read: false,
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
    data: notification.data || {},
    sound: "default" as const,
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
