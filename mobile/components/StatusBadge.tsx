import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ReportStatus } from "@/types/report";

const { colors } = theme;

const STATUS_STYLES: Record<ReportStatus, { background: string; color: string; label: string }> = {
  submitted: { background: colors.infoSoft, color: colors.info, label: "Submitted" },
  assigned: { background: colors.warningSoft, color: colors.warning, label: "Assigned" },
  in_progress: { background: colors.brandSoft, color: colors.brand, label: "In progress" },
  resolved: { background: colors.okSoft, color: colors.ok, label: "Resolved" },
  rejected: { background: colors.dangerSoft, color: colors.danger, label: "Rejected" },
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <View style={[styles.badge, { backgroundColor: style.background }]} accessibilityLabel={`Status: ${style.label}`}>
      <View style={[styles.dot, { backgroundColor: style.color }]} />
      <Text style={[styles.text, { color: style.color }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
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
