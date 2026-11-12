import { theme } from "@/constants/theme";
import type { JobSeverity } from "@/types/job";

// Plain-language labels so residents do not have to guess what "3 out of 5" means.
export const SEVERITY_LEVELS = [
  { value: 1, label: "Low", color: theme.colors.ok },
  { value: 2, label: "Minor", color: theme.colors.ok },
  { value: 3, label: "Moderate", color: theme.colors.warning },
  { value: 4, label: "High", color: theme.colors.danger },
  { value: 5, label: "Critical", color: theme.colors.danger },
] as const;

export function severityLevel(severity: number) {
  return SEVERITY_LEVELS[Math.min(Math.max(severity, 1), 5) - 1];
}

const JOB_SEVERITY_STYLES: Record<JobSeverity, { background: string; color: string; label: string }> = {
  low: { background: theme.colors.okSoft, color: theme.colors.ok, label: "Low" },
  medium: { background: theme.colors.warningSoft, color: theme.colors.warning, label: "Medium" },
  high: { background: theme.colors.dangerSoft, color: theme.colors.danger, label: "High" },
  critical: { background: theme.colors.danger, color: theme.colors.onBrand, label: "Critical" },
};

export function jobSeverityStyle(severity: string | undefined) {
  return JOB_SEVERITY_STYLES[severity as JobSeverity] ?? JOB_SEVERITY_STYLES.medium;
}
