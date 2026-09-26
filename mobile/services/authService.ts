import * as SecureStore from "expo-secure-store";
import { api } from "@/config/api";
import type { AuthResponse, User } from "@/types/user";

const USE_MOCK_AUTH = true;
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export async function saveSession(token: string, user: User): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  if (USE_MOCK_AUTH) {
    await new Promise((r) => setTimeout(r, 400));
    return { token: "mock-jwt-token", user: { id: "user-mock-1", name: "Resident Test", email, role: "resident" } };
  }
  const response = await api.post("/auth/login", { email, password });
  return response.data as AuthResponse;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  if (USE_MOCK_AUTH) {
    await new Promise((r) => setTimeout(r, 400));
    return { token: "mock-jwt-token", user: { id: "user-mock-1", name, email, role: "resident" } };
  }
  const response = await api.post("/auth/register", { name, email, password });
  return response.data as AuthResponse;
}