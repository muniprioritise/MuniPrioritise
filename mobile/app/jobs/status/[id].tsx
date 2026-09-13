import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import {
  acceptJob,
  updateReportStatus,
} from "@/services/jobsService";

import { useState } from "react";

export default function StatusScreen() {
  const params =
    useLocalSearchParams<{
      id: string;
      jobId: string;
    }>();

  const [currentStep, setCurrentStep] =
    useState<
      | "pending"
      | "assigned"
      | "en_route"
      | "in_progress"
    >("pending");

  const [loading, setLoading] =
    useState(false);

  const runAction = async (
    action: () => Promise<void>
  ) => {
    try {
      setLoading(true);
      await action();
    } catch (error) {
      console.error(error);

      Alert.alert(
        "Update failed",
        "The job could not be updated."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    runAction(async () => {
      await acceptJob(
        params.jobId
      );

      setCurrentStep(
        "assigned"
      );

      Alert.alert(
        "Job accepted",
        "This job has been assigned to you."
      );
    });
  };

  const handleEnRoute = () => {
    setCurrentStep(
      "en_route"
    );

    Alert.alert(
      "En Route",
      "Job marked as en route on this device."
    );
  };

  const handleInProgress =
    () => {
      runAction(async () => {
        await updateReportStatus(
          params.id,
          "in_progress",
          "Worker started job"
        );

        setCurrentStep(
          "in_progress"
        );

        Alert.alert(
          "Job started",
          "Status changed to In Progress."
        );
      });
    };

  const handleResolved = () => {
    router.push({
      pathname:
        "/jobs/evidence/[id]",

      params: {
        id: params.id,
        jobId:
          params.jobId,
      },
    });
  };

  const handleEscalate = () => {
    router.push({
      pathname:
        "/jobs/escalation/[id]",

      params: {
        id: params.id,
        jobId:
          params.jobId,
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Job Progress
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        Update the job as work
        progresses.
      </Text>

      <View
        style={styles.card}
      >
        <Step
          title="1. Accept"
          complete={
            currentStep !==
            "pending"
          }
        />

        <Step
          title="2. En Route"
          complete={
            currentStep ===
              "en_route" ||
            currentStep ===
              "in_progress"
          }
        />

        <Step
          title="3. In Progress"
          complete={
            currentStep ===
            "in_progress"
          }
        />

        <Step
          title="4. Resolve"
          complete={false}
        />
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          currentStep !==
            "pending" &&
            styles.disabledButton,
        ]}
        disabled={
          currentStep !==
            "pending" ||
          loading
        }
        onPress={
          handleAccept
        }
      >
        <Text
          style={
            styles.primaryText
          }
        >
          Accept Job
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          currentStep !==
            "assigned" &&
            styles.disabledButton,
        ]}
        disabled={
          currentStep !==
          "assigned"
        }
        onPress={
          handleEnRoute
        }
      >
        <Text
          style={
            styles.primaryText
          }
        >
          Mark En Route
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          currentStep !==
            "en_route" &&
            styles.disabledButton,
        ]}
        disabled={
          currentStep !==
            "en_route" ||
          loading
        }
        onPress={
          handleInProgress
        }
      >
        <Text
          style={
            styles.primaryText
          }
        >
          Start Work
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.resolveButton,
          currentStep !==
            "in_progress" &&
            styles.disabledButton,
        ]}
        disabled={
          currentStep !==
          "in_progress"
        }
        onPress={
          handleResolved
        }
      >
        <Text
          style={
            styles.primaryText
          }
        >
          Resolve Job
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={
          styles.escalateButton
        }
        onPress={
          handleEscalate
        }
      >
        <Text
          style={
            styles.escalateText
          }
        >
          Escalate Job
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Step({
  title,
  complete,
}: {
  title: string;
  complete: boolean;
}) {
  return (
    <View
      style={styles.step}
    >
      <View
        style={[
          styles.stepCircle,
          complete &&
            styles.stepComplete,
        ]}
      >
        <Text
          style={
            styles.stepSymbol
          }
        >
          {complete ? "✓" : ""}
        </Text>
      </View>

      <Text
        style={styles.stepText}
      >
        {title}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F5F6F8",
    },

    content: {
      padding: 18,
      paddingBottom: 40,
    },

    title: {
      fontSize: 26,
      fontWeight: "700",
      color: "#1A1A1A",
    },

    subtitle: {
      marginTop: 5,
      marginBottom: 20,
      color: "#6B6B6B",
    },

    card: {
      backgroundColor:
        "#FFFFFF",
      padding: 18,
      borderRadius: 12,
      marginBottom: 20,
    },

    step: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 10,
    },

    stepCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor:
        "#AAAAAA",
      alignItems: "center",
      justifyContent:
        "center",
      marginRight: 12,
    },

    stepComplete: {
      backgroundColor:
        "#16A34A",
      borderColor:
        "#16A34A",
    },

    stepSymbol: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    stepText: {
      fontSize: 16,
      color: "#333333",
    },

    primaryButton: {
      backgroundColor:
        "#3A6EA5",
      padding: 16,
      borderRadius: 10,
      alignItems: "center",
      marginBottom: 12,
    },

    resolveButton: {
      backgroundColor:
        "#16A34A",
      padding: 16,
      borderRadius: 10,
      alignItems: "center",
      marginBottom: 12,
    },

    primaryText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },

    disabledButton: {
      opacity: 0.35,
    },

    escalateButton: {
      borderWidth: 1,
      borderColor:
        "#A61212",
      padding: 16,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 10,
    },

    escalateText: {
      color: "#A61212",
      fontWeight: "700",
    },
  });
