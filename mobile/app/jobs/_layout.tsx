import { Stack } from "expo-router";

import { theme } from "@/constants/theme";

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.colors.brand,
        headerTitleStyle: { fontWeight: "700", color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="job/[id]"
        options={{
          title: "Job Detail",
        }}
      />

      <Stack.Screen
        name="evidence/[id]"
        options={{
          title: "Completion Evidence",
        }}
      />

      <Stack.Screen
        name="escalation/[id]"
        options={{
          title: "Escalate Job",
        }}
      />
    </Stack>
  );
}
