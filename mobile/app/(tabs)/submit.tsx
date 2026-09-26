import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";

import { createReport } from "@/services/reportsService";
import type { ReportCategory } from "@/types/report";

const CATEGORIES: ReportCategory[] = ["Water", "Electricity", "Roads", "Refuse", "Sanitation"];

export default function SubmitReportScreen() {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(1);
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

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera access is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Gallery access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
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
    } catch {
      Alert.alert("Couldn't get location", "Try again in an open area.");
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!category) return Alert.alert("Missing category", "Please select an issue category.");
    if (!description.trim()) return Alert.alert("Missing description", "Please describe the issue.");
    if (!location) return Alert.alert("Missing location", "Tap 'Use my current location' first.");

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
      setCategory(null);
      setDescription("");
      setSeverity(1);
      setPhotoUri(null);
      setLocation(null);
      router.push("/(tabs)/home");
    } catch {
      Alert.alert("Submission failed", "Could not send your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report an Issue</Text>

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryButton, category === cat && styles.categoryButtonSelected]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextSelected]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Describe the issue..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Severity ({severity}/5)</Text>
      <View style={styles.severityRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.severitySegment, value <= severity && styles.severitySegmentActive]}
            onPress={() => setSeverity(value)}
          >
            <Text style={[styles.severityText, value <= severity && styles.severityTextActive]}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Photo</Text>
      <TouchableOpacity style={styles.actionButton} onPress={handlePickPhoto}>
        <Text style={styles.actionButtonText}>{photoUri ? "Change photo" : "Add photo"}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Location</Text>
      <TouchableOpacity style={styles.actionButton} onPress={handleGetLocation} disabled={gettingLocation}>
        {gettingLocation ? <ActivityIndicator /> : (
          <Text style={styles.actionButtonText}>{location ? "Update my location" : "Use my current location"}</Text>
        )}
      </TouchableOpacity>
      {location ? (
        <Text style={styles.locationText}>Lat: {location.latitude.toFixed(5)}, Lng: {location.longitude.toFixed(5)}</Text>
      ) : null}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Report"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  categoryRow: { flexDirection: "row" },
  categoryButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4, borderWidth: 1, borderColor: "#999", marginRight: 8 },
  categoryButtonSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  categoryText: { color: "#333" },
  categoryTextSelected: { color: "#fff" },
  textInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 12, textAlignVertical: "top", minHeight: 100 },
  severityRow: { flexDirection: "row" },
  severitySegment: { flex: 1, paddingVertical: 12, marginRight: 8, borderRadius: 4, borderWidth: 1, borderColor: "#999", alignItems: "center" },
  severitySegmentActive: { backgroundColor: "#B5460A", borderColor: "#B5460A" },
  severityText: { color: "#333", fontWeight: "600" },
  severityTextActive: { color: "#fff" },
  actionButton: { borderWidth: 1, borderColor: "#999", borderRadius: 4, padding: 12, alignItems: "center" },
  actionButtonText: { color: "#333", fontWeight: "600" },
  locationText: { fontSize: 13, color: "#6B6B6B", marginTop: 8 },
  submitButton: { backgroundColor: "#16a34a", padding: 16, borderRadius: 4, alignItems: "center", marginTop: 32 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});