export type ReportCategory = "Water" | "Electricity" | "Roads" | "Refuse" | "Sanitation";

export type ReportStatus = "submitted" | "assigned" | "in_progress" | "resolved" | "rejected";

export interface ReportStatusEvent {
  status: ReportStatus;
  timestamp: string;
  note?: string;
}

export interface Report {
  id: string;
  category: ReportCategory;
  description: string;
  severity: number;
  status: ReportStatus;
  photoUrl?: string;
  latitude: number;
  longitude: number;
  address?: string;
  createdAt: string;
  statusHistory: ReportStatusEvent[];
  rating?: number;
}

export interface CreateReportInput {
  category: ReportCategory;
  description: string;
  severity: number;
  photoUri?: string;
  latitude: number;
  longitude: number;
}