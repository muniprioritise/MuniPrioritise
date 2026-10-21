import { api } from "@/config/api";
import type {
  Job,
  JobSeverity,
  JobStatus,
} from "@/types/job";

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

// Reports are rated 1-5.
function mapSeverity(value: unknown): JobSeverity {
  switch (Number(value)) {
    case 5:
      return "critical";

    case 4:
      return "high";

    case 3:
      return "medium";

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

    // /workers/assigned names the report's status "report_status".
    status: mapStatus(report.status ?? report.report_status),

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
        report.report_created_at ??
        new Date().toISOString()
    ),

    // null (not yet scored) must stay undefined; Number(null) is 0.
    priorityScore:
      rawJob.priority_score != null
        ? Number(rawJob.priority_score)
        : rawJob.score != null
          ? Number(rawJob.score)
          : undefined,

    efficiencyScore:
      rawJob.efficiency_score != null
        ? Number(rawJob.efficiency_score)
        : undefined,

    equityScore:
      rawJob.equity_score != null
        ? Number(rawJob.equity_score)
        : undefined,

    photoUrls:
      Array.isArray(report.photo_urls)
        ? report.photo_urls
        : [],
  };
}

export async function getJobs(): Promise<Job[]> {
  // GET /jobs runs the prioritisation algorithm and stores the assignments,
  // but it lists every worker's pending jobs. Call it to refresh the
  // assignments, then read this worker's own queue.
  try {
    await api.get("/jobs");
  } catch (error) {
    console.warn(
      "Could not refresh job assignments; showing the last assigned queue.",
      error
    );
  }

  const response = await api.get(
    "/workers/assigned"
  );

  if (!Array.isArray(response.data)) {
    throw new Error(
      "Unexpected jobs response from backend"
    );
  }

  return response.data.map(
    (job: Record<string, any>) =>
      mapJob(job)
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
      reason: notes,
    }
  );

  return response.data;
}

// PATCH /jobs/:id/resolve saves the evidence, updates the report status and
// logs the event in one step. Takes up to 5 photos in the "evidence" field.
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

