const categories = ['water', 'electricity', 'roads', 'refuse', 'sanitation'];
const statuses = ['pending', 'assigned', 'in_progress', 'resolved', 'escalated'];

export const CATEGORY_COLORS = {
  water: '#0c5f90',
  electricity: '#9f580a',
  roads: '#7f1d1d',
  refuse: '#385723',
  sanitation: '#6b2f6b',
};

// Real seed wards from database/init/01_init.sql — sampi_score is the
// normalised (0-1) ward deprivation index, same value used as Q in the
// hybrid algorithm (Final score = (1 - alpha) * E + (alpha * Q)).
// Keep this in sync with the DB seed if wards are added/changed there.
export const WARD_SAMPI = {
  'CPT-001': 0.7823,
  'CPT-002': 0.6541,
  'CPT-003': 0.3102,
  'JHB-001': 0.7491,
  'JHB-002': 0.1203,
};

const REAL_WARD_IDS = Object.keys(WARD_SAMPI);

function getWardSampi(wardId) {
  return WARD_SAMPI[wardId] ?? null;
}

const MOCK_REPORTS = [
  { id: 'rpt-001', category: 'water', description: 'Burst pipe on Main Road', severity: 3, status: 'pending', lat: -33.9249, lng: 18.4241, ward_id: 'CPT-001', created_at: '2026-08-18T08:12:00Z', updated_at: '2026-08-18T08:12:00Z' },
  { id: 'rpt-002', category: 'roads', description: 'Pothole near school crossing', severity: 2, status: 'in_progress', lat: -33.9321, lng: 18.4189, ward_id: 'CPT-001', created_at: '2026-08-17T10:20:00Z', updated_at: '2026-08-18T14:42:00Z' },
  { id: 'rpt-003', category: 'electricity', description: 'Street lights not working', severity: 2, status: 'resolved', lat: -33.9192, lng: 18.4312, ward_id: 'CPT-002', created_at: '2026-08-15T06:33:00Z', updated_at: '2026-08-16T09:01:00Z' },
  { id: 'rpt-004', category: 'refuse', description: 'Missed garbage collection', severity: 1, status: 'pending', lat: -33.9395, lng: 18.4213, ward_id: 'CPT-003', created_at: '2026-08-20T07:10:00Z', updated_at: '2026-08-20T07:10:00Z' },
  { id: 'rpt-005', category: 'sanitation', description: 'Blocked drainage on 2nd Ave', severity: 3, status: 'assigned', lat: -33.9155, lng: 18.4099, ward_id: 'JHB-001', created_at: '2026-08-19T12:51:00Z', updated_at: '2026-08-19T14:12:00Z' },
  { id: 'rpt-006', category: 'water', description: 'No water pressure for 2 days', severity: 3, status: 'resolved', lat: -33.9104, lng: 18.4421, ward_id: 'CPT-002', created_at: '2026-08-12T09:00:00Z', updated_at: '2026-08-13T16:20:00Z' },
  { id: 'rpt-007', category: 'roads', description: 'Road signage damaged', severity: 1, status: 'pending', lat: -33.9473, lng: 18.4387, ward_id: 'JHB-002', created_at: '2026-08-21T11:30:00Z', updated_at: '2026-08-21T11:30:00Z' },
  { id: 'rpt-008', category: 'electricity', description: 'Frequent power tripping in block', severity: 3, status: 'escalated', lat: -33.9292, lng: 18.4477, ward_id: 'JHB-001', created_at: '2026-08-11T13:04:00Z', updated_at: '2026-08-20T13:20:00Z' },
  { id: 'rpt-009', category: 'refuse', description: 'Illegal dumping in open lot', severity: 2, status: 'resolved', lat: -33.9068, lng: 18.4362, ward_id: 'JHB-001', created_at: '2026-08-13T07:50:00Z', updated_at: '2026-08-15T10:40:00Z' },
  { id: 'rpt-010', category: 'sanitation', description: 'Public toilet maintenance overdue', severity: 2, status: 'in_progress', lat: -33.9012, lng: 18.4202, ward_id: 'CPT-003', created_at: '2026-08-16T08:15:00Z', updated_at: '2026-08-20T11:45:00Z' },
  { id: 'rpt-011', category: 'water', description: 'Hydrant leak near market', severity: 2, status: 'assigned', lat: -33.9258, lng: 18.4531, ward_id: 'JHB-002', created_at: '2026-08-18T16:00:00Z', updated_at: '2026-08-19T08:25:00Z' },
  { id: 'rpt-012', category: 'roads', description: 'Traffic lights out at junction', severity: 3, status: 'pending', lat: -33.9417, lng: 18.4092, ward_id: 'CPT-003', created_at: '2026-08-22T05:10:00Z', updated_at: '2026-08-22T05:10:00Z' },
];

