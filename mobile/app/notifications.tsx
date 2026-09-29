import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { getApiErrorMessage } from "@/services/apiError";
import { getNotifications } from "@/services/notificationsService";
import type { AppNotification } from "@/types/notification";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setNotifications(await getNotifications());
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError(getApiErrorMessage(err, "Could not load notifications."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadNotifications}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, !item.read && styles.cardUnread]}
          onPress={() => item.reportId && router.push(`/report/${item.reportId}`)}
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text>No notifications yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#A61212", textAlign: "center", marginBottom: 16 },
  retryButton: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 4, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: "#2563eb", fontWeight: "600" },
  list: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 4, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EAEAEA" },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#2563eb" },
  title: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  body: { fontSize: 13, color: "#3A3A3A", marginTop: 2 },
  time: { fontSize: 11, color: "#9A9A9A", marginTop: 6 },
});

