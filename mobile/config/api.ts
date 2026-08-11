import axios from "axios";

// TODO: reconcile with API_BASE_URL in services/jobsService.ts — two separate
// definitions of the backend URL currently exist. Pick one source of truth
// once ALGORITHM_SERVICE_URL / backend URL env wiring is set up (see build plan).
const API_BASE_URL = "http://10.0.2.2:3000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});
