import { StyleSheet, Text, View } from "react-native";

import type { Job, JobSeverity } from "@/types/job";

interface JobCardProps {
  job: Job;
}

function getRelativeTime(isoDate: string): string {
  const submitted = new Date(isoDate).getTime();

  if (Number.isNaN(submitted)) {
    return "Unknown time";
  }

  const diffMs = Date.now() - submitted;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

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

const SEVERITY_STYLES: Record<
  JobSeverity,
  { backgroundColor: string; textColor: string; label: string }
> = {
  low: {
    backgroundColor: "#E3F2E3",
    textColor: "#1E7A1E",
    label: "LOW",
  },
  medium: {
    backgroundColor: "#FFF4D9",
    textColor: "#8A6100",
    label: "MEDIUM",
  },
  high: {
    backgroundColor: "#FFE3D1",
    textColor: "#B5460A",
    label: "HIGH",
  },
  critical: {
    backgroundColor: "#FBDADA",
    textColor: "#A61212",
    label: "CRITICAL",
  },
};

export default function JobCard({ job }: JobCardProps) {
  const severityStyle = SEVERITY_STYLES[job.severity];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.category}>{job.category}</Text>
        <View
          style={[styles.badge, { backgroundColor: severityStyle.backgroundColor }]}
        >
          <Text style={[styles.badgeText, { color: severityStyle.textColor }]}>
            {severityStyle.label}
          </Text>
        </View>
      </View>

      <Text style={styles.address}>{job.address}</Text>
      <Text style={styles.ward}>{job.ward}</Text>

      <Text style={styles.time}>{getRelativeTime(job.submittedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  address: {
    fontSize: 14,
    color: "#3A3A3A",
    marginBottom: 2,
  },
  ward: {
    fontSize: 13,
    color: "#6B6B6B",
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: "#9A9A9A",
  },
});
