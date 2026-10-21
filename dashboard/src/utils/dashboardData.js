const categories = ['water', 'electricity', 'roads', 'refuse', 'sanitation'];
const statuses = ['pending', 'assigned', 'in_progress', 'resolved', 'escalated'];

export const CATEGORY_COLORS = {
  water: '#0c5f90',
  electricity: '#9f580a',
  roads: '#7f1d1d',
  refuse: '#385723',
  sanitation: '#6b2f6b',
};

// Long ids (UUIDs) are shortened for display. Full ids stay in CSV exports.
export function shortId(id) {
  const text = String(id ?? '');
  return text.length > 12 ? text.slice(0, 8) : text;
}

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normaliseReport(report, index) {
  const created = report.created_at || report.createdAt || new Date().toISOString();
  const updated = report.updated_at || report.updatedAt || created;

  return {
    id: report.id || `rpt-${index + 100}`,
    category: categories.includes(report.category) ? report.category : categories[index % categories.length],
    description: report.description || 'No description provided.',
    severity: Number(report.severity) || 1,
    status: statuses.includes(report.status) ? report.status : 'pending',
    lat: Number(report.lat) || -33.9249,
    lng: Number(report.lng) || 18.4241,
    ward_id: report.ward_id || report.wardId || 'Unassigned',
    created_at: created,
    updated_at: updated,
  };
}

export function normaliseReports(reports = []) {
  return reports.map(normaliseReport);
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
