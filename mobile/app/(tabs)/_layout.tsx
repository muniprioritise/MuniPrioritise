import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

import { theme } from "@/constants/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: IconName, inactive: IconName) {
  const TabIcon = ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={size + 2} color={color} />
  );
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: { fontSize: theme.font.caption, fontWeight: "600" },
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.stroke },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: tabIcon("home", "home-outline") }} />
      <Tabs.Screen name="submit" options={{ title: "Report", tabBarIcon: tabIcon("add-circle", "add-circle-outline") }} />
      <Tabs.Screen name="map" options={{ title: "Map", tabBarIcon: tabIcon("map", "map-outline") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("person", "person-outline") }} />
    </Tabs>
  );
}
