import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ReportStatusEvent } from "@/types/report";
import { formatDateTime } from "@/utils/format";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  assigned: "Assigned to a worker",
  in_progress: "Work in progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

export default function StatusTimeline({ events }: { events: ReportStatusEvent[] }) {
  return (
    <View>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <View key={`${event.status}-${event.timestamp}`} style={styles.row}>
            <View style={styles.markerColumn}>
              <View style={[styles.dot, isLast && styles.dotActive]} />
              {index < events.length - 1 && <View style={styles.line} />}
            </View>
            <View style={styles.content}>
              <Text style={[styles.label, isLast && styles.labelActive]}>
                {STATUS_LABELS[event.status] ?? event.status}
              </Text>
              <Text style={styles.timestamp}>{formatDateTime(event.timestamp)}</Text>
              {event.note ? <Text style={styles.note}>{event.note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  markerColumn: { width: 24, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.stroke, marginTop: 4 },
  dotActive: { backgroundColor: theme.colors.brand, borderWidth: 3, borderColor: theme.colors.brandSoft, width: 18, height: 18, borderRadius: 9, marginTop: 1 },
  line: { flex: 1, width: 2, backgroundColor: theme.colors.stroke, marginVertical: 2 },
  content: { flex: 1, paddingBottom: theme.spacing.xl, paddingLeft: theme.spacing.md },
  label: { fontSize: theme.font.body, fontWeight: "600", color: theme.colors.muted },
  labelActive: { color: theme.colors.text, fontWeight: "700" },
  timestamp: { fontSize: theme.font.caption, color: theme.colors.muted, marginTop: 2 },
  note: { fontSize: theme.font.small, color: theme.colors.text, marginTop: theme.spacing.xs },
});
