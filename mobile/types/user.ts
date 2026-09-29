export type UserRole = "resident" | "worker" | "supervisor";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
