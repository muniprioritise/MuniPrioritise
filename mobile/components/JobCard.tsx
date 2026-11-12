import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Card from "@/components/Card";
import CategoryIcon from "@/components/CategoryIcon";
import { jobSeverityStyle } from "@/constants/severity";
import { theme } from "@/constants/theme";
import type { Job } from "@/types/job";

interface JobCardProps {
  job: Job;
  onPress: () => void;
}

const { colors, spacing } = theme;

function getRelativeTime(isoDate: string): string {
  const submitted = new Date(isoDate).getTime();

  if (Number.isNaN(submitted)) {
    return "Unknown time";
  }

  const diffMs = Date.now() - submitted;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function JobCard({ job, onPress }: JobCardProps) {
  const severity = jobSeverityStyle(job.severity);

  return (
    <Card
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${job.category} job, ${severity.label} severity, ${job.address}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <CategoryIcon category={job.category} size={22} color={colors.brand} />
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.category}>{job.category}</Text>
          <Text style={styles.ward}>{job.ward}</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: severity.background }]}>
          <Text style={[styles.badgeText, { color: severity.color }]}>{severity.label.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={18} color={colors.muted} />
        <Text style={styles.address}>{job.address}</Text>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={styles.time}>{getRelativeTime(job.submittedAt)}</Text>
        </View>

        {job.priorityScore !== undefined && (
          <View style={styles.priority}>
            <Text style={styles.priorityText}>Priority {Math.round(job.priorityScore * 100)}%</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, marginLeft: spacing.md },
  category: { fontSize: theme.font.body, fontWeight: "700", color: colors.text },
  ward: { fontSize: theme.font.caption, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: theme.radius.pill },
  badgeText: { fontSize: theme.font.caption, fontWeight: "800", letterSpacing: 0.4 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  address: { flex: 1, fontSize: theme.font.small, color: colors.text },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { fontSize: theme.font.caption, color: colors.muted },
  priority: { backgroundColor: colors.brandSoft, borderRadius: theme.radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  priorityText: { fontSize: theme.font.caption, fontWeight: "700", color: colors.brand },
});
