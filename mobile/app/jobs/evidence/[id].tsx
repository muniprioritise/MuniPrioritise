import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import Button from "@/components/Button";
import Screen, { CONTENT_EDGES } from "@/components/Screen";
import TextField from "@/components/TextField";
import { theme } from "@/constants/theme";
import { resolveJob } from "@/services/jobsService";

const { colors, spacing } = theme;
const MAX_PHOTOS = 5;

export default function EvidenceScreen() {
  const params = useLocalSearchParams<{
    id: string;
    jobId: string;
  }>();

  const [imageUris, setImageUris] = useState<string[]>([]);

  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const addImages = (uris: string[]) => {
    setImageUris((current) => {
      const combined = [...current, ...uris];
      return combined.slice(0, MAX_PHOTOS);
    });
  };

  const removeImage = (uri: string) => {
    setImageUris((current) => current.filter((existing) => existing !== uri));
  };

  const pickImage = async () => {
    if (imageUris.length >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_PHOTOS} photos.`);

      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Photo access is required to upload evidence.");

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - imageUris.length,
    });

    if (!result.canceled) {
      addImages(result.assets.map((asset) => asset.uri));
    }
  };

  const takePhoto = async () => {
    if (imageUris.length >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_PHOTOS} photos.`);

      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is required.");

      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      addImages([result.assets[0].uri]);
    }
  };

  const submitEvidence = async () => {
    if (imageUris.length === 0) {
      Alert.alert("Photo required", "Please provide at least one photo of completion evidence.");

      return;
    }

    if (!notes.trim()) {
      Alert.alert("Notes required", "Please provide completion notes.");

      return;
    }

    try {
      setSubmitting(true);

      await resolveJob(params.jobId, imageUris, notes.trim());

      Alert.alert("Job resolved", "Evidence uploaded successfully.", [
        {
          text: "Done",

          onPress: () => router.replace("/jobs"),
        },
      ]);
    } catch (error) {
      console.error(error);

      Alert.alert("Upload failed", "Could not submit completion evidence.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll edges={CONTENT_EDGES} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Completion evidence</Text>

      <Text style={styles.subtitle}>Add up to {MAX_PHOTOS} photos and notes before resolving the job.</Text>

      {imageUris.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoRow}
          contentContainerStyle={styles.photoRowContent}
        >
          {imageUris.map((uri) => (
            <View key={uri} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                style={styles.removeButton}
                hitSlop={8}
                onPress={() => removeImage(uri)}
              >
                <Ionicons name="close-circle" size={28} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="images-outline" size={36} color={colors.muted} />
          <Text style={styles.placeholderText}>No photos selected</Text>
        </View>
      )}

      <Text style={styles.photoCount}>
        {imageUris.length} / {MAX_PHOTOS} photos
      </Text>

      <View style={styles.buttonRow}>
        <Button title="Take Photo" icon="camera-outline" variant="secondary" onPress={takePhoto} style={styles.buttonHalf} />
        <Button title="Gallery" icon="image-outline" variant="secondary" onPress={pickImage} style={styles.buttonHalf} />
      </View>

      <TextField
        label="Completion notes"
        placeholder="Describe the work completed..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={5}
        style={styles.notes}
      />

      <Button title="Submit & Resolve" icon="checkmark-done" onPress={submitEvidence} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  title: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: theme.font.small, color: colors.muted, marginTop: 2, marginBottom: spacing.xl, lineHeight: 20 },
  photoRow: { marginBottom: spacing.sm },
  photoRowContent: { paddingTop: spacing.sm, paddingRight: spacing.sm, gap: spacing.md },
  photoWrapper: { position: "relative" },
  photo: { width: 140, height: 140, borderRadius: theme.radius.md },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  placeholder: {
    height: 140,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  placeholderText: { fontSize: theme.font.small, color: colors.muted },
  photoCount: { fontSize: theme.font.caption, color: colors.muted, marginBottom: spacing.md },
  buttonRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  buttonHalf: { flex: 1, paddingHorizontal: spacing.sm },
  notes: { minHeight: 120, paddingTop: spacing.md, textAlignVertical: "top" },
});
