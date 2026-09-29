import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { api } from "@/config/api";
import type { AppNotification } from "@/types/notification";

const isExpoGo = Constants.appOwnership === "expo";

// Returns the Expo push token, or null when one can't be had (Expo Go,
// emulator, denied permission). The token is sent to the backend as an
// optional field on login, so callers must treat null as normal.
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
    console.log("Push notifications require a physical device.");
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

  // A real build needs the EAS project id to get a token.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return expoPushToken;
}

interface ApiNotification {
  id: string;
  report_id: string;
  new_status: string;
  category: string;
  occurred_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Submitted",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// The backend has no stored notifications. This list is built from the status
// changes on the resident's own reports, so it matches the pushes they get.
// There is no read state, so everything is reported as read.
export async function getNotifications(): Promise<AppNotification[]> {
  const response = await api.get<ApiNotification[]>("/notifications");

  return response.data.map((row) => ({
    id: row.id,
    title: "Report status updated",
    body: `Your ${capitalise(row.category)} report is now ${
      STATUS_LABELS[row.new_status] ?? row.new_status.replace(/_/g, " ")
    }.`,
    reportId: row.report_id,
    read: true,
    createdAt: row.occurred_at,
  }));
}
