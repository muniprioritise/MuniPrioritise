import type { UserRole } from "@/types/user";

// Single place that decides where each role lands after sign-in.
export function homeRouteForRole(
  role: UserRole
): "/jobs" | "/supervisor" | "/(tabs)/home" {
  switch (role) {
    case "worker":
      return "/jobs";
    case "supervisor":
      return "/supervisor";
    default:
      return "/(tabs)/home";
  }
}

