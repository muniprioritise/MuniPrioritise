export type JobSeverity = "low" | "medium" | "high" | "critical";

export type JobStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "escalated";

export interface Job {
  id: string;
  reportId: string;

  category: string;
  description: string;

  severity: JobSeverity;
  status: JobStatus;

  address: string;
  ward: string;

  latitude: number | null;
  longitude: number | null;

  submittedAt: string;

  priorityScore?: number;
  efficiencyScore?: number;
  equityScore?: number;

  photoUrls?: string[];
}