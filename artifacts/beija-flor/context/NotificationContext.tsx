import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface NotificationContextType {
  unreadCount: number;
  ticketUnreadCount: number;
  dmUnreadCount: number;
  refreshUnread: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  ticketUnreadCount: 0,
  dmUnreadCount: 0,
  refreshUnread: async () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshUnread() {
    try {
      const [notifData, ticketData, dmData] = await Promise.all([
        api.get("/notifications/unread-count").catch(() => ({ count: 0 })),
        api.get("/tickets/unread-count").catch(() => ({ count: 0 })),
        api.get("/dms/unread-count").catch(() => ({ count: 0 })),
      ]);
      setUnreadCount(notifData?.count ?? 0);
      setTicketUnreadCount(ticketData?.count ?? 0);
      setDmUnreadCount(dmData?.count ?? 0);
    } catch {
      // silent
    }
  }

  async function registerPushToken() {
    if (Platform.OS === "web") return;
    try {
      const Notifications = await import("expo-notifications");
      const Device = await import("expo-device");

      if (!Device.isDevice) return;

      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      const platform = Platform.OS;

      await api.post("/notifications/register-push", { token, platform });
    } catch (e) {
      console.warn("[PushToken]", e);
    }
  }

  useEffect(() => {
    registerPushToken();
    refreshUnread();
    intervalRef.current = setInterval(refreshUnread, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, ticketUnreadCount, dmUnreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}
