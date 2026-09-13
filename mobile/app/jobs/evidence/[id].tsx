import {
  Alert,
  Image,
  ScrollView,
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

import * as ImagePicker from "expo-image-picker";

import { useState } from "react";

import {
  updateReportStatus,
  uploadEvidence,
} from "@/services/jobsService";

export default function EvidenceScreen() {
  const params =
    useLocalSearchParams<{
      id: string;
      jobId: string;
    }>();

  const [imageUri, setImageUri] =
    useState<string | null>(
      null
    );

  const [notes, setNotes] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (
      !permission.granted
    ) {
      Alert.alert(
        "Permission required",
        "Photo access is required to upload evidence."
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync(
        {
          mediaTypes:
            ["images"],
          quality: 0.8,
        }
      );

    if (
      !result.canceled
    ) {
      setImageUri(
        result.assets[0].uri
      );
    }
  };

  const takePhoto = async () => {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (
      !permission.granted
    ) {
      Alert.alert(
        "Permission required",
        "Camera access is required."
      );

      return;
    }

    const result =
      await ImagePicker.launchCameraAsync(
        {
          quality: 0.8,
        }
      );

    if (
      !result.canceled
    ) {
      setImageUri(
        result.assets[0].uri
      );
    }
  };

  const submitEvidence =
    async () => {
      if (!imageUri) {
        Alert.alert(
          "Photo required",
          "Please provide completion evidence."
        );

        return;
      }

      if (!notes.trim()) {
        Alert.alert(
          "Notes required",
          "Please provide completion notes."
        );

        return;
      }

      try {
        setSubmitting(true);

        await uploadEvidence(
          params.id,
          imageUri,
          notes.trim()
        );

        await updateReportStatus(
          params.id,
          "resolved",
          notes.trim()
        );

        Alert.alert(
          "Job resolved",
          "Evidence uploaded successfully.",
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
          "Upload failed",
          "Could not submit completion evidence."
        );
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <ScrollView
      style={
        styles.container
      }
      contentContainerStyle={
        styles.content
      }
    >
      <Text
        style={styles.title}
      >
        Completion Evidence
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        Add a photo and notes
        before resolving the job.
      </Text>

      {imageUri ? (
        <Image
          source={{
            uri: imageUri,
          }}
          style={
            styles.image
          }
        />
      ) : (
        <View
          style={
            styles.placeholder
          }
        >
          <Text
            style={
              styles.placeholderText
            }
          >
            No photo selected
          </Text>
        </View>
      )}

      <View
        style={
          styles.buttonRow
        }
      >
        <TouchableOpacity
          style={
            styles.secondaryButton
          }
          onPress={
            takePhoto
          }
        >
          <Text
            style={
              styles.secondaryText
            }
          >
            Take Photo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.secondaryButton
          }
          onPress={
            pickImage
          }
        >
          <Text
            style={
              styles.secondaryText
            }
          >
            Gallery
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={styles.label}
      >
        Completion Notes
      </Text>

      <TextInput
        style={
          styles.input
        }
        multiline
        numberOfLines={5}
        placeholder="Describe the work completed..."
        value={notes}
        onChangeText={
          setNotes
        }
      />

      <TouchableOpacity
        style={
          styles.submitButton
        }
        disabled={
          submitting
        }
        onPress={
          submitEvidence
        }
      >
        <Text
          style={
            styles.submitText
          }
        >
          {submitting
            ? "Submitting..."
            : "Submit & Resolve"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
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
    },

    subtitle: {
      color: "#6B6B6B",
      marginTop: 5,
      marginBottom: 20,
    },

    image: {
      width: "100%",
      height: 250,
      borderRadius: 12,
      marginBottom: 15,
    },

    placeholder: {
      height: 220,
      backgroundColor:
        "#E5E7EB",
      borderRadius: 12,
      justifyContent:
        "center",
      alignItems: "center",
      marginBottom: 15,
    },

    placeholderText: {
      color: "#6B7280",
    },

    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },

    secondaryButton: {
      flex: 1,
      padding: 14,
      borderWidth: 1,
      borderColor:
        "#3A6EA5",
      borderRadius: 10,
      alignItems: "center",
    },

    secondaryText: {
      color: "#3A6EA5",
      fontWeight: "700",
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
      minHeight: 120,
      textAlignVertical:
        "top",
    },

    submitButton: {
      marginTop: 20,
      backgroundColor:
        "#16A34A",
      padding: 16,
      borderRadius: 10,
      alignItems: "center",
    },

    submitText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 16,
    },
  });