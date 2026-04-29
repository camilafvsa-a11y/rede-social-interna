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
      <Stack.Screen name="terms" />
      <Stack.Screen name="user-detail" />
      <Stack.Screen name="doc-progress" />
      <Stack.Screen name="export-import" />
      <Stack.Screen name="test-lab" />
      <Stack.Screen name="preview-onboarding" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
