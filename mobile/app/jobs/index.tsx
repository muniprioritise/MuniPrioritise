import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/Button";
import JobCard from "@/components/JobCard";
import Screen from "@/components/Screen";
import { theme } from "@/constants/theme";
import { getJobs } from "@/services/jobsService";
import { logout } from "@/services/authService";
import type { Job } from "@/types/job";

const { colors, spacing } = theme;

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setError(null);

      const data = await getJobs();
      setJobs(data);
    } catch (err) {
      console.log("Failed to load jobs:", err);

      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time this screen comes back into view, so a job accepted or
  // resolved on the next screens shows its new state when the worker returns.
  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadJobs();
  }, [loadJobs]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, []);

  const handleJobPress = (job: Job) => {
    router.push({
      pathname: "/jobs/job/[id]",
      params: {
        id: job.reportId,
        jobId: job.id,

        category: job.category,
        description: job.description,

        severity: job.severity,
        status: job.status,

        address: job.address,
        ward: job.ward,

        latitude: job.latitude !== null ? String(job.latitude) : "",

        longitude: job.longitude !== null ? String(job.longitude) : "",

        submittedAt: job.submittedAt,

        priorityScore: job.priorityScore !== undefined ? String(job.priorityScore) : "",
      },
    });
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={styles.errorTitle}>Unable to load jobs</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={loadJobs} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.title}>Your jobs</Text>
          <Text style={styles.subtitle}>
            {jobs.length} job{jobs.length === 1 ? "" : "s"} in your queue
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <JobCard job={item} onPress={() => handleJobPress(item)} />}
        contentContainerStyle={[styles.listContent, jobs.length === 0 && styles.emptyListContent]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done" size={36} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No jobs available</Text>
            <Text style={styles.emptyText}>There are currently no assigned jobs in your queue.</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, gap: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTextGroup: { flexShrink: 1 },
  title: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: theme.font.small, color: colors.muted, marginTop: 2 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: theme.hit,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: theme.radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  logoutButtonText: { color: colors.danger, fontSize: theme.font.small, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  emptyListContent: { flexGrow: 1 },
  loadingText: { fontSize: theme.font.small, color: colors.muted },
  errorTitle: { fontSize: theme.font.heading, fontWeight: "700", color: colors.text },
  errorText: { fontSize: theme.font.small, color: colors.danger, textAlign: "center", marginBottom: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xxl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: theme.font.heading, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: theme.font.small, color: colors.muted, textAlign: "center", lineHeight: 20 },
});
