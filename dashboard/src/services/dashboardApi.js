import {
  buildQueueFromReports,
  computeAnalytics,
  computeOverviewMetrics,
  getMockReports,
  normaliseReports,
} from '../utils/dashboardData.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const OVERRIDE_STORAGE_KEY = 'supervisor_override_log';
// Same key AuthContext.jsx stores the session under.
const AUTH_STORAGE_KEY = 'supervisor_dashboard_auth';

// Demo data is only used when this is explicitly switched on
// (VITE_USE_MOCK_DATA=true). Before, every failed request quietly turned into
// mock data, so a dead backend or an expired login looked like a working
// dashboard. Now a failure shows up as an error message.
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function withBase(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function requestJson(path, { method = 'GET', token = '', body } = {}) {
  let response;
  try {
    response = await fetch(withBase(path), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and that the backend is running.', 0);
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);

    // An expired or wrong-role token: drop the session and go back to login.
    if (token && (response.status === 401 || response.status === 403)) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.assign('/login');
    }

    throw new ApiError(
      detail?.error || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json();
}

// Use the real request; only in mock mode fall back to demo data on failure.
async function withMockFallback(request, mock) {
  try {
    return await request();
  } catch (error) {
    if (USE_MOCK_DATA) {
      return mock();
    }
    throw error;
  }
}

export async function loginSupervisor(credentials) {
  const result = await requestJson('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });

  if (!result?.token) {
    throw new Error('Auth response did not include a token.');
  }

  if (result.user?.role !== 'supervisor') {
    throw new Error('This dashboard is for supervisors. Use the mobile app for resident and worker accounts.');
  }

  return result;
}

export function fetchReports(token) {
  return withMockFallback(
    async () => {
      const reports = await requestJson('/api/reports', { token });
      if (!Array.isArray(reports)) {
        throw new Error('Unexpected reports response');
      }
      return normaliseReports(reports);
    },
    getMockReports,
  );
}

export function fetchOverview(token, reports = []) {
  return withMockFallback(
    async () => {
      const overview = await requestJson('/api/supervisor/overview', { token });
      return {
        total_open: overview.total_open ?? 0,
        avg_response_time_hours: overview.avg_response_time_hours ?? 0,
        resolution_rate_percent: overview.resolution_rate_percent ?? 0,
        equity_score: overview.equity_score ?? 0,
      };
    },
    () => computeOverviewMetrics(reports),
  );
}

function parseQueueResponse(payload) {
  if (payload?.fallback) {
    // The backend could not reach the algorithm service and sent raw reports.
    // Showing those with invented scores and workers would be misleading.
    throw new Error('The prioritisation service is not responding, so the queue cannot be shown right now.');
  }

  if (!Array.isArray(payload?.jobs)) {
    throw new Error('Unexpected queue response from the backend.');
  }

  return payload.jobs.map((job) => ({
    id: job.id,
    report_id: job.report_id || job.report?.id,
    worker_id: job.worker_id,
    priority_score: Number(job.priority_score ?? job.score ?? 0),
    report: job.report ? normaliseReports([job.report])[0] : undefined,
  }));
}

export function fetchQueue(token, reports = []) {
  return withMockFallback(
    async () => parseQueueResponse(await requestJson('/api/jobs', { token })),
    () => buildQueueFromReports(reports),
  );
}

export function fetchWorkers(token) {
  return withMockFallback(
    async () => {
      const workers = await requestJson('/api/supervisor/workers', { token });
      return Array.isArray(workers) ? workers : [];
    },
    () => [1, 2, 3, 4].map((n) => ({ id: `worker-${n}`, full_name: `Worker ${n}`, email: '' })),
  );
}

export function readLocalOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalOverrides(entries) {
  localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(entries));
}

// The audit endpoint returns the whole status_events log. Overrides are the
// rows that belong to a job (job_id set); the log stores the reason in `notes`
// and the time in `occurred_at`, which is what the table expects as
// `reason` and `created_at`.
function toOverrideEntry(row) {
  return {
    id: row.id,
    job_id: row.job_id,
    report_id: row.report_id,
    old_worker_id: row.old_worker_id,
    new_worker_id: row.new_worker_id,
    reason: row.notes,
    created_at: row.occurred_at,
    changed_by_name: row.changed_by_name,
  };
}

export function fetchOverrideAudit(token) {
  return withMockFallback(
    async () => {
      const payload = await requestJson('/api/supervisor/audit', { token });
      const rows = Array.isArray(payload) ? payload : payload?.logs;
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected audit response');
      }
      return rows.filter((row) => row.job_id).map(toOverrideEntry);
    },
    readLocalOverrides,
  );
}

export async function submitOverride(token, payload) {
  const response = await withMockFallback(
    () =>
      requestJson('/api/supervisor/override', {
        method: 'POST',
        token,
        body: {
          job_id: payload.job_id,
          new_worker_id: payload.new_worker_id,
          reason: payload.reason,
        },
      }),
    () => ({ worker_id: payload.new_worker_id }),
  );

  const entry = {
    id: `override-${Date.now()}`,
    job_id: payload.job_id,
    report_id: payload.report_id,
    old_worker_id: payload.old_worker_id,
    new_worker_id: response.worker_id ?? payload.new_worker_id,
    reason: payload.reason,
    created_at: new Date().toISOString(),
  };

  if (USE_MOCK_DATA) {
    writeLocalOverrides([entry, ...readLocalOverrides()]);
  }
  return entry;
}

export function fetchAnalytics(token, reports = []) {
  return withMockFallback(
    async () => {
      const payload = await requestJson('/api/supervisor/analytics', { token });
      return {
        responseTimeByCategory: payload.responseTimeByCategory || [],
        requestsOverTime: payload.requestsOverTime || [],
        equityByWard: payload.equityByWard || [],
      };
    },
    () => computeAnalytics(reports),
  );
}
