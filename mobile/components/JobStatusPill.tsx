import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

const { colors } = theme;

const JOB_STATUS_STYLES: Record<string, { background: string; color: string; label: string }> = {
  pending: { background: colors.infoSoft, color: colors.info, label: "Pending" },
  assigned: { background: colors.warningSoft, color: colors.warning, label: "Assigned" },
  in_progress: { background: colors.brandSoft, color: colors.brand, label: "In progress" },
  resolved: { background: colors.okSoft, color: colors.ok, label: "Resolved" },
  escalated: { background: colors.dangerSoft, color: colors.danger, label: "Escalated" },
};

export default function JobStatusPill({ status }: { status: string | undefined }) {
  const style = JOB_STATUS_STYLES[status ?? ""] ?? {
    background: colors.surfaceSoft,
    color: colors.muted,
    label: status ?? "Unknown",
  };

  return (
    <View style={[styles.pill, { backgroundColor: style.background }]} accessibilityLabel={`Status: ${style.label}`}>
      <View style={[styles.dot, { backgroundColor: style.color }]} />
      <Text style={[styles.text, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  text: { fontSize: theme.font.caption, fontWeight: "700" },
});
