import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import Button from "@/components/Button";
import Screen, { CONTENT_EDGES } from "@/components/Screen";
import TextField from "@/components/TextField";
import { theme } from "@/constants/theme";
import { escalateJob } from "@/services/jobsService";

const { colors, spacing } = theme;

export default function EscalationScreen() {
  const params = useLocalSearchParams<{
    id: string;
    jobId: string;
  }>();

  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const submitEscalation = async () => {
    if (!notes.trim()) {
      Alert.alert("Notes required", "Please explain why this job needs escalation.");

      return;
    }

    try {
      setSubmitting(true);

      // The backend updates the report status and logs the event.
      await escalateJob(params.jobId, notes.trim());

      Alert.alert("Job escalated", "The supervisor can now review this job.", [
        {
          text: "Done",

          onPress: () => router.replace("/jobs"),
        },
      ]);
    } catch (error) {
      console.log(error);

      Alert.alert("Escalation failed", "The job could not be escalated.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll edges={CONTENT_EDGES} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Escalate job</Text>

      <View style={styles.notice}>
        <Ionicons name="alert-circle" size={22} color={colors.warning} />
        <Text style={styles.noticeText}>
          Explain why this job cannot be completed normally or requires supervisor intervention.
        </Text>
      </View>

      <TextField
        label="Escalation notes"
        placeholder="Example: specialist equipment is required..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={6}
        style={styles.notes}
      />

      <Button title="Confirm Escalation" icon="arrow-up-circle-outline" variant="danger" onPress={submitEscalation} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  title: { fontSize: theme.font.title, fontWeight: "800", color: colors.text, marginBottom: spacing.lg },
  notice: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: theme.radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  noticeText: { flex: 1, fontSize: theme.font.small, color: colors.text, lineHeight: 20 },
  notes: { minHeight: 150, paddingTop: spacing.md, textAlignVertical: "top" },
});
