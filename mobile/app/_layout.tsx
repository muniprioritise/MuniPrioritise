import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { theme } from "@/constants/theme";
import { AuthProvider } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

// The app is light-only, so one navigation theme styles every header.
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.brand,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.stroke,
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={navigationTheme}>
        <AnimatedSplashOverlay />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="jobs" />
          <Stack.Screen name="supervisor" />
          <Stack.Screen
            name="report/[id]"
            options={{ headerShown: true, title: "Report Detail" }}
          />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: true, title: "Notifications" }}
          />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
