import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { useState } from "react";

import {
  escalateJob,
  updateReportStatus,
} from "@/services/jobsService";

export default function EscalationScreen() {
  const params =
    useLocalSearchParams<{
      id: string;
      jobId: string;
    }>();

  const [notes, setNotes] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const submitEscalation =
    async () => {
      if (!notes.trim()) {
        Alert.alert(
          "Notes required",
          "Please explain why this job needs escalation."
        );

        return;
      }

      try {
        setSubmitting(true);

        await escalateJob(
          params.jobId,
          notes.trim()
        );

        await updateReportStatus(
          params.id,
          "escalated",
          notes.trim()
        );

        Alert.alert(
          "Job escalated",
          "The supervisor can now review this job.",
          [
            {
              text: "Done",

              onPress: () =>
                router.replace(
                  "/jobs"
                ),
            },
          ]
        );
      } catch (error) {
        console.error(
          error
        );

        Alert.alert(
          "Escalation failed",
          "The job could not be escalated."
        );
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <View
      style={styles.container}
    >
      <Text
        style={styles.title}
      >
        Escalate Job
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        Explain why this job
        cannot be completed normally
        or requires supervisor
        intervention.
      </Text>

      <Text
        style={styles.label}
      >
        Escalation Notes
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Example: specialist equipment is required..."
        multiline
        numberOfLines={6}
        value={notes}
        onChangeText={
          setNotes
        }
      />

      <TouchableOpacity
        style={
          styles.button
        }
        onPress={
          submitEscalation
        }
        disabled={
          submitting
        }
      >
        <Text
          style={
            styles.buttonText
          }
        >
          {submitting
            ? "Escalating..."
            : "Confirm Escalation"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 18,
      backgroundColor:
        "#F5F6F8",
    },

    title: {
      fontSize: 26,
      fontWeight: "700",
      color: "#1A1A1A",
    },

    subtitle: {
      marginTop: 6,
      marginBottom: 24,
      color: "#6B6B6B",
      lineHeight: 20,
    },

    label: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 8,
    },

    input: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#D1D5DB",
      borderRadius: 10,
      padding: 14,
      minHeight: 150,
      textAlignVertical:
        "top",
    },

    button: {
      backgroundColor:
        "#A61212",
      padding: 16,
      alignItems: "center",
      borderRadius: 10,
      marginTop: 20,
    },

    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
  });
