import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchAnalytics, fetchReports } from '../services/dashboardApi.js';

function AnalyticsPage() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const reports = await fetchReports(token);
        const payload = await fetchAnalytics(token, reports);
        if (mounted) {
          setAnalytics(payload);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load analytics.');
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
    return <p className="panel-message">Loading analytics...</p>;
  }

  if (error) {
    return <p className="panel-message panel-error">{error}</p>;
  }

  if (!analytics) {
    return <p className="panel-message">No analytics data available.</p>;
  }

  return (
    <section className="chart-grid">
      <article className="chart-card">
        <h3>Response time by category</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={analytics.responseTimeByCategory}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avg_response_hours" fill="#2d6a4f" name="Avg response (hrs)" />
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className="chart-card">
        <h3>Requests over time</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics.requestsOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="requests" stroke="#1d3557" strokeWidth={2} name="Requests" />
          </LineChart>
        </ResponsiveContainer>
      </article>

      <article className="chart-card chart-card-wide">
        <h3>Equity by ward</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={analytics.equityByWard}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ward" />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="equity_score" fill="#9b2226" name="Equity score" />
          </BarChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
}

export default AnalyticsPage;
