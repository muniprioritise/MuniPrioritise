import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchReports } from '../services/dashboardApi.js';
import { formatDateTime, toCsv } from '../utils/dashboardData.js';

const tableColumns = [
  { key: 'id', label: 'ID' },
  { key: 'category', label: 'Category' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'ward_id', label: 'Ward' },
  { key: 'created_at', label: 'Created at' },
];

function RequestTablePage() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const data = await fetchReports(token);
        if (mounted) {
          setReports(data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load request table.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const stageOne = reports.filter((report) => {
      const passesStatus = statusFilter === 'all' || report.status === statusFilter;
      const passesCategory = categoryFilter === 'all' || report.category === categoryFilter;
      const text = `${report.id} ${report.category} ${report.description} ${report.ward_id}`.toLowerCase();
      const passesSearch = !query || text.includes(query);
      return passesStatus && passesCategory && passesSearch;
    });

    const sorted = [...stageOne].sort((a, b) => {
      let left = a[sortBy];
      let right = b[sortBy];

      if (sortBy === 'created_at') {
        left = new Date(a.created_at).getTime();
        right = new Date(b.created_at).getTime();
      }

      if (left > right) {
        return sortDir === 'asc' ? 1 : -1;
      }
      if (left < right) {
        return sortDir === 'asc' ? -1 : 1;
      }
      return 0;
    });

    return sorted;
  }, [reports, search, statusFilter, categoryFilter, sortBy, sortDir]);

  const categories = useMemo(() => [...new Set(reports.map((report) => report.category))], [reports]);
  const statuses = useMemo(() => [...new Set(reports.map((report) => report.status))], [reports]);

  const exportCsv = () => {
    const csvRows = filtered.map((report) => ({
      ...report,
      created_at: formatDateTime(report.created_at),
    }));
    const csv = toCsv(csvRows, tableColumns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'requests.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="stack-panel">
      <div className="toolbar-grid">
        <input
          className="text-input"
          type="search"
          placeholder="Search ID, category, description, ward"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select className="select-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select className="select-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select className="select-input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="created_at">Sort: Created at</option>
          <option value="severity">Sort: Severity</option>
          <option value="category">Sort: Category</option>
          <option value="status">Sort: Status</option>
        </select>

        <button type="button" className="secondary-btn" onClick={() => setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))}>
          Direction: {sortDir.toUpperCase()}
        </button>

        <button type="button" className="primary-btn" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {isLoading && <p className="panel-message">Loading requests...</p>}
      {error && <p className="panel-message panel-error">{error}</p>}

      {!isLoading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Ward</th>
                <th>Created at</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>{report.category}</td>
                  <td>{report.severity}</td>
                  <td>{report.status}</td>
                  <td>{report.ward_id}</td>
                  <td>{formatDateTime(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="panel-message">No rows match current filters.</p>}
        </div>
      )}
    </section>
  );
}

export default RequestTablePage;
