import axios from "axios";

import { api } from "@/config/api";
import type {
  CreateReportInput,
  Report,
  ReportCategory,
  ReportStatus,
  ReportStatusEvent,
} from "@/types/report";

// Photos are served from the host root (/uploads/...), not under /api.
const HOST_URL = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

// A photo upload to a cold-started free-tier server can outlast the default
// 10 s axios timeout.
const UPLOAD_TIMEOUT_MS = 60000;

interface ApiStatusEvent {
  new_status: string | null;
  occurred_at: string;
}

// Shape of the backend's report rows. lat/lng are Postgres DECIMALs, so they
// arrive as strings.
interface ApiReport {
  id: string;
  category: string;
  description: string | null;
  severity: number | null;
  status: string;
  lat: string | number;
  lng: string | number;
  photo_urls: string[] | null;
  resolution_rating: number | null;
  created_at: string;
  updated_at?: string;
  status_events?: ApiStatusEvent[];
}

// The database says "pending"; residents see "submitted". "escalated" is a
// worker-side detail, so to a resident the job is still in progress.
function toClientStatus(status: string): ReportStatus {
  switch (status) {
    case "assigned":
      return "assigned";
    case "in_progress":
    case "escalated":
      return "in_progress";
    case "resolved":
      return "resolved";
    case "rejected":
      return "rejected";
    default:
      return "submitted";
  }
}

function toClientCategory(category: string): ReportCategory {
  return (category.charAt(0).toUpperCase() + category.slice(1)) as ReportCategory;
}

// The backend logs no event when a report is created, and some status changes
// are not logged at all. So: start from "submitted", add the logged events,
// and make sure the last entry matches the report's current status.
function buildStatusHistory(row: ApiReport): ReportStatusEvent[] {
  const history: ReportStatusEvent[] = [
    { status: "submitted", timestamp: row.created_at },
  ];

  for (const event of row.status_events ?? []) {
    if (!event.new_status) {
      continue;
    }

    const status = toClientStatus(event.new_status);

    if (history[history.length - 1].status !== status) {
      history.push({ status, timestamp: event.occurred_at });
    }
  }

  const current = toClientStatus(row.status);

  if (history[history.length - 1].status !== current) {
    history.push({
      status: current,
      timestamp: row.updated_at ?? row.created_at,
    });
  }

  return history;
}

function toReport(row: ApiReport): Report {
  const firstPhoto = row.photo_urls?.[0];

  return {
    id: row.id,
    category: toClientCategory(row.category),
    description: row.description ?? "",
    severity: row.severity ?? 1,
    status: toClientStatus(row.status),
    photoUrl: firstPhoto ? `${HOST_URL}${firstPhoto}` : undefined,
    latitude: Number(row.lat),
    longitude: Number(row.lng),
    createdAt: row.created_at,
    statusHistory: buildStatusHistory(row),
    rating: row.resolution_rating ?? undefined,
  };
}

export async function getMyReports(): Promise<Report[]> {
  const response = await api.get<ApiReport[]>("/reports/mine");
  return response.data.map(toReport);
}

export async function getReportById(id: string): Promise<Report | null> {
  try {
    const response = await api.get<ApiReport>(`/reports/${id}`);
    return toReport(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getNearbyReports(
  latitude: number,
  longitude: number,
  radiusKm = 5
): Promise<Report[]> {
  const response = await api.get<ApiReport[]>("/reports/nearby", {
    params: { lat: latitude, lng: longitude, radiusKm },
  });

  return response.data.map(toReport);
}

function photoMimeType(uri: string): string {
  const extension = uri.split("?")[0].split(".").pop()?.toLowerCase();

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  const formData = new FormData();

  // The backend only accepts lowercase categories and reads lat/lng.
  formData.append("category", input.category.toLowerCase());
  formData.append("description", input.description);
  formData.append("severity", String(input.severity));
  formData.append("lat", String(input.latitude));
  formData.append("lng", String(input.longitude));

  if (input.photoUri) {
    formData.append("photos", {
      uri: input.photoUri,
      name: input.photoUri.split("/").pop() ?? "report-photo.jpg",
      type: photoMimeType(input.photoUri),
    } as unknown as Blob);
  }

  const response = await api.post<ApiReport>("/reports", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });

  return toReport(response.data);
}

export async function rateReport(id: string, rating: number): Promise<void> {
  await api.patch(`/reports/${id}/rating`, { rating });
}

