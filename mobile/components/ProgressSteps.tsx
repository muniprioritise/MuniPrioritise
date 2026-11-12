import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";

const { colors } = theme;

interface ProgressStepsProps {
  steps: { title: string; complete: boolean }[];
}

export default function ProgressSteps({ steps }: ProgressStepsProps) {
  const activeIndex = steps.findIndex((step) => !step.complete);

  return (
    <View style={styles.row}>
      {steps.map((step, index) => {
        const active = index === activeIndex;

        return (
          <View key={step.title} style={styles.step}>
            {index < steps.length - 1 ? <View style={[styles.connector, step.complete && styles.connectorComplete]} /> : null}

            <View style={[styles.circle, step.complete && styles.circleComplete, active && styles.circleActive]}>
              {step.complete ? (
                <Ionicons name="checkmark" size={16} color={colors.onBrand} />
              ) : (
                <Text style={[styles.number, active && styles.numberActive]}>{index + 1}</Text>
              )}
            </View>

            <Text style={[styles.label, (step.complete || active) && styles.labelOn]}>{step.title}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  step: { flex: 1, alignItems: "center" },
  // Runs from this circle's centre to the next one's, which sits one step width away.
  connector: { position: "absolute", top: 13, left: "50%", width: "100%", height: 2, backgroundColor: colors.stroke },
  connectorComplete: { backgroundColor: colors.brand },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.stroke,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  circleComplete: { backgroundColor: colors.brand, borderColor: colors.brand },
  circleActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  number: { fontSize: theme.font.caption, fontWeight: "700", color: colors.muted },
  numberActive: { color: colors.brand },
  label: { marginTop: theme.spacing.sm, fontSize: theme.font.caption, color: colors.muted, textAlign: "center" },
  labelOn: { color: colors.text, fontWeight: "700" },
});
