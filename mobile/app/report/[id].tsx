import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";

import StatusBadge from "@/components/StatusBadge";
import StatusTimeline from "@/components/StatusTimeLine";
import RateResolutionModal from "@/components/RateResolutionModal";
import { getApiErrorMessage } from "@/services/apiError";
import { getReportById, rateReport } from "@/services/reportsService";
import type { Report } from "@/types/report";

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateModalVisible, setRateModalVisible] = useState(false);

  const loadReport = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      setReport(await getReportById(id));
    } catch (err) {
      console.error("Failed to load report:", err);
      setError(getApiErrorMessage(err, "Could not load this report."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleRate = async (rating: number) => {
    if (!report) return;

    try {
      await rateReport(report.id, rating);
      setReport({ ...report, rating });
      setRateModalVisible(false);
    } catch (err) {
      console.error("Failed to submit rating:", err);
      Alert.alert(
        "Rating failed",
        getApiErrorMessage(err, "Could not save your rating. Please try again.")
      );
    }
  };

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
        <TouchableOpacity style={styles.retryButton} onPress={loadReport}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centered}>
        <Text>Report not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.category}>{report.category}</Text>
        <StatusBadge status={report.status} />
      </View>

      {report.photoUrl ? <Image source={{ uri: report.photoUrl }} style={styles.photo} contentFit="cover" /> : null}

      <Text style={styles.description}>{report.description}</Text>
      <Text style={styles.meta}>Severity: {report.severity}/5</Text>
      {report.address ? <Text style={styles.meta}>{report.address}</Text> : null}
      <Text style={styles.meta}>Submitted {new Date(report.createdAt).toLocaleString()}</Text>

      <Text style={styles.sectionTitle}>Status Timeline</Text>
      <StatusTimeline events={report.statusHistory} />

      {report.status === "resolved" && !report.rating ? (
        <View style={styles.rateSection}>
          <Text style={styles.rateSectionText}>How was this resolved?</Text>
          <Text style={styles.rateButton} onPress={() => setRateModalVisible(true)}>Rate this resolution</Text>
        </View>
      ) : null}

      {report.rating ? <Text style={styles.ratedText}>You rated this resolution {report.rating}/5</Text> : null}

      <RateResolutionModal visible={rateModalVisible} onClose={() => setRateModalVisible(false)} onSubmit={handleRate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#A61212", textAlign: "center", marginBottom: 16 },
  retryButton: { borderWidth: 1, borderColor: "#2563eb", borderRadius: 4, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: "#2563eb", fontWeight: "600" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  category: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  photo: { width: "100%", height: 200, borderRadius: 4, marginBottom: 16 },
  description: { fontSize: 15, color: "#3A3A3A", marginBottom: 8 },
  meta: { fontSize: 13, color: "#6B6B6B", marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  rateSection: { marginTop: 24, alignItems: "center" },
  rateSectionText: { fontSize: 14, color: "#3A3A3A", marginBottom: 8 },
  rateButton: { color: "#2563eb", fontWeight: "700" },
  ratedText: { marginTop: 24, fontSize: 14, color: "#1E7A1E", textAlign: "center" },
});

