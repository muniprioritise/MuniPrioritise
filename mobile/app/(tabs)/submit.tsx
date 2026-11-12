import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";

import Button from "@/components/Button";
import CategoryIcon from "@/components/CategoryIcon";
import Screen from "@/components/Screen";
import TextField from "@/components/TextField";
import { SEVERITY_LEVELS, severityLevel } from "@/constants/severity";
import { theme } from "@/constants/theme";
import { getApiErrorMessage } from "@/services/apiError";
import { createReport } from "@/services/reportsService";
import type { ReportCategory } from "@/types/report";
import { findNearbyDuplicate } from "@/utils/duplicates";

const { colors, spacing } = theme;
const DESCRIPTION_MAX = 500;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // matches the backend upload limit
const CATEGORIES: ReportCategory[] = ["Water", "Electricity", "Roads", "Refuse", "Sanitation"];

export default function SubmitReportScreen() {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePickPhoto = () => {
    Alert.alert("Add photo", "Choose a source", [
      { text: "Camera", onPress: takePhoto },
      { text: "Gallery", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // The backend rejects photos over 5MB, but on Android that surfaces as a
  // vague network error, so check the size here and say what is wrong.
  const acceptPhoto = (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      Alert.alert("Photo too large", "Each photo must be 5MB or smaller. Please choose a smaller photo or take a new one.");
      return;
    }
    setPhotoUri(asset.uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera access is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) acceptPhoto(result.assets[0]);
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Gallery access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) acceptPhoto(result.assets[0]);
  };

  const handleGetLocation = async () => {
    try {
      setGettingLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Location access is required.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      console.log("Failed to get location:", error);
      Alert.alert("Couldn't get location", "Try again in an open area.");
    } finally {
      setGettingLocation(false);
    }
  };

  const resetForm = () => {
    setCategory(null);
    setDescription("");
    setSeverity(null);
    setPhotoUri(null);
    setLocation(null);
  };

  const sendReport = async () => {
    if (!category || !location || severity === null) return;

    try {
      setSubmitting(true);
      await createReport({
        category,
        description: description.trim(),
        severity,
        photoUri: photoUri ?? undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      Alert.alert("Report submitted", "Your report was sent successfully.");
      resetForm();
      router.navigate("/(tabs)/home");
    } catch (error) {
      console.log("Failed to submit report:", error);
      Alert.alert(
        "Submission failed",
        getApiErrorMessage(error, "Could not send your report. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!category) return Alert.alert("Missing category", "Please select an issue category.");
    if (!description.trim()) return Alert.alert("Missing description", "Please describe the issue.");
    if (severity === null) return Alert.alert("Missing severity", "Please choose how serious the issue is.");
    if (!location) return Alert.alert("Missing location", "Tap 'Use my current location' first.");

    // Ask before filing a second report for a problem that is already open
    // close by. The resident decides, because only they can tell a repeat
    // from a second fault.
    setSubmitting(true);
    const duplicate = await findNearbyDuplicate(category, location.latitude, location.longitude);
    setSubmitting(false);

    if (duplicate) {
      Alert.alert(
        "Already reported nearby",
        `An open ${category.toLowerCase()} report was logged about ${Math.round(duplicate.distanceM)} m from you:\n\n"${duplicate.report.description || "No description"}"\n\nIs yours the same problem?`,
        [
          {
            text: "Yes, same problem",
            onPress: () => {
              Alert.alert("Thanks", "The municipality already has this one, so there is no need to report it again.");
              resetForm();
            },
          },
          { text: "No, a different problem", onPress: sendReport },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    await sendReport();
  };

  const level = severity === null ? null : severityLevel(severity);

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <Text style={styles.title}>Report an issue</Text>
      <Text style={styles.subtitle}>Tell your municipality what needs fixing.</Text>

      <Text style={styles.label}>What is the problem?</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const selected = category === cat;
          return (
            <Pressable
              key={cat}
              accessibilityRole="button"
              accessibilityLabel={cat}
              accessibilityState={{ selected }}
              style={[styles.categoryTile, selected && styles.categoryTileSelected]}
              onPress={() => setCategory(cat)}
            >
              <CategoryIcon category={cat} size={28} color={selected ? colors.onBrand : colors.brand} />
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{cat}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Describe the issue"
        placeholder="What is happening, and where exactly?"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        maxLength={DESCRIPTION_MAX}
        style={styles.textArea}
      />
      <Text style={styles.counter}>
        {description.length}/{DESCRIPTION_MAX}
      </Text>

      <Text style={styles.label}>How serious is it?</Text>
      <View style={styles.severityRow}>
        {SEVERITY_LEVELS.map((item) => {
          const active = severity !== null && item.value <= severity;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={`Severity ${item.value}, ${item.label}`}
              accessibilityState={{ selected: item.value === severity }}
              style={[styles.severitySegment, active && level && { backgroundColor: level.color, borderColor: level.color }]}
              onPress={() => setSeverity(item.value)}
            >
              <Text style={[styles.severityNumber, active && styles.severityNumberActive]}>{item.value}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.severityLabel, level ? { color: level.color } : { color: colors.muted }]}>
        {level && severity !== null ? `${level.label} (${severity}/5)` : "Tap a number to choose"}
      </Text>

      <Text style={styles.label}>Photo</Text>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" /> : null}
      <Button
        title={photoUri ? "Change photo" : "Add photo"}
        icon="camera-outline"
        variant="secondary"
        onPress={handlePickPhoto}
      />

      <Text style={styles.label}>Location</Text>
      {location ? (
        <View style={styles.locationOk}>
          <Ionicons name="checkmark-circle" size={20} color={colors.ok} />
          <Text style={styles.locationOkText}>Location captured</Text>
        </View>
      ) : null}
      <Button
        title={location ? "Update my location" : "Use my current location"}
        icon="locate"
        variant="secondary"
        loading={gettingLocation}
        onPress={handleGetLocation}
      />

      <Button title="Submit report" onPress={handleSubmit} loading={submitting} style={styles.submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  title: { fontSize: theme.font.title, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: theme.font.small, color: colors.muted, marginTop: 2, marginBottom: spacing.sm },
  label: { fontSize: theme.font.small, fontWeight: "600", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: spacing.lg },
  categoryTile: {
    width: "31%",
    minHeight: 84,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  categoryTileSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  categoryText: { fontSize: theme.font.small, fontWeight: "600", color: colors.text },
  categoryTextSelected: { color: colors.onBrand },
  textArea: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: "top" },
  counter: { fontSize: theme.font.small, color: colors.muted, textAlign: "right", marginTop: -spacing.md, marginBottom: spacing.lg },
  severityRow: { flexDirection: "row", gap: spacing.sm },
  severitySegment: {
    flex: 1,
    minHeight: theme.hit,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  severityNumber: { fontSize: theme.font.body, fontWeight: "700", color: colors.muted },
  severityNumberActive: { color: colors.onBrand },
  severityLabel: { fontSize: theme.font.small, fontWeight: "700", marginTop: spacing.sm },
  photo: { width: "100%", height: 180, borderRadius: theme.radius.md, marginBottom: spacing.md },
  locationOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.okSoft,
    borderRadius: theme.radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  locationOkText: { color: colors.ok, fontWeight: "600", fontSize: theme.font.small },
  submit: { marginTop: spacing.xxl },
});
