import axios from "axios";
import * as SecureStore from "expo-secure-store";

// definitions of the backend URL currently exist. Pick one source of truth
// once ALGORITHM_SERVICE_URL / backend URL env wiring is set up (see build plan).
const API_BASE_URL = "https://muniprioritise-1vgj.onrender.com"; //disgusting naam fr

export const AUTH_TOKEN_KEY = "muniprioritise_auth_token";
export const AUTH_ROLE_KEY = "muniprioritise_auth_role";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the stored JWT to every outgoing request. Centralised here so
// jobsService.ts (and anything else using `api`) never has to think about
// auth headers per-call.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
