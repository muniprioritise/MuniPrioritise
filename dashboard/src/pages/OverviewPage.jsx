import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorState, LoadingState } from '../components/PageState.jsx';
import { fetchOverview, fetchReports } from '../services/dashboardApi.js';
import { formatDateTime, shortId, statusLabel, titleCase } from '../utils/dashboardData.js';

const STATUS_ORDER = ['pending', 'assigned', 'in_progress', 'escalated', 'resolved'];

function StatCard({ label, value, tone = 'neutral', hint }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <p className="stat-label">{label}</p>
      <h3 className="stat-value">{value}</h3>
      {hint && <p className="stat-hint">{hint}</p>}
    </article>
  );
}

function OverviewPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const overview = await fetchOverview(token);
        if (mounted) {
          setMetrics(overview);
        }
        // The request list only feeds the lower cards, so a failure here
        // should not hide the headline numbers.
        const reportRows = await fetchReports(token).catch(() => []);
        if (mounted) {
          setReports(reportRows);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load KPI cards.');
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

  const statusCounts = useMemo(
    () => STATUS_ORDER.map((status) => ({
      status,
      count: reports.filter((report) => report.status === status).length,
    })),
    [reports],
  );

  // Escalated requests first, then the longest-waiting open ones.
  const attention = useMemo(() => {
    const open = reports.filter((report) => report.status !== 'resolved');
    return open
      .sort((a, b) => {
        const escalated = Number(b.status === 'escalated') - Number(a.status === 'escalated');
        return escalated || new Date(a.created_at) - new Date(b.created_at);
      })
      .slice(0, 5);
  }, [reports]);

  if (isLoading) {
    return <LoadingState label="Loading overview..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!metrics) {
    return <p className="panel-message">No overview data available.</p>;
  }

  return (
    <section className="stack-panel">
      <div className="page-grid page-grid-four">
        <StatCard label="Open Requests" value={metrics.total_open} tone="alert" hint="Requests not yet resolved" />
        <StatCard label="Avg Response Time" value={`${metrics.avg_response_time_hours} hrs`} tone="info" hint="Mean time from request to resolution" />
        <StatCard label="Resolution Rate" value={`${metrics.resolution_rate_percent}%`} tone="positive" hint="Share of resolved requests" />
        <StatCard label="Equity Score" value={metrics.equity_score} tone="neutral" hint="Avg ward deprivation (0-1) of open requests" />
      </div>

      {reports.length > 0 && (
        <div className="overview-grid">
          <article className="panel-card">
            <h3>Requests by status</h3>
            <div className="status-bar" role="img" aria-label="Share of requests by status">
              {statusCounts.filter((item) => item.count).map((item) => (
                <span
                  key={item.status}
                  className={`status-bar-segment status-${item.status}`}
                  style={{ flexGrow: item.count }}
                  title={`${statusLabel(item.status)}: ${item.count}`}
                />
              ))}
            </div>
            <ul className="status-legend">
              {statusCounts.map((item) => (
                <li key={item.status}>
                  <span className={`status-dot status-${item.status}`} />
                  {statusLabel(item.status)}
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel-card">
            <div className="card-heading">
              <h3>Needs attention</h3>
              <Link to="/requests" className="card-link">View all</Link>
            </div>
            {attention.length === 0 ? (
              <p className="panel-subtitle">Nothing open right now.</p>
            ) : (
              <ul className="attention-list">
                {attention.map((report) => (
                  <li key={report.id}>
                    <span className="mono">{shortId(report.id)}</span>
                    <span>{titleCase(report.category)}</span>
                    <span className={`status-badge status-${report.status}`}>{statusLabel(report.status)}</span>
                    <span className="attention-date">{formatDateTime(report.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

export default OverviewPage;
