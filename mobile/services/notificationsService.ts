import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/config/api";
import type { AppNotification } from "@/types/notification";

const USE_MOCK_NOTIFICATIONS = true;
const isExpoGo = Constants.appOwnership === "expo";

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    console.log("Push notifications are not supported in Expo Go — requires a development build.");
    return null;
  }

  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device or configured emulator.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  return expoPushToken;
}

export async function savePushTokenToBackend(expoPushToken: string): Promise<void> {
  if (USE_MOCK_NOTIFICATIONS) {
    console.log("MOCK: would save push token", expoPushToken);
    return;
  }
  await api.post("/users/push-token", { expoPushToken });
}

export async function getNotifications(): Promise<AppNotification[]> {
  if (USE_MOCK_NOTIFICATIONS) {
    await new Promise((r) => setTimeout(r, 300));
    return [
      { id: "notif-1", title: "Report status updated", body: "Your Water report is now In Progress.", reportId: "report-001", read: false, createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
      { id: "notif-2", title: "Report resolved", body: "Your Roads report has been resolved.", reportId: "report-002", read: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    ];
  }
  const response = await api.get("/notifications");
  return response.data as AppNotification[];
}