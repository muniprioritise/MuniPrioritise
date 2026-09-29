import * as SecureStore from "expo-secure-store";

import { api, AUTH_ROLE_KEY, AUTH_TOKEN_KEY } from "@/config/api";
import type { AuthResponse, User, UserRole } from "@/types/user";

// Kept so existing imports from this module keep working.
export type { UserRole };
export type AuthUser = User;

const USER_KEY = "muniprioritise_auth_user";
const VALID_ROLES: UserRole[] = ["resident", "worker", "supervisor"];

// Screens outside React state (e.g. the worker screens) call logout()
// directly. AuthContext subscribes here so its state clears too.
type LogoutListener = () => void;
const logoutListeners = new Set<LogoutListener>();

export function subscribeToLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);

  return () => {
    logoutListeners.delete(listener);
  };
}

export async function login(
  email: string,
  password: string,
  expoPushToken?: string
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", {
    email,
    password,
    ...(expoPushToken ? { expo_push_token: expoPushToken } : {}),
  });

  const { token, user } = response.data;

  if (!token || !user?.role || !VALID_ROLES.includes(user.role)) {
    throw new Error("Login response did not include a valid token and role.");
  }

  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  await SecureStore.setItemAsync(AUTH_ROLE_KEY, user.role);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

  return { token, user };
}

// The backend returns the created user row, not a token, so callers must
// log in afterwards. Residents only: role is fixed here on purpose.
export async function register(
  fullName: string,
  email: string,
  password: string
): Promise<void> {
  await api.post("/auth/register", {
    email,
    password,
    role: "resident",
    full_name: fullName,
  });
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(AUTH_ROLE_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);

  logoutListeners.forEach((listener) => listener());
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function getStoredRole(): Promise<UserRole | null> {
  const role = await SecureStore.getItemAsync(AUTH_ROLE_KEY);
  return (role as UserRole) ?? null;
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  return token !== null;
}

