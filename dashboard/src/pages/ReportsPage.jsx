import { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchAnalytics, fetchOverview, fetchReports } from '../services/dashboardApi.js';
import { formatDateTime } from '../utils/dashboardData.js';

function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const reportRows = await fetchReports(token);
        const [overviewData, analyticsData] = await Promise.all([
          fetchOverview(token, reportRows),
          fetchAnalytics(token, reportRows),
        ]);
        if (!mounted) {
          return;
        }
        setReports(reportRows);
        setOverview(overviewData);
        setAnalytics(analyticsData);
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load report summary data.');
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

  const topRows = useMemo(() => reports.slice(0, 8), [reports]);

  const exportPdf = () => {
    if (!overview || !analytics) {
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('MuniPrioritise Supervisor Summary', 14, 18);

    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);

    doc.text('KPI snapshot', 14, 36);
    doc.text(`Open requests: ${overview.total_open}`, 14, 43);
    doc.text(`Avg response time: ${overview.avg_response_time_hours} hrs`, 14, 50);
    doc.text(`Resolution rate: ${overview.resolution_rate_percent}%`, 14, 57);
    doc.text(`Equity score: ${overview.equity_score}`, 14, 64);

    doc.text('Requests by category (avg response hrs)', 14, 76);
    let lineY = 83;
    analytics.responseTimeByCategory.forEach((row) => {
      doc.text(`${row.category}: ${row.avg_response_hours}`, 14, lineY);
      lineY += 6;
    });

    lineY += 6;
    doc.text('Recent requests', 14, lineY);
    lineY += 7;

    topRows.forEach((report) => {
      const line = `${report.id} | ${report.category} | sev ${report.severity} | ${report.status} | ${report.ward_id}`;
      doc.text(line, 14, lineY);
      lineY += 6;
      if (lineY > 280) {
        doc.addPage();
        lineY = 20;
      }
    });

    doc.save('supervisor-summary.pdf');
  };

  if (isLoading) {
    return <p className="panel-message">Loading report builder...</p>;
  }

  if (error) {
    return <p className="panel-message panel-error">{error}</p>;
  }

  return (
    <section className="stack-panel">
      <article className="panel-card">
        <h3>PDF summary</h3>
        <p className="panel-subtitle">
          Generate a supervisor-ready summary with KPI cards, category response timings, and recent request highlights.
        </p>
        <button type="button" className="primary-btn" onClick={exportPdf}>
          Export PDF via jsPDF
        </button>
      </article>

      <article className="panel-card">
        <h3>Latest request snapshot</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Status</th>
                <th>Ward</th>
                <th>Created at</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((report) => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>{report.category}</td>
                  <td>{report.status}</td>
                  <td>{report.ward_id}</td>
                  <td>{formatDateTime(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export default ReportsPage;
