import * as SecureStore from "expo-secure-store";

import { api, AUTH_ROLE_KEY, AUTH_TOKEN_KEY } from "@/config/api";

export type UserRole = "resident" | "worker" | "supervisor";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const response = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });

  const { token, user } = response.data;

  if (!token || !user?.role) {
    throw new Error("Login response did not include a token and role.");
  }

  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  await SecureStore.setItemAsync(AUTH_ROLE_KEY, user.role);

  return user;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(AUTH_ROLE_KEY);
}

export async function getStoredRole(): Promise<UserRole | null> {
  const role = await SecureStore.getItemAsync(AUTH_ROLE_KEY);
  return (role as UserRole) ?? null;
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  return token !== null;
}
