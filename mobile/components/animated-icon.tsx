import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";

// PLACEHOLDER — the real animated splash transition wasn't uploaded.
// This just hides the native splash screen once the JS bundle is ready,
// so the app boots. Replace with the real animation when you have it.
export function AnimatedSplashOverlay() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return null;
}
