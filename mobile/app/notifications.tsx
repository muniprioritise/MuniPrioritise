import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import { getNotifications } from "@/services/notificationsService";
import type { AppNotification } from "@/types/notification";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setNotifications(await getNotifications());
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
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
  list: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 4, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#EAEAEA" },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#2563eb" },
  title: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  body: { fontSize: 13, color: "#3A3A3A", marginTop: 2 },
  time: { fontSize: 11, color: "#9A9A9A", marginTop: 6 },
});