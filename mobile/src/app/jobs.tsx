import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import JobCard from "@/components/JobCard";
import { getJobs } from "@/services/jobsService";
import type { Job } from "@/types/job";

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setError(null);
      const data = await getJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadJobs();
  }, [loadJobs]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3A6EA5" />
        <Text style={styles.loadingText}>Loading jobs...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryButton} onPress={loadJobs}>
          Retry
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Worker Jobs</Text>
        <Text style={styles.subtitle}>
          {jobs.length} job{jobs.length === 1 ? "" : "s"} reported
        </Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <JobCard job={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No jobs reported right now.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B6B6B",
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B6B6B",
  },
  errorText: {
    fontSize: 14,
    color: "#A61212",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3A6EA5",
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B6B6B",
  },
});