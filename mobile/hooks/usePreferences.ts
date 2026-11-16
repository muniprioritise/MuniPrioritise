import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from "@/utils/preferences";

// Loads the saved preferences every time the screen comes into focus.
// Tabs stay mounted, so a change made on the Settings screen shows up on
// Home and Map as soon as the person goes back to them.
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      loadPreferences().then((saved) => {
        if (active) {
          setPreferences(saved);
        }
      });

      return () => {
        active = false;
      };
    }, [])
  );

  const update = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      const next = { ...preferences, [key]: value };
      setPreferences(next);
      void savePreferences(next);
    },
    [preferences]
  );

  const reset = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    void savePreferences(DEFAULT_PREFERENCES);
  }, []);

  return { preferences, update, reset };
}
