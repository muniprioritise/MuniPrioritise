import { api } from "@/config/api";
import { mockJobs } from "@/data/mockJobs";
import type {
  Job,
  JobSeverity,
  JobStatus,
} from "@/types/job";

const USE_MOCK_JOBS = false;

const CATEGORY_LABELS: Record<string, string> = {
  water: "Water",
  electricity: "Electricity",
  roads: "Roads",
  refuse: "Refuse",
  sanitation: "Sanitation",
};

function mapCategory(value: unknown): string {
  const key = String(value ?? "").toLowerCase();

  return CATEGORY_LABELS[key] ?? String(value ?? "Unknown");
}

function mapSeverity(value: unknown): JobSeverity {
  switch (Number(value)) {
    case 1:
      return "low";

    case 2:
      return "medium";

    case 3:
      return "high";

    case 4:
      return "critical";

    default:
      return "low";
  }
}

function mapStatus(value: unknown): JobStatus {
  const status = String(value ?? "pending");

  switch (status) {
    case "pending":
    case "assigned":
    case "in_progress":
    case "resolved":
    case "escalated":
      return status;

    default:
      return "pending";
  }
}

function mapJob(rawJob: Record<string, any>): Job {
  const report = rawJob.report ?? rawJob;

  const latitude =
    report.lat !== undefined && report.lat !== null
      ? Number(report.lat)
      : null;

  const longitude =
    report.lng !== undefined && report.lng !== null
      ? Number(report.lng)
      : null;

  return {
    id: String(
      rawJob.id ??
        report.id ??
        ""
    ),

    reportId: String(
      rawJob.report_id ??
        report.id ??
        ""
    ),

    category: mapCategory(report.category),

    description: String(
      report.description ??
        "No description provided."
    ),

    severity: mapSeverity(report.severity),

    status: mapStatus(report.status),

    address:
      report.address ??
      (
        latitude !== null &&
        longitude !== null
          ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          : "Location unavailable"
      ),

    ward: String(
      report.ward_id ??
        "Ward unavailable"
    ),

    latitude,
    longitude,

    submittedAt: String(
      report.created_at ??
        new Date().toISOString()
    ),

    priorityScore:
      rawJob.priority_score !== undefined
        ? Number(rawJob.priority_score)
        : undefined,

    efficiencyScore:
      rawJob.efficiency_score !== undefined
        ? Number(rawJob.efficiency_score)
        : undefined,

    equityScore:
      rawJob.equity_score !== undefined
        ? Number(rawJob.equity_score)
        : undefined,

    photoUrls:
      Array.isArray(report.photo_urls)
        ? report.photo_urls
        : [],
  };
}

export async function getJobs(): Promise<Job[]> {
  if (USE_MOCK_JOBS) {
    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );

    return mockJobs;
  }

  const response = await api.get("/jobs");
  const data = response.data;

  if (Array.isArray(data.jobs)) {
    return data.jobs.map(
      (job: Record<string, any>) =>
        mapJob(job)
    );
  }

  if (
    data.fallback === true &&
    Array.isArray(data.data)
  ) {
    return data.data.map(
      (report: Record<string, any>) =>
        mapJob(report)
    );
  }

  throw new Error(
    "Unexpected jobs response from backend"
  );
}

export async function getReport(
  reportId: string
) {
  const response = await api.get(
    `/reports/${reportId}`
  );

  return response.data;
}

export async function acceptJob(
  jobId: string
) {
  const response = await api.patch(
    `/jobs/${jobId}/accept`
  );

  return response.data;
}

export async function updateReportStatus(
  reportId: string,
  status: JobStatus,
  notes?: string
) {
  const response = await api.patch(
    `/reports/${reportId}/status`,
    {
      status,
      notes,
    }
  );

  return response.data;
}

export async function escalateJob(
  jobId: string,
  notes: string
) {
  const response = await api.patch(
    `/jobs/${jobId}/escalate`,
    {
      notes,
    }
  );

  return response.data;
}

// PATCH /jobs/:id/resolve — the single, atomic resolve action.
// Backend does evidence insert + report status update + status_events
// insert as one unit, keyed off the job id (not the report id).
// Accepts up to 5 photos under the "evidence" field (upload.array('evidence', 5)).
export async function resolveJob(
  jobId: string,
  imageUris: string[],
  notes: string
) {
  const formData = new FormData();

  formData.append("notes", notes);

  imageUris.forEach((uri, index) => {
    const filename =
      uri.split("/").pop() ??
      `evidence-${index}.jpg`;

    formData.append(
      "evidence",
      {
        uri,
        name: filename,
        type: "image/jpeg",
      } as any
    );
  });

  const response = await api.patch(
    `/jobs/${jobId}/resolve`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
}
