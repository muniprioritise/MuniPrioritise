import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface RateResolutionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number) => void | Promise<void>;
}

export default function RateResolutionModal({ visible, onClose, onSubmit }: RateResolutionModalProps) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Start fresh each time the modal is reopened.
  useEffect(() => {
    if (!visible) {
      setRating(0);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;

    try {
      setSubmitting(true);
      await onSubmit(rating);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Rate the resolution</Text>
          <Text style={styles.subtitle}>How well was this issue handled?</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => setRating(value)} disabled={submitting}>
                <Text style={[styles.star, value <= rating && styles.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, (rating === 0 || submitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={rating === 0 || submitting}
            >
              <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#fff", borderRadius: 6, padding: 24, width: "85%" },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#6B6B6B", textAlign: "center", marginTop: 4, marginBottom: 16 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  star: { fontSize: 36, color: "#D8D8D8" },
  starActive: { color: "#B5460A" },
  buttonRow: { flexDirection: "row", gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: "center", backgroundColor: "#F0F0F0" },
  cancelText: { fontWeight: "600", color: "#3A3A3A" },
  submitButton: { flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: "center", backgroundColor: "#2563eb" },
  submitDisabled: { backgroundColor: "#A8C1EE" },
  submitText: { fontWeight: "600", color: "#fff" },
});
