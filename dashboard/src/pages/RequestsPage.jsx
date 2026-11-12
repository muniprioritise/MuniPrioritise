import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorState, LoadingState } from '../components/PageState.jsx';
import { deleteReport, fetchAnalytics, fetchOverview, fetchReports } from '../services/dashboardApi.js';
import { formatDateTime, shortId, statusLabel, titleCase, toCsv } from '../utils/dashboardData.js';
import { downloadSummaryPdf } from '../utils/reportPdf.js';

const csvColumns = [
  { key: 'id', label: 'ID' },
  { key: 'category', label: 'Category' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'ward_id', label: 'Ward' },
  { key: 'created_at', label: 'Created at' },
];

const sortableColumns = [
  { key: 'category', label: 'Category' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'ward_id', label: 'Ward' },
  { key: 'created_at', label: 'Created' },
];

function severityClass(value) {
  if (value >= 4) return 'sev-chip sev-high';
  if (value === 3) return 'sev-chip sev-mid';
  return 'sev-chip sev-low';
}

function RequestsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [isBuildingPdf, setIsBuildingPdf] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const data = await fetchReports(token);
        if (mounted) setReports(data);
      } catch (requestError) {
        if (mounted) setError(requestError.message || 'Unable to load requests.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = reports.filter((report) => {
      const text = `${report.id} ${report.category} ${report.description} ${report.ward_id}`.toLowerCase();
      return (
        (statusFilter === 'all' || report.status === statusFilter)
        && (categoryFilter === 'all' || report.category === categoryFilter)
        && (!query || text.includes(query))
      );
    });

    const direction = sortDir === 'asc' ? 1 : -1;
    return matches.sort((a, b) => {
      const left = sortBy === 'created_at' ? new Date(a.created_at).getTime() : a[sortBy];
      const right = sortBy === 'created_at' ? new Date(b.created_at).getTime() : b[sortBy];
      if (left > right) return direction;
      if (left < right) return -direction;
      return 0;
    });
  }, [reports, search, statusFilter, categoryFilter, sortBy, sortDir]);

  const categories = useMemo(() => [...new Set(reports.map((report) => report.category))], [reports]);
  const statuses = useMemo(() => [...new Set(reports.map((report) => report.status))], [reports]);

  const counts = useMemo(() => ({
    total: reports.length,
    open: reports.filter((r) => r.status !== 'resolved').length,
    escalated: reports.filter((r) => r.status === 'escalated').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  }), [reports]);

  const hasFilters = search || statusFilter !== 'all' || categoryFilter !== 'all';

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'created_at' || key === 'severity' ? 'desc' : 'asc');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const onDelete = async (report) => {
    setActionError('');
    try {
      await deleteReport(token, report.id);
      setReports((current) => current.filter((row) => row.id !== report.id));
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to delete the request.');
    } finally {
      setConfirmId(null);
    }
  };

  const exportCsv = () => {
    const rows = filtered.map((report) => ({ ...report, created_at: formatDateTime(report.created_at) }));
    const blob = new Blob([toCsv(rows, csvColumns)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'requests.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    setActionError('');
    setIsBuildingPdf(true);
    try {
      const [overview, analytics] = await Promise.all([fetchOverview(token), fetchAnalytics(token)]);
      downloadSummaryPdf({ overview, analytics, reports: filtered });
    } catch (requestError) {
      setActionError(requestError.message || 'Unable to build the PDF report.');
    } finally {
      setIsBuildingPdf(false);
    }
  };

  return (
    <section className="stack-panel">
      <div className="page-grid page-grid-four">
        {[
          ['Total requests', counts.total, 'neutral'],
          ['Open', counts.open, 'info'],
          ['Escalated', counts.escalated, 'alert'],
          ['Resolved', counts.resolved, 'positive'],
        ].map(([label, value, tone]) => (
          <article key={label} className={`stat-card stat-${tone}`}>
            <p className="stat-label">{label}</p>
            <h3 className="stat-value">{value}</h3>
          </article>
        ))}
      </div>

      <div className="panel-card">
        <div className="requests-toolbar">
          <input
            className="text-input requests-search"
            type="search"
            placeholder="Search ID, category, description or ward"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="select-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <select className="select-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
          </select>
          <div className="requests-actions">
            <button type="button" className="secondary-btn" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </button>
            <button type="button" className="primary-btn" onClick={exportPdf} disabled={isBuildingPdf || !filtered.length}>
              {isBuildingPdf ? 'Building report...' : 'Download PDF report'}
            </button>
          </div>
        </div>

        <p className="table-meta">
          Showing {filtered.length} of {reports.length} requests
          {hasFilters && (
            <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>
          )}
        </p>

        {isLoading && <LoadingState label="Loading requests..." />}
        {error && <ErrorState message={error} />}
        {actionError && <p className="panel-message panel-error">{actionError}</p>}

        {!isLoading && !error && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  {sortableColumns.map((column) => (
                    <th key={column.key} aria-sort={sortBy === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="sort-btn" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <span className="sort-arrow">{sortBy === column.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => (
                  <tr key={report.id}>
                    <td className="mono" title={report.id}>{shortId(report.id)}</td>
                    <td>{titleCase(report.category)}</td>
                    <td><span className={severityClass(report.severity)}>{report.severity}</span></td>
                    <td><span className={`status-badge status-${report.status}`}>{statusLabel(report.status)}</span></td>
                    <td>{report.ward_id}</td>
                    <td>{formatDateTime(report.created_at)}</td>
                    <td className="row-actions">
                      {confirmId === report.id ? (
                        <>
                          <button type="button" className="danger-btn" onClick={() => onDelete(report)}>Confirm</button>
                          <button type="button" className="secondary-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" className="secondary-btn" onClick={() => setConfirmId(report.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="panel-message">No requests match the current filters.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

export default RequestsPage;
