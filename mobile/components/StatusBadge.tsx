import { StyleSheet, Text, View } from "react-native";
import type { ReportStatus } from "@/types/report";

const STATUS_STYLES: Record<ReportStatus, { backgroundColor: string; textColor: string; label: string }> = {
  submitted: { backgroundColor: "#E3EAFB", textColor: "#2545B5", label: "Submitted" },
  assigned: { backgroundColor: "#FFF4D9", textColor: "#8A6100", label: "Assigned" },
  in_progress: { backgroundColor: "#FFE3D1", textColor: "#B5460A", label: "In Progress" },
  resolved: { backgroundColor: "#E3F2E3", textColor: "#1E7A1E", label: "Resolved" },
  rejected: { backgroundColor: "#FBDADA", textColor: "#A61212", label: "Rejected" },
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.text, { color: style.textColor }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: "flex-start" },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});