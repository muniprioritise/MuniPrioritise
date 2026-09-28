import type { Job } from "@/types/job";

function minutesAgo(minutes: number): string {
  return new Date(
    Date.now() - minutes * 60 * 1000
  ).toISOString();
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
    reportId: "report-001",
    category: "Water",
    description: "Major water pipe burst causing flooding in the road.",
    severity: "critical",
    status: "pending",
    address: "12 Voortrekker Road, Bellville",
    ward: "Ward 55",
    latitude: -33.9024,
    longitude: 18.6291,
    submittedAt: minutesAgo(10),
    priorityScore: 0.96,
  },
  {
    id: "job-002",
    reportId: "report-002",
    category: "Electricity",
    description: "Electricity outage affecting several houses.",
    severity: "high",
    status: "pending",
    address: "45 Main Road, Claremont",
    ward: "Ward 59",
    latitude: -33.9821,
    longitude: 18.4641,
    submittedAt: minutesAgo(45),
    priorityScore: 0.88,
  },
  {
    id: "job-003",
    reportId: "report-003",
    category: "Roads",
    description: "Large pothole creating a hazard for motorists.",
    severity: "medium",
    status: "pending",
    address: "8 Kloof Street, Gardens",
    ward: "Ward 77",
    latitude: -33.9309,
    longitude: 18.4106,
    submittedAt: hoursAgo(2),
    priorityScore: 0.67,
  },
  {
    id: "job-004",
    reportId: "report-004",
    category: "Refuse",
    description: "Uncollected refuse bags alongside the road.",
    severity: "low",
    status: "pending",
    address: "23 Lansdowne Road, Wynberg",
    ward: "Ward 61",
    latitude: -34.0038,
    longitude: 18.4682,
    submittedAt: hoursAgo(8),
    priorityScore: 0.42,
  },
  {
    id: "job-005",
    reportId: "report-005",
    category: "Sanitation",
    description: "Blocked sewer overflowing into the street.",
    severity: "high",
    status: "pending",
    address: "5 Station Road, Khayelitsha",
    ward: "Ward 97",
    latitude: -34.0386,
    longitude: 18.677,
    submittedAt: daysAgo(1),
    priorityScore: 0.84,
  },
  {
    id: "job-006",
    reportId: "report-006",
    category: "Water",
    description: "Possible water leak near residential properties.",
    severity: "medium",
    status: "pending",
    address: "17 Church Street, Durbanville",
    ward: "Ward 4",
    latitude: -33.8318,
    longitude: 18.6479,
    submittedAt: daysAgo(3),
    priorityScore: 0.61,
  },
];