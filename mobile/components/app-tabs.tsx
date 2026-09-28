import { Tabs } from "expo-router";

export default function AppTabs() {
  return (
    <Tabs
      initialRouteName="login"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="login"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="supervisor"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
        }}
      />

      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
        }}
      />
    </Tabs>
  );
}