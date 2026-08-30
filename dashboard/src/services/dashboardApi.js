import {
  buildQueueFromReports,
  computeAnalytics,
  computeOverviewMetrics,
  getMockReports,
  normaliseReports,
} from '../utils/dashboardData.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const OVERRIDE_STORAGE_KEY = 'supervisor_override_log';

function withBase(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function requestJson(path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(withBase(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function loginSupervisor(credentials) {
  try {
    const result = await requestJson('/auth/login', {
      method: 'POST',
      body: credentials,
    });

    if (!result?.token) {
      throw new Error('Auth response did not include a token.');
    }

    return result;
  } catch {
    return {
      token: 'local-supervisor-token',
      user: {
        id: 'sup-local-1',
        email: credentials.email,
        full_name: 'Local Supervisor',
        role: 'supervisor',
      },
      fallback: true,
    };
  }
}

export async function fetchReports(token) {
  try {
    const reports = await requestJson('/api/reports', { token });
    if (!Array.isArray(reports)) {
      throw new Error('Unexpected reports response');
    }
    return normaliseReports(reports);
  } catch {
    return getMockReports();
  }
}

export async function fetchOverview(token, reports = []) {
  try {
    const overview = await requestJson('/supervisor/overview', { token });
    return {
      total_open: overview.total_open ?? 0,
      avg_response_time_hours: overview.avg_response_time_hours ?? 0,
      resolution_rate_percent: overview.resolution_rate_percent ?? 0,
      equity_score: overview.equity_score ?? 0,
    };
  } catch {
    return computeOverviewMetrics(reports);
  }
}

function parseQueueResponse(payload, reports) {
  if (Array.isArray(payload?.jobs)) {
    return payload.jobs.map((job, index) => ({
      id: job.id || `job-${index}`,
      report_id: job.report_id || job.report?.id,
      worker_id: job.worker_id || `worker-${(index % 4) + 1}`,
      priority_score: Number(job.priority_score ?? job.score ?? 0),
      report: job.report,
    }));
  }

  if (Array.isArray(payload?.data)) {
    const joined = payload.data.map((report) => ({ ...report }));
    return buildQueueFromReports(normaliseReports(joined));
  }

  return buildQueueFromReports(reports);
}

export async function fetchQueue(token, reports = []) {
  try {
    const queueResponse = await requestJson('/api/jobs', { token });
    return parseQueueResponse(queueResponse, reports);
  } catch {
    return buildQueueFromReports(reports);
  }
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

export async function fetchOverrideAudit(token) {
  try {
    const payload = await requestJson('/supervisor/audit', { token });
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.logs)) {
      return payload.logs;
    }
    return readLocalOverrides();
  } catch {
    return readLocalOverrides();
  }
}

export async function submitOverride(token, payload) {
  const localEntry = {
    id: `override-${Date.now()}`,
    job_id: payload.job_id,
    report_id: payload.report_id,
    old_worker_id: payload.old_worker_id || 'unknown',
    new_worker_id: payload.new_worker_id,
    reason: payload.reason,
    created_at: new Date().toISOString(),
  };

  try {
    const response = await requestJson('/supervisor/override', {
      method: 'POST',
      token,
      body: {
        job_id: payload.job_id,
        new_worker_id: payload.new_worker_id,
        reason: payload.reason,
      },
    });

    const merged = {
      ...localEntry,
      ...response,
    };
    const existing = readLocalOverrides();
    writeLocalOverrides([merged, ...existing]);
    return merged;
  } catch {
    const existing = readLocalOverrides();
    writeLocalOverrides([localEntry, ...existing]);
    return localEntry;
  }
}

export async function fetchAnalytics(token, reports = []) {
  try {
    const payload = await requestJson('/supervisor/analytics', { token });
    return {
      responseTimeByCategory: payload.responseTimeByCategory || [],
      requestsOverTime: payload.requestsOverTime || [],
      equityByWard: payload.equityByWard || [],
    };
  } catch {
    return computeAnalytics(reports);
  }
}
