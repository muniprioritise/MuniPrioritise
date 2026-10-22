import { normaliseReports } from '../utils/dashboardData.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
// Must match the key AuthContext.jsx stores the session under.
const AUTH_STORAGE_KEY = 'supervisor_dashboard_auth';

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

  if (response.status === 204) {
    return null;
  }

  return response.json();
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

export async function fetchReports(token) {
  const reports = await requestJson('/api/reports', { token });
  if (!Array.isArray(reports)) {
    throw new Error('Unexpected reports response');
  }
  return normaliseReports(reports);
}

export async function deleteReport(token, id) {
  await requestJson(`/api/reports/${id}`, { method: 'DELETE', token });
}

export async function fetchOverview(token) {
  const overview = await requestJson('/api/supervisor/overview', { token });
  return {
    total_open: overview.total_open ?? 0,
    avg_response_time_hours: overview.avg_response_time_hours ?? 0,
    resolution_rate_percent: overview.resolution_rate_percent ?? 0,
    equity_score: overview.equity_score ?? 0,
  };
}

function parseQueueResponse(payload) {
  if (payload?.fallback) {
    // The backend could not reach the algorithm service and sent unranked
    // reports, so there is no queue to show.
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

export async function fetchQueue(token) {
  return parseQueueResponse(await requestJson('/api/jobs', { token }));
}

export async function fetchWorkers(token) {
  const workers = await requestJson('/api/supervisor/workers', { token });
  return Array.isArray(workers) ? workers : [];
}

// The audit endpoint returns the whole status_events log. Overrides are the
// rows with a job_id. The log calls the reason `notes` and the time
// `occurred_at`; the table expects `reason` and `created_at`.
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

export async function fetchOverrideAudit(token) {
  const payload = await requestJson('/api/supervisor/audit', { token });
  const rows = Array.isArray(payload) ? payload : payload?.logs;
  if (!Array.isArray(rows)) {
    throw new Error('Unexpected audit response');
  }
  return rows.filter((row) => row.job_id).map(toOverrideEntry);
}

export async function submitOverride(token, payload) {
  const response = await requestJson('/api/supervisor/override', {
    method: 'POST',
    token,
    body: {
      job_id: payload.job_id,
      new_worker_id: payload.new_worker_id,
      reason: payload.reason,
    },
  });

  const entry = {
    id: `override-${Date.now()}`,
    job_id: payload.job_id,
    report_id: payload.report_id,
    old_worker_id: payload.old_worker_id,
    new_worker_id: response.worker_id ?? payload.new_worker_id,
    reason: payload.reason,
    created_at: new Date().toISOString(),
  };

  return entry;
}

export async function fetchAnalytics(token) {
  const payload = await requestJson('/api/supervisor/analytics', { token });
  return {
    responseTimeByCategory: payload.responseTimeByCategory || [],
    requestsOverTime: payload.requestsOverTime || [],
    equityByWard: payload.equityByWard || [],
  };
}
