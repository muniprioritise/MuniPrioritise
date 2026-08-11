export type JobSeverity = "low" | "medium" | "high" | "critical";

export interface Job {
  id: string;
  category: string;
  severity: JobSeverity;
  address: string;
  ward: string;
  submittedAt: string; // ISO date string
}