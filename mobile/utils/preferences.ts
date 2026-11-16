import * as SecureStore from "expo-secure-store";

// Resident preferences, saved on the device so they survive closing the app.
// They are stored as one JSON string, the same way the login session is kept.
const PREFERENCES_KEY = "muniprioritise.preferences";

export type MapStyle = "standard" | "satellite";
export type ReportOrder = "newest" | "oldest" | "severity";

export interface Preferences {
  mapStyle: MapStyle;
  reportOrder: ReportOrder;
  compactCards: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  mapStyle: "standard",
  reportOrder: "newest",
  compactCards: false,
};

const MAP_STYLES: MapStyle[] = ["standard", "satellite"];
const REPORT_ORDERS: ReportOrder[] = ["newest", "oldest", "severity"];

// Anything missing or invalid falls back to the default, so a bad or old
// saved value can never break a screen.
function sanitise(raw: unknown): Preferences {
  const value = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Record<keyof Preferences, unknown>>;

  return {
    mapStyle: MAP_STYLES.includes(value.mapStyle as MapStyle) ? (value.mapStyle as MapStyle) : DEFAULT_PREFERENCES.mapStyle,
    reportOrder: REPORT_ORDERS.includes(value.reportOrder as ReportOrder)
      ? (value.reportOrder as ReportOrder)
      : DEFAULT_PREFERENCES.reportOrder,
    compactCards: typeof value.compactCards === "boolean" ? value.compactCards : DEFAULT_PREFERENCES.compactCards,
  };
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    const stored = await SecureStore.getItemAsync(PREFERENCES_KEY);
    return stored ? sanitise(JSON.parse(stored)) : DEFAULT_PREFERENCES;
  } catch (err) {
    console.log("Failed to load preferences:", err);
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.log("Failed to save preferences:", err);
  }
}
