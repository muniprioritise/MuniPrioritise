import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import JobCard from "@/components/JobCard";
import { getJobs } from "@/services/jobsService";
import type { Job } from "@/types/job";

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
      console.error("Failed to load jobs:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load jobs"
      );
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

        latitude:
          job.latitude !== null
            ? String(job.latitude)
            : "",

        longitude:
          job.longitude !== null
            ? String(job.longitude)
            : "",

        submittedAt: job.submittedAt,

        priorityScore:
          job.priorityScore !== undefined
            ? String(job.priorityScore)
            : "",
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#3A6EA5"
        />

        <Text style={styles.loadingText}>
          Loading jobs...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>
          Unable to load jobs
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadJobs}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>
            Retry
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          Worker Jobs
        </Text>

        <Text style={styles.subtitle}>
          {jobs.length} job
          {jobs.length === 1 ? "" : "s"} in your queue
        </Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() => handleJobPress(item)}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          jobs.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              No jobs available
            </Text>

            <Text style={styles.emptyText}>
              There are currently no assigned jobs
              in your queue.
            </Text>
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
    backgroundColor: "#F5F6F8",
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
  },

  subtitle: {
    fontSize: 13,
    color: "#6B6B6B",
    marginTop: 4,
  },

  listContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B6B6B",
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },

  errorText: {
    fontSize: 14,
    color: "#A61212",
    textAlign: "center",
    marginBottom: 16,
  },

  retryButton: {
    backgroundColor: "#3A6EA5",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    color: "#6B6B6B",
    textAlign: "center",
  },
});