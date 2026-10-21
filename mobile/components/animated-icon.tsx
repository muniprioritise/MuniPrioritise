import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";

// Hides the native splash screen once the JS bundle is ready.
export function AnimatedSplashOverlay() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return null;
}
