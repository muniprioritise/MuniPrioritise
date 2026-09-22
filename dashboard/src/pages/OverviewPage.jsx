import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchOverview, fetchReports } from '../services/dashboardApi.js';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const reports = await fetchReports(token);
        const overview = await fetchOverview(token, reports);
        if (mounted) {
          setMetrics(overview);
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

  if (isLoading) {
    return <p className="panel-message">Loading overview metrics...</p>;
  }

  if (error) {
    return <p className="panel-message panel-error">{error}</p>;
  }

  if (!metrics) {
    return <p className="panel-message">No overview data available.</p>;
  }

  return (
    <section className="page-grid page-grid-four">
      <StatCard
        label="Open Requests"
        value={metrics.total_open}
        tone="alert"
        hint="Requests not yet resolved"
      />
      <StatCard
        label="Avg Response Time"
        value={`${metrics.avg_response_time_hours} hrs`}
        tone="info"
        hint="Mean time from create to update"
      />
      <StatCard
        label="Resolution Rate"
        value={`${metrics.resolution_rate_percent}%`}
        tone="positive"
        hint="Share of resolved requests"
      />
      <StatCard
        label="Equity Score"
        value={metrics.equity_score}
        tone="neutral"
        hint="Distribution fairness across wards"
      />
    </section>
  );
}

export default OverviewPage;
