import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { api } from "@/config/api";

const CATEGORIES: string[] = ["Water", "Electricity", "Roads", "Refuse", "Sanitation"];

const HARDCODED_LOCATION = {
  latitude: -33.9249,
  longitude: 18.4241,
};

const HARDCODED_SEVERITY = 3;

export default function ReportScreen() {
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert("Missing category", "Please select an issue category.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing description", "Please describe the issue.");
      return;
    }

    const payload = {
      category: category.toLowerCase(),
      description: description.trim(),
      severity: HARDCODED_SEVERITY,
      lat: HARDCODED_LOCATION.latitude,
      lng: HARDCODED_LOCATION.longitude,
    };

    try {
      setSubmitting(true);
      await api.post("/reports", payload);
      Alert.alert("Report submitted", "Thanks — your report was sent successfully.");
      setCategory(null);
      setDescription("");
    } catch (error) {
      console.error(error);
      Alert.alert("Submission failed", "Could not send your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report an Issue</Text>

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat: string) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryButton,
              category === cat && styles.categoryButtonSelected,
            ]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[
                styles.categoryText,
                category === cat && styles.categoryTextSelected,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textInput}
        placeholder="Describe the issue..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Location</Text>
      <Text style={styles.locationText}>
        Lat: {HARDCODED_LOCATION.latitude}, Lng: {HARDCODED_LOCATION.longitude}
      </Text>
      <Text style={styles.locationNote}>(Cape Town CBD — hardcoded for now)</Text>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitText}>
          {submitting ? "Submitting..." : "Submit Report"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#999",
  },
  categoryButtonSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  categoryText: { color: "#333" },
  categoryTextSelected: { color: "#fff" },
  textInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    textAlignVertical: "top",
    minHeight: 100,
  },
  locationText: { fontSize: 15 },
  locationNote: { fontSize: 12, color: "#777", marginBottom: 10 },
  submitButton: {
    backgroundColor: "#16a34a",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
