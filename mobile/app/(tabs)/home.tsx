import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import Button from "@/components/Button";
import CategoryIcon from "@/components/CategoryIcon";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import StatusBadge from "@/components/StatusBadge";
import { severityLevel } from "@/constants/severity";
import { theme } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/apiError";
import { getMyReports } from "@/services/reportsService";
import type { Report } from "@/types/report";
import { formatDate } from "@/utils/format";

const { colors, spacing } = theme;

export default function HomeScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setError(null);
      setReports(await getMyReports());
    } catch (err) {
      console.log("Failed to load reports:", err);
      setError(getApiErrorMessage(err, "Failed to load your reports"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Tabs stay mounted, so reload every time this screen comes into focus.
  // Otherwise a report submitted on the Submit tab would not appear here.
  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your reports</Text>
          <Text style={styles.subtitle}>
            {reports.length} report{reports.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
          onPress={() => router.push("/notifications")}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.brand} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            accessibilityLabel={`${item.category} report, ${item.status}`}
            onPress={() => router.push(`/report/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}>
                <CategoryIcon category={item.category} size={22} color={colors.brand} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>
              <StatusBadge status={item.status} />
            </View>

            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>

            <View style={styles.severityRow}>
              <Ionicons name="speedometer-outline" size={16} color={severityLevel(item.severity).color} />
              <Text style={[styles.severityText, { color: severityLevel(item.severity).color }]}>
                Severity {item.severity}/5
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="document-text-outline" size={36} color={colors.brand} />
              </View>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyText}>See a broken streetlight, a leak or a pothole? Tell your municipality.</Text>
              <Button title="Report an issue" onPress={() => router.navigate("/(tabs)/submit")} style={styles.emptyButton} />
            </View>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: theme.font.small, color: colors.muted, marginTop: 2 },
  bell: {
    width: theme.hit,
    height: theme.hit,
    borderRadius: theme.radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: theme.radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: theme.font.small },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: { flex: 1, marginLeft: spacing.md },
  category: { fontSize: theme.font.body, fontWeight: "700", color: colors.text },
  date: { fontSize: theme.font.caption, color: colors.muted, marginTop: 2 },
  description: { fontSize: theme.font.small, color: colors.text, lineHeight: 20, marginBottom: spacing.md },
  severityRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  severityText: { fontSize: theme.font.caption, fontWeight: "600" },
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
  emptyButton: { marginTop: spacing.xl, alignSelf: "stretch" },
});
