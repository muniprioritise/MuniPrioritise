import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";

import Button from "@/components/Button";
import Card from "@/components/Card";
import CategoryIcon from "@/components/CategoryIcon";
import RateResolutionModal from "@/components/RateResolutionModal";
import Screen from "@/components/Screen";
import StatusBadge from "@/components/StatusBadge";
import StatusTimeline from "@/components/StatusTimeLine";
import { severityLevel } from "@/constants/severity";
import { theme } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/apiError";
import { deleteReport, getReportById, rateReport } from "@/services/reportsService";
import type { Report } from "@/types/report";
import { formatDateTime } from "@/utils/format";

const { colors, spacing } = theme;
const CONTENT_EDGES = ["left", "right", "bottom"] as const;

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

  const handleDelete = async () => {
    if (!report) return;

    try {
      await deleteReport(report.id);
      router.back();
    } catch (err) {
      console.error("Failed to delete report:", err);
      Alert.alert(
        "Delete failed",
        getApiErrorMessage(err, "Could not delete this report. Please try again.")
      );
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete this report?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleDelete },
    ]);
  };

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
          <Button title="Try again" variant="secondary" onPress={loadReport} />
        </View>
      </Screen>
    );
  }

  if (!report) {
    return (
      <Screen edges={[...CONTENT_EDGES]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Report not found.</Text>
        </View>
      </Screen>
    );
  }

  const level = severityLevel(report.severity);

  return (
    <Screen scroll edges={[...CONTENT_EDGES]} contentContainerStyle={styles.content}>
      <Card style={styles.block}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <CategoryIcon category={report.category} size={24} color={colors.brand} />
          </View>
          <Text style={styles.category}>{report.category}</Text>
          <StatusBadge status={report.status} />
        </View>

        {report.photoUrl ? <Image source={{ uri: report.photoUrl }} style={styles.photo} contentFit="cover" /> : null}

        <Text style={styles.description}>{report.description}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="speedometer-outline" size={18} color={level.color} />
          <Text style={[styles.metaText, { color: level.color }]}>
            {level.label} severity ({report.severity}/5)
          </Text>
        </View>
        {report.address ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={colors.muted} />
            <Text style={styles.metaText}>{report.address}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text style={styles.metaText}>Submitted {formatDateTime(report.createdAt)}</Text>
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <StatusTimeline events={report.statusHistory} />
      </Card>

      {report.status === "resolved" && !report.rating ? (
        <Card style={styles.block}>
          <Text style={styles.rateText}>How was this resolved?</Text>
          <Button title="Rate this resolution" icon="star-outline" onPress={() => setRateModalVisible(true)} />
        </Card>
      ) : null}

      {report.rating ? (
        <View style={styles.rated}>
          <Ionicons name="checkmark-circle" size={20} color={colors.ok} />
          <Text style={styles.ratedText}>You rated this resolution {report.rating}/5</Text>
        </View>
      ) : null}

      {report.status === "submitted" ? (
        <Button title="Delete report" icon="trash-outline" variant="danger" onPress={confirmDelete} style={styles.delete} />
      ) : null}

      <RateResolutionModal visible={rateModalVisible} onClose={() => setRateModalVisible(false)} onSubmit={handleRate} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, gap: spacing.md },
  errorText: { color: colors.danger, textAlign: "center", fontSize: theme.font.body },
  block: { marginBottom: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  category: { flex: 1, fontSize: theme.font.heading, fontWeight: "800", color: colors.text },
  photo: { width: "100%", height: 200, borderRadius: theme.radius.md, marginBottom: spacing.lg },
  description: { fontSize: theme.font.body, color: colors.text, lineHeight: 24, marginBottom: spacing.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  metaText: { flex: 1, fontSize: theme.font.small, color: colors.muted },
  sectionTitle: { fontSize: theme.font.heading, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  rateText: { fontSize: theme.font.body, color: colors.text, marginBottom: spacing.md, textAlign: "center" },
  rated: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.lg },
  ratedText: { fontSize: theme.font.small, color: colors.ok, fontWeight: "600" },
  delete: { marginTop: spacing.sm },
});
