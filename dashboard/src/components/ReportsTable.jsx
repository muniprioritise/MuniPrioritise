import { useEffect, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
const reportsUrl = apiBaseUrl
  ? `${apiBaseUrl.replace(/\/api\/v1\/?$/, '')}/api/reports`
  : '/api/reports';

function ReportsTable() {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(reportsUrl);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();
        setReports(data);
      } catch (requestError) {
        setError(requestError.message || 'Unable to load reports.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <main className="reports-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Municipal service requests</p>
          <h1>Reports</h1>
          <p className="page-description">All submitted issues in the municipality.</p>
        </div>
        {!isLoading && !error && <span className="report-count">{reports.length} reports</span>}
      </header>

      <section className="table-panel" aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="sr-only">Submitted reports</h2>
        {isLoading && <p className="table-message">Loading reports...</p>}
        {error && <p className="table-message error-message">Could not load reports: {error}</p>}
        {!isLoading && !error && reports.length === 0 && (
          <p className="table-message">No reports have been submitted yet.</p>
        )}
        {!isLoading && !error && reports.length > 0 && (
          <div className="table-scroll-container">
            <table>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Category</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created at</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="report-id">{report.id}</td>
                    <td>{report.category}</td>
                    <td>{report.severity}</td>
                    <td><span className={`status status-${report.status}`}>{report.status}</span></td>
                    <td>{new Date(report.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default ReportsTable;
