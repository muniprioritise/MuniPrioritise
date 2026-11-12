import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import Button from "@/components/Button";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import { theme } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/apiError";
import { getNotifications } from "@/services/notificationsService";
import type { AppNotification } from "@/types/notification";
import { formatDateTime } from "@/utils/format";

const { colors, spacing } = theme;
const CONTENT_EDGES = ["left", "right", "bottom"] as const;

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
      console.log("Failed to load notifications:", err);
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
      <Screen edges={[...CONTENT_EDGES]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen edges={[...CONTENT_EDGES]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" variant="secondary" onPress={loadNotifications} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[...CONTENT_EDGES]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card
            style={[styles.card, !item.read && styles.cardUnread]}
            accessibilityLabel={`${item.title}. ${item.body}`}
            onPress={item.reportId ? () => router.push(`/report/${item.reportId}`) : undefined}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.read ? "notifications-outline" : "notifications"} size={20} color={colors.brand} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={32} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>You will see updates here when the status of a report changes.</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, gap: spacing.md },
  errorText: { color: colors.danger, textAlign: "center", fontSize: theme.font.body },
  list: { padding: spacing.lg, flexGrow: 1 },
  card: { marginBottom: spacing.md },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: colors.brand },
  cardRow: { flexDirection: "row" },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cardText: { flex: 1 },
  title: { fontSize: theme.font.body, fontWeight: "700", color: colors.text },
  body: { fontSize: theme.font.small, color: colors.text, marginTop: 2, lineHeight: 20 },
  time: { fontSize: theme.font.caption, color: colors.muted, marginTop: spacing.sm },
  empty: { alignItems: "center", paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: theme.font.heading, fontWeight: "700", color: colors.text },
  emptyText: { fontSize: theme.font.small, color: colors.muted, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
});
