import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import StatusBadge from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/services/apiError";
import { getMyReports } from "@/services/reportsService";
import type { Report } from "@/types/report";

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
      console.error("Failed to load reports:", err);
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
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Reports</Text>
        <Text style={styles.subtitle}>{reports.length} report{reports.length === 1 ? "" : "s"}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/report/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.category}>{item.category}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          error ? null : (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>You haven&apos;t submitted any reports yet.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6F8" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  subtitle: { fontSize: 13, color: "#6B6B6B", marginTop: 2 },
  error: { color: "#A61212", paddingHorizontal: 16, marginBottom: 8 },
  listContent: { paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 4, padding: 16, marginHorizontal: 16, marginVertical: 6, borderWidth: 1, borderColor: "#EAEAEA" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  category: { fontSize: 16, fontWeight: "600", color: "#1A1A1A" },
  description: { fontSize: 14, color: "#3A3A3A", marginBottom: 6 },
  date: { fontSize: 12, color: "#9A9A9A" },
  emptyText: { fontSize: 14, color: "#6B6B6B" },
});

