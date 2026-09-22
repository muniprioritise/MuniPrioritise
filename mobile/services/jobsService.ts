import { mockJobs } from "@/data/mockJobs";
import type { Job } from "@/types/job";

const USE_MOCK_JOBS = false;
const API_BASE_URL = "https://muniprioritise-1vgj.onrender.com";

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

function mapSeverity(value: unknown): Job["severity"] {
  switch (Number(value)) {
    case 1:
      return "low";
    case 2:
      return "medium";
    case 3:
      return "high";
    default:
      return "low";
  }
}

function mapReportToJob(report: Record<string, unknown>): Job {
  return {
    id: String(report.id ?? ""),
    category: mapCategory(report.category),
    severity: mapSeverity(report.severity),
    address: report.lat && report.lng
      ? `${report.lat}, ${report.lng}`
      : "Location unavailable",
    ward: String(report.ward_id ?? "Ward unavailable"),
    submittedAt: String(
      report.created_at ?? new Date().toISOString()
    ),
  };
}

export async function getJobs(): Promise<Job[]> {
  if (USE_MOCK_JOBS) {
    console.log("USING MOCK JOBS");
    await new Promise((resolve) => setTimeout(resolve, 500));
    return mockJobs;
  }

  console.log("USING REAL JOBS API");
  console.log("API URL:", `${API_BASE_URL}/api/jobs`);

  const response = await fetch(`${API_BASE_URL}/api/jobs`);
  console.log("API STATUS:", response.status);

  if (!response.ok) {
    throw new Error(`Failed to load jobs: ${response.status}`);
  }

  const data = await response.json();
  console.log("API RESPONSE:", data);

  // Normal documented API response
  if (Array.isArray(data.jobs)) {
    return data.jobs.map((job: any) =>
      mapReportToJob(job.report ?? job)
    );
  }

  // Backend fallback response
  if (data.fallback === true && Array.isArray(data.data)) {
    return data.data.map((report: any) =>
      mapReportToJob(report)
    );
  }

  // Raw algorithm response — no report details to build a Job from
  if (Array.isArray(data.prioritised_order) || Array.isArray(data.assignments)) {
    throw new Error(
      "The jobs API does not currently include report details required by the mobile job list."
    );
  }

  throw new Error("Unexpected jobs response from backend");
}
