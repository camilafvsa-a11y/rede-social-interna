import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, Text } from "react-native";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";

const C = Colors.light;

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Feed</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="channels">
        <Icon sf={{ default: "number", selected: "number" }} />
        <Label>Canais</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="integra">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Integra</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tickets">
        <Icon sf={{ default: "questionmark.bubble", selected: "questionmark.bubble.fill" }} />
        <Label>Chamados</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Perfil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { unreadCount, ticketUnreadCount, dmUnreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.tint,
        tabBarInactiveTintColor: C.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "#fff",
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }]} />
          ),
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => (
            <View style={{ position: "relative" }}>
              {isIOS ? <SymbolView name="house" tintColor={color} size={24} /> : <Feather name="home" size={22} color={color} />}
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
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="number" tintColor={color} size={24} /> : <Feather name="hash" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="integra"
        options={{
          title: "Integra",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="doc.text" tintColor={color} size={24} /> : <Feather name="file-text" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Chamados",
          tabBarIcon: ({ color }) => (
            <View style={{ position: "relative" }}>
              {isIOS ? <SymbolView name="questionmark.bubble" tintColor={color} size={24} /> : <Feather name="help-circle" size={22} color={color} />}
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
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="person" tintColor={color} size={24} /> : <Feather name="user" size={22} color={color} />,
        }}
      />
      {/* Hide old birthdays tab if still present */}
      <Tabs.Screen name="birthdays" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
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