export function getMockReports() {
  return MOCK_REPORTS.map((report) => ({ ...report }));
}

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeReport(report, index = 0) {
  const created = report.created_at || report.createdAt || new Date().toISOString();
  const updated = report.updated_at || report.updatedAt || created;
  // Fall back to a real seed ward (not a fictional CPT-00N) so ward_id always
  // resolves to a known sampi_score.
  const ward = report.ward_id || report.wardId || REAL_WARD_IDS[index % REAL_WARD_IDS.length];
  const safeCategory = categories.includes(report.category) ? report.category : categories[index % categories.length];
  const safeStatus = statuses.includes(report.status) ? report.status : 'pending';

  return {
    id: report.id || `rpt-${index + 100}`,
    category: safeCategory,
    description: report.description || 'No description provided.',
    severity: Number(report.severity) || 1,
    status: safeStatus,
    lat: Number(report.lat) || -33.9249,
    lng: Number(report.lng) || 18.4241,
    ward_id: ward,
    created_at: created,
    updated_at: updated,
  };
}

export function normaliseReports(reports = []) {
  return reports.map((report, index) => normalizeReport(report, index));
}

function getResolvedReports(reports) {
  return reports.filter((report) => report.status === 'resolved');
}

function average(items) {
  if (!items.length) {
    return 0;
  }
  return items.reduce((sum, value) => sum + value, 0) / items.length;
}

function responseTimeHours(report) {
  const start = parseDate(report.created_at);
  const end = parseDate(report.updated_at);
  if (!start || !end) {
    return 0;
  }
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return hours > 0 ? hours : 0;
}

export function computeOverviewMetrics(reports) {
  const openRequests = reports.filter((report) => report.status !== 'resolved').length;
  const resolved = getResolvedReports(reports);
  const avgResponse = average(resolved.map((report) => responseTimeHours(report)));
  const resolutionRate = reports.length ? (resolved.length / reports.length) * 100 : 0;

  // Equity score: SAMPI-weighted exposure of the open queue. This is the
  // average ward deprivation index (sampi_score) across all OPEN requests,
  // weighted by how many open requests each ward has. A higher number means
  // the current open queue is concentrated in higher-need wards, which is
  // what alpha > 0 in the hybrid algorithm is meant to push toward.
  // This is a display proxy only, not the algorithm's actual Q score —
  // the real equity_score per job comes from job_assignments.equity_score.
  const openReports = reports.filter((report) => report.status !== 'resolved');
  const sampiWeighted = openReports
    .map((report) => getWardSampi(report.ward_id))
    .filter((score) => score !== null);
  const equityScore = sampiWeighted.length ? average(sampiWeighted) : 0;

  return {
    total_open: openRequests,
    avg_response_time_hours: Number(avgResponse.toFixed(1)),
    resolution_rate_percent: Number(resolutionRate.toFixed(1)),
    equity_score: Number(equityScore.toFixed(2)),
  };
}

export function computeAnalytics(reports) {
  const byCategory = categories.map((category) => {
    const matching = reports.filter((report) => report.category === category);
    return {
      category,
      avg_response_hours: Number(average(matching.map((report) => responseTimeHours(report))).toFixed(1)),
    };
  });

  const byDateMap = reports.reduce((acc, report) => {
    const date = report.created_at.slice(0, 10);
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const byDate = Object.entries(byDateMap)
    .map(([date, requests]) => ({ date, requests }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  // Equity by ward now shows each ward's actual sampi_score directly —
  // this is the same normalised (0-1) deprivation index used as Q in the
  // hybrid algorithm, not a derived resolution-rate blend. Wards with no
  // known sampi_score (shouldn't happen once ward_id only comes from
  // REAL_WARD_IDS, but guarded in case of stale/unmapped data) are skipped.
  const wardIdsInData = [...new Set(reports.map((report) => report.ward_id))];
  const equityByWard = wardIdsInData
    .map((wardId) => {
      const score = getWardSampi(wardId);
      return score === null ? null : { ward: wardId, equity_score: score };
    })
    .filter(Boolean);

  return {
    responseTimeByCategory: byCategory,
    requestsOverTime: byDate,
    equityByWard,
  };
}

export function buildQueueFromReports(reports) {
  return reports
    .filter((report) => report.status !== 'resolved')
    .sort((a, b) => {
      if (b.severity !== a.severity) {
        return b.severity - a.severity;
      }
      return a.created_at > b.created_at ? 1 : -1;
    })
    .map((report, index) => ({
      id: `job-${report.id}`,
      report_id: report.id,
      worker_id: `worker-${(index % 4) + 1}`,
      priority_score: Number((0.95 - index * 0.04).toFixed(2)),
      report,
    }));
}

export function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return 'Unknown';
  }
  return parsed.toLocaleString();
}

export function toCsv(rows, headers) {
  const escaped = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const csvRows = [headers.map((header) => escaped(header.label)).join(',')];
  rows.forEach((row) => {
    csvRows.push(headers.map((header) => escaped(row[header.key])).join(','));
  });
  return csvRows.join('\n');
}
