import type { Job } from "@/types/job";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

export const mockJobs: Job[] = [
  {
    id: "job-001",
    category: "Water",
    severity: "critical",
    address: "12 Voortrekker Road, Bellville",
    ward: "Ward 55",
    submittedAt: minutesAgo(10),
  },
  {
    id: "job-002",
    category: "Electricity",
    severity: "high",
    address: "45 Main Road, Claremont",
    ward: "Ward 59",
    submittedAt: minutesAgo(45),
  },
  {
    id: "job-003",
    category: "Roads",
    severity: "medium",
    address: "8 Kloof Street, Gardens",
    ward: "Ward 77",
    submittedAt: hoursAgo(2),
  },
  {
    id: "job-004",
    category: "Refuse",
    severity: "low",
    address: "23 Lansdowne Road, Wynberg",
    ward: "Ward 61",
    submittedAt: hoursAgo(8),
  },
  {
    id: "job-005",
    category: "Sanitation",
    severity: "high",
    address: "5 Station Road, Khayelitsha",
    ward: "Ward 97",
    submittedAt: daysAgo(1),
  },
  {
    id: "job-006",
    category: "Water",
    severity: "medium",
    address: "17 Church Street, Durbanville",
    ward: "Ward 4",
    submittedAt: daysAgo(3),
  },
];
