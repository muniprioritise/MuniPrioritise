import { useState, type ComponentProps } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import Button from "@/components/Button";
import Card from "@/components/Card";
import CategoryIcon from "@/components/CategoryIcon";
import JobStatusPill from "@/components/JobStatusPill";
import ProgressSteps from "@/components/ProgressSteps";
import Screen, { CONTENT_EDGES } from "@/components/Screen";
import { jobSeverityStyle } from "@/constants/severity";
import { theme } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/apiError";
import { acceptJob, updateReportStatus } from "@/services/jobsService";

const { colors, spacing } = theme;

type StepName = "pending" | "assigned" | "en_route" | "in_progress";
type IconName = ComponentProps<typeof Ionicons>["name"];

export default function JobDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    jobId: string;
    category: string;
    description: string;
    severity: string;
    status: string;
    address: string;
    ward: string;
    latitude: string;
    longitude: string;
    submittedAt: string;
    priorityScore: string;
  }>();

  const [status, setStatus] = useState(params.status);

  // The backend marks a job in_progress when it is accepted, so a job that is
  // no longer pending has already been accepted.
  const [currentStep, setCurrentStep] = useState<StepName>(
    params.status === "assigned" || params.status === "in_progress" ? "assigned" : "pending"
  );

  const [loading, setLoading] = useState(false);

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);

  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const severity = jobSeverityStyle(params.severity);
  const finished = status === "resolved" || status === "escalated";

  const openGoogleMaps = async () => {
    if (!hasCoordinates) return;

    const url = `https://www.google.com/maps/dir/?api=1` + `&destination=${latitude},${longitude}`;

    await Linking.openURL(url);
  };

  const openWaze = async () => {
    if (!hasCoordinates) return;

    const url = `https://waze.com/ul?ll=${latitude},${longitude}` + `&navigate=yes`;

    await Linking.openURL(url);
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      setLoading(true);
      await action();
    } catch (error) {
      console.error(error);

      Alert.alert("Update failed", getApiErrorMessage(error, "The job could not be updated."));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    runAction(async () => {
      await acceptJob(params.jobId);

      setStatus("in_progress");
      setCurrentStep("assigned");
    });
  };

  const handleEnRoute = () => {
    setCurrentStep("en_route");
  };

  const handleInProgress = () => {
    runAction(async () => {
      await updateReportStatus(params.id, "in_progress", "Worker started job");

      setCurrentStep("in_progress");
    });
  };

  const handleResolved = () => {
    router.push({
      pathname: "/jobs/evidence/[id]",

      params: {
        id: params.id,
        jobId: params.jobId,
      },
    });
  };

  const handleEscalate = () => {
    router.push({
      pathname: "/jobs/escalation/[id]",

      params: {
        id: params.id,
        jobId: params.jobId,
      },
    });
  };

  const steps = [
    { title: "Accept", complete: currentStep !== "pending" },
    { title: "En route", complete: currentStep === "en_route" || currentStep === "in_progress" },
    { title: "Working", complete: currentStep === "in_progress" },
    { title: "Resolve", complete: false },
  ];

  // One clear next action for the current step.
  const nextAction: Record<StepName, { title: string; icon: IconName; onPress: () => void }> = {
    pending: { title: "Accept Job", icon: "checkmark-circle-outline", onPress: handleAccept },
    assigned: { title: "Mark En Route", icon: "car-outline", onPress: handleEnRoute },
    en_route: { title: "Start Work", icon: "construct-outline", onPress: handleInProgress },
    in_progress: { title: "Resolve Job", icon: "flag-outline", onPress: handleResolved },
  };
  const action = nextAction[currentStep];

  return (
    <Screen edges={CONTENT_EDGES}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <CategoryIcon category={params.category ?? ""} size={28} color={colors.brand} />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.category}>{params.category}</Text>
            <Text style={styles.ward}>{params.ward}</Text>
          </View>

          <View style={[styles.severityBadge, { backgroundColor: severity.background }]}>
            <Text style={[styles.severityText, { color: severity.color }]}>{severity.label.toUpperCase()}</Text>
          </View>
        </View>

        <Card style={styles.section}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <JobStatusPill status={status} />
          </View>
          <ProgressSteps steps={steps} />
        </Card>

        {params.priorityScore ? (
          <View style={styles.priorityCard}>
            <Text style={styles.priorityLabel}>Priority score</Text>
            <Text style={styles.priorityValue}>{Math.round(Number(params.priorityScore) * 100)}%</Text>
          </View>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Report</Text>
          <Text style={styles.description}>{params.description}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={20} color={colors.brand} />
            <Text style={styles.address}>{params.address}</Text>
          </View>

          {hasCoordinates && (
            <Text style={styles.coordinates}>
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Text>
          )}

          <View style={styles.mapButtons}>
            <Button
              title="Google Maps"
              icon="navigate"
              onPress={openGoogleMaps}
              disabled={!hasCoordinates}
              style={styles.mapButton}
            />
            <Button
              title="Waze"
              icon="navigate-outline"
              variant="secondary"
              onPress={openWaze}
              disabled={!hasCoordinates}
              style={styles.mapButton}
            />
          </View>
        </Card>
      </ScrollView>

      {finished ? null : (
        <View style={styles.footer}>
          <Button title="Escalate" variant="danger" onPress={handleEscalate} style={styles.escalate} />
          <Button title={action.title} icon={action.icon} onPress={action.onPress} loading={loading} style={styles.primary} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, marginLeft: spacing.md },
  category: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
  ward: { marginTop: 2, fontSize: theme.font.small, color: colors.muted },
  severityBadge: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: theme.radius.pill },
  severityText: { fontSize: theme.font.caption, fontWeight: "800", letterSpacing: 0.4 },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  priorityCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: theme.radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priorityLabel: { fontSize: theme.font.small, color: colors.brand, fontWeight: "600" },
  priorityValue: { fontSize: 26, color: colors.brand, fontWeight: "800" },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: theme.font.caption,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  description: { marginTop: spacing.md, fontSize: theme.font.body, lineHeight: 24, color: colors.text },
  addressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  address: { flex: 1, fontSize: theme.font.body, fontWeight: "600", color: colors.text },
  coordinates: { marginTop: spacing.sm, fontSize: theme.font.caption, color: colors.muted },
  mapButtons: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.md },
  mapButton: { flex: 1, paddingHorizontal: spacing.sm },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
  },
  escalate: { flex: 1, paddingHorizontal: spacing.sm },
  primary: { flex: 2, paddingHorizontal: spacing.sm },
});
