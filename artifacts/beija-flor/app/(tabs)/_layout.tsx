import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, Text } from "react-native";
import Colors from "@/constants/colors";
import { useNotifications } from "@/context/NotificationContext";

const C = Colors.light;

export default function TabLayout() {
  const isIOS = Platform.OS === "ios";
  const { unreadCount, ticketUnreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.tint,
        tabBarInactiveTintColor: C.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(60,60,67,0.2)",
          elevation: 0,
          shadowOpacity: 0,
          ...(Platform.OS === "web" ? { height: 84 } : {}),
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10, marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: "relative" }}>
              {isIOS ? (
                <SymbolView name={focused ? "house.fill" : "house"} tintColor={color} size={24} />
              ) : (
                <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
              )}
              {unreadCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: "Canais",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "number.square.fill" : "number.square"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "grid" : "grid-outline"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="integra"
        options={{
          title: "Integra",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "doc.text.fill" : "doc.text"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "document-text" : "document-text-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: "Ranking",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "trophy.fill" : "trophy"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "trophy" : "trophy-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Chamados",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: "relative" }}>
              {isIOS ? (
                <SymbolView name={focused ? "questionmark.bubble.fill" : "questionmark.bubble"} tintColor={color} size={24} />
              ) : (
                <Ionicons name={focused ? "help-circle" : "help-circle-outline"} size={24} color={color} />
              )}
              {ticketUnreadCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{ticketUnreadCount > 99 ? "99+" : ticketUnreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "person.fill" : "person"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen name="birthdays" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBadge: {
    position: "absolute", top: -4, right: -8,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2, borderWidth: 1.5, borderColor: "#fff",
  },
  tabBadgeText: { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold" },
});
