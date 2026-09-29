import { StyleSheet, Text, View } from "react-native";
import type { ReportStatusEvent } from "@/types/report";

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
              <Text style={styles.label}>{STATUS_LABELS[event.status] ?? event.status}</Text>
              <Text style={styles.timestamp}>{new Date(event.timestamp).toLocaleString()}</Text>
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
  dot: { width: 10, height: 10, borderRadius: 2, backgroundColor: "#C7C7C7", marginTop: 4 },
  dotActive: { backgroundColor: "#2563eb" },
  line: { flex: 1, width: 2, backgroundColor: "#E0E0E0", marginVertical: 2 },
  content: { flex: 1, paddingBottom: 20, paddingLeft: 12 },
  label: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  timestamp: { fontSize: 12, color: "#8A8A8A", marginTop: 2 },
  note: { fontSize: 13, color: "#3A3A3A", marginTop: 4 },
});