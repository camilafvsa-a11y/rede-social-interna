import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="emails" />
      <Stack.Screen name="channels" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="ticket-handlers" />
    </Stack>
  );
}
