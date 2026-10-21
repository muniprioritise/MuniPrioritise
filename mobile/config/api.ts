import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_BASE_URL = "https://muniprioritise-1vgj.onrender.com";

export const AUTH_TOKEN_KEY = "muniprioritise_auth_token";
export const AUTH_ROLE_KEY = "muniprioritise_auth_role";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 45000, // Render free tier can take 30-50 s to wake
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the stored JWT to every request.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});