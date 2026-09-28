import { Stack } from "expo-router";

export default function JobsLayout() {
  return (
    <Stack>
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
        name="status/[id]"
        options={{
          title: "Update Status",
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