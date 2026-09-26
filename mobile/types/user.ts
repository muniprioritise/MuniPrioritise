export type UserRole = "resident" | "worker" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  expoPushToken?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}