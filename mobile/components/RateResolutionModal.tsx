import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Button from "@/components/Button";
import { theme } from "@/constants/theme";

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
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${value} out of 5`}
                onPress={() => setRating(value)}
                disabled={submitting}
                hitSlop={4}
                style={styles.starButton}
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={38}
                  color={value <= rating ? theme.colors.accent : theme.colors.stroke}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="secondary" onPress={onClose} disabled={submitting} style={styles.buttonHalf} />
            <Button
              title="Submit"
              onPress={handleSubmit}
              loading={submitting}
              disabled={rating === 0}
              style={styles.buttonHalf}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: theme.spacing.xl, width: "88%" },
  title: { fontSize: theme.font.heading, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  subtitle: { fontSize: theme.font.small, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
  starsRow: { flexDirection: "row", justifyContent: "center", marginBottom: theme.spacing.xl },
  starButton: { width: theme.hit, height: theme.hit, alignItems: "center", justifyContent: "center" },
  buttonRow: { flexDirection: "row", gap: theme.spacing.md },
  buttonHalf: { flex: 1, paddingHorizontal: theme.spacing.md },
});
