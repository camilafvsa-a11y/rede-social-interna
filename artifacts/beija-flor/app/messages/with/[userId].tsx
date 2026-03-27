import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function OpenDmWithUser() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const { data: conv } = useQuery({
    queryKey: ["dm-with", userId],
    queryFn: () => api.get(`/dms/with/${userId}`),
    enabled: !!userId,
  });

  useEffect(() => {
    if (conv?.id) {
      router.replace(`/messages/${conv.id}` as any);
    }
  }, [conv?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={C.tint} />
    </View>
  );
}
