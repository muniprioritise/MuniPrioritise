import { getNearbyReports } from "@/services/reportsService";
import type { Report, ReportCategory } from "@/types/report";

// How close an open report of the same category must be before we ask the
// resident whether it is the same problem. Phone GPS is only good to about
// 5 to 20 m, so these are assumptions to tune, not measured values. Roads are
// tight because several potholes can sit close together.
export const DUPLICATE_RADIUS_M: Record<ReportCategory, number> = {
  Roads: 15,
  Refuse: 20,
  Water: 30,
  Electricity: 30,
  Sanitation: 30,
};

const EARTH_RADIUS_M = 6371000;

function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface NearbyDuplicate {
  report: Report;
  distanceM: number;
}

// Returns the closest unresolved report of the same category inside the
// category's radius, or null. A lookup failure returns null so it never
// blocks a resident from reporting.
export async function findNearbyDuplicate(
  category: ReportCategory,
  latitude: number,
  longitude: number
): Promise<NearbyDuplicate | null> {
  try {
    const radiusM = DUPLICATE_RADIUS_M[category];
    const candidates = await getNearbyReports(latitude, longitude, radiusM / 1000);

    const matches = candidates
      .filter(
        (report) =>
          report.category === category &&
          report.status !== "resolved" &&
          report.status !== "rejected"
      )
      .map((report) => ({
        report,
        distanceM: distanceMetres(latitude, longitude, report.latitude, report.longitude),
      }))
      .filter((match) => match.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);

    return matches[0] ?? null;
  } catch {
    return null;
  }
}
