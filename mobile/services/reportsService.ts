import { api } from "@/config/api";
import type { CreateReportInput, Report } from "@/types/report";

const USE_MOCK_REPORTS = true;

let mockReports: Report[] = [
  {
    id: "report-001",
    category: "Water",
    description: "Burst pipe flooding the street",
    severity: 4,
    status: "in_progress",
    latitude: -33.9249,
    longitude: 18.4241,
    address: "12 Voortrekker Road, Bellville",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    statusHistory: [
      { status: "submitted", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      { status: "assigned", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
      { status: "in_progress", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString() },
    ],
  },
  {
    id: "report-002",
    category: "Roads",
    description: "Large pothole outside the school",
    severity: 3,
    status: "resolved",
    latitude: -33.93,
    longitude: 18.43,
    address: "8 Kloof Street, Gardens",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    statusHistory: [
      { status: "submitted", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() },
      { status: "assigned", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5).toISOString() },
      { status: "in_progress", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
      { status: "resolved", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    ],
  },
];

export async function getMyReports(): Promise<Report[]> {
  if (USE_MOCK_REPORTS) {
    await new Promise((r) => setTimeout(r, 400));
    return mockReports;
  }
  const response = await api.get("/reports/mine");
  return response.data as Report[];
}

export async function getReportById(id: string): Promise<Report | null> {
  if (USE_MOCK_REPORTS) {
    await new Promise((r) => setTimeout(r, 200));
    return mockReports.find((r) => r.id === id) ?? null;
  }
  const response = await api.get(`/reports/${id}`);
  return response.data as Report;
}

export async function getNearbyReports(latitude: number, longitude: number, radiusKm = 5): Promise<Report[]> {
  if (USE_MOCK_REPORTS) {
    await new Promise((r) => setTimeout(r, 300));
    return mockReports;
  }
  const response = await api.get("/reports/nearby", { params: { latitude, longitude, radiusKm } });
  return response.data as Report[];
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  if (USE_MOCK_REPORTS) {
    await new Promise((r) => setTimeout(r, 500));
    const newReport: Report = {
      id: `report-${Date.now()}`,
      category: input.category,
      description: input.description,
      severity: input.severity,
      status: "submitted",
      photoUrl: input.photoUri,
      latitude: input.latitude,
      longitude: input.longitude,
      createdAt: new Date().toISOString(),
      statusHistory: [{ status: "submitted", timestamp: new Date().toISOString() }],
    };
    mockReports = [newReport, ...mockReports];
    return newReport;
  }

  const formData = new FormData();
  formData.append("category", input.category);
  formData.append("description", input.description);
  formData.append("severity", String(input.severity));
  formData.append("latitude", String(input.latitude));
  formData.append("longitude", String(input.longitude));
  if (input.photoUri) {
    formData.append("photo", { uri: input.photoUri, name: "report-photo.jpg", type: "image/jpeg" } as unknown as Blob);
  }

  const response = await api.post("/reports", formData, { headers: { "Content-Type": "multipart/form-data" } });
  return response.data as Report;
}

export async function rateReport(id: string, rating: number): Promise<void> {
  if (USE_MOCK_REPORTS) {
    await new Promise((r) => setTimeout(r, 300));
    mockReports = mockReports.map((r) => (r.id === id ? { ...r, rating } : r));
    return;
  }
  await api.post(`/reports/${id}/rate`, { rating });
}