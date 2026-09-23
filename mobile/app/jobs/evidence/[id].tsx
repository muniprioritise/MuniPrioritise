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

import { resolveJob } from "@/services/jobsService";

const MAX_PHOTOS = 5;

export default function EvidenceScreen() {
  const params =
    useLocalSearchParams<{
      id: string;
    }>();

  const [imageUris, setImageUris] =
    useState<string[]>([]);

  const [notes, setNotes] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const addImages = (uris: string[]) => {
    setImageUris((current) => {
      const combined = [...current, ...uris];
      return combined.slice(0, MAX_PHOTOS);
    });
  };

  const removeImage = (uri: string) => {
    setImageUris((current) =>
      current.filter((existing) => existing !== uri)
    );
  };

  const pickImage = async () => {
    if (imageUris.length >= MAX_PHOTOS) {
      Alert.alert(
        "Limit reached",
        `You can attach up to ${MAX_PHOTOS} photos.`
      );

      return;
    }

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
          allowsMultipleSelection: true,
          selectionLimit:
            MAX_PHOTOS - imageUris.length,
        }
      );

    if (
      !result.canceled
    ) {
      addImages(
        result.assets.map((asset) => asset.uri)
      );
    }
  };

  const takePhoto = async () => {
    if (imageUris.length >= MAX_PHOTOS) {
      Alert.alert(
        "Limit reached",
        `You can attach up to ${MAX_PHOTOS} photos.`
      );

      return;
    }

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
      addImages([result.assets[0].uri]);
    }
  };

  const submitEvidence =
    async () => {
      if (imageUris.length === 0) {
        Alert.alert(
          "Photo required",
          "Please provide at least one photo of completion evidence."
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

        await resolveJob(
          params.id,
          imageUris,
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
        Add up to {MAX_PHOTOS} photos and notes
        before resolving the job.
      </Text>

      {imageUris.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoRow}
          contentContainerStyle={
            styles.photoRowContent
          }
        >
          {imageUris.map((uri) => (
            <View
              key={uri}
              style={styles.photoWrapper}
            >
              <Image
                source={{ uri }}
                style={styles.photo}
              />

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(uri)}
              >
                <Text
                  style={styles.removeButtonText}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
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
            No photos selected
          </Text>
        </View>
      )}

      <Text style={styles.photoCount}>
        {imageUris.length} / {MAX_PHOTOS} photos
      </Text>

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

    photoRow: {
      marginBottom: 6,
    },

    photoRowContent: {
      gap: 10,
      paddingRight: 4,
    },

    photoWrapper: {
      position: "relative",
    },

    photo: {
      width: 140,
      height: 140,
      borderRadius: 12,
    },

    removeButton: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },

    removeButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      lineHeight: 16,
      fontWeight: "700",
    },

    placeholder: {
      height: 220,
      backgroundColor:
        "#E5E7EB",
      borderRadius: 12,
      justifyContent:
        "center",
      alignItems: "center",
      marginBottom: 6,
    },

    placeholderText: {
      color: "#6B7280",
    },

    photoCount: {
      fontSize: 12,
      color: "#6B6B6B",
      marginBottom: 14,
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
