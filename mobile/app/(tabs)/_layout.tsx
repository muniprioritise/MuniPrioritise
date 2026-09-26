import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { Colors } from "@/constants/theme";

const TabIcon = ({ glyph, color, size }: { glyph: string; color: ColorValue; size: number }) => (
  <Text style={{ color, fontSize: size }}>{glyph}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="⌂" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "Submit",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="⊕" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="⌖" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <TabIcon glyph="♙" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}