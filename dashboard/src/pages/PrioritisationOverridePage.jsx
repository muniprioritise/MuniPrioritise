import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchOverrideAudit,
  fetchQueue,
  fetchReports,
  submitOverride,
} from '../services/dashboardApi.js';
import { formatDateTime } from '../utils/dashboardData.js';

function PrioritisationOverridePage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState([]);
  const [audit, setAudit] = useState([]);
  const [reasonByJob, setReasonByJob] = useState({});
  const [newWorkerByJob, setNewWorkerByJob] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const reports = await fetchReports(token);
        const [queueData, auditData] = await Promise.all([
          fetchQueue(token, reports),
          fetchOverrideAudit(token),
        ]);
        if (!mounted) {
          return;
        }
        setQueue(queueData);
        setAudit(auditData);
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load override queue.');
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

  const workerOptions = useMemo(
    () => ['worker-1', 'worker-2', 'worker-3', 'worker-4', 'worker-5'],
    [],
  );

  const onOverride = async (job) => {
    const reason = reasonByJob[job.id]?.trim();
    const newWorkerId = newWorkerByJob[job.id];

    if (!reason || !newWorkerId) {
      return;
    }

    const entry = await submitOverride(token, {
      job_id: job.id,
      report_id: job.report_id,
      old_worker_id: job.worker_id,
      new_worker_id: newWorkerId,
      reason,
    });

    setQueue((current) =>
      current.map((item) =>
        item.id === job.id
          ? {
              ...item,
              worker_id: newWorkerId,
            }
          : item,
      ),
    );

    setAudit((current) => [entry, ...current]);
    setReasonByJob((current) => ({ ...current, [job.id]: '' }));
  };

  if (isLoading) {
    return <p className="panel-message">Loading prioritisation queue...</p>;
  }

  if (error) {
    return <p className="panel-message panel-error">{error}</p>;
  }

  return (
    <section className="stack-panel">
      <article className="panel-card">
        <h3>Queue with manual reassign</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Current worker</th>
                <th>Reassign to</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((job) => (
                <tr key={job.id}>
                  <td>{job.report_id}</td>
                  <td>{job.report?.category || 'unknown'}</td>
                  <td>{job.priority_score ?? '-'}</td>
                  <td>{job.worker_id || 'unassigned'}</td>
                  <td>
                    <select
                      className="select-input"
                      value={newWorkerByJob[job.id] || ''}
                      onChange={(event) =>
                        setNewWorkerByJob((current) => ({
                          ...current,
                          [job.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose worker</option>
                      {workerOptions.map((worker) => (
                        <option key={worker} value={worker}>
                          {worker}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="text-input"
                      type="text"
                      placeholder="Override reason"
                      value={reasonByJob[job.id] || ''}
                      onChange={(event) =>
                        setReasonByJob((current) => ({
                          ...current,
                          [job.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={!newWorkerByJob[job.id] || !reasonByJob[job.id]?.trim()}
                      onClick={() => onOverride(job)}
                    >
                      Apply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel-card">
        <h3>Override audit log</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Job</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id || `${entry.job_id}-${entry.created_at}`}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td>{entry.job_id}</td>
                  <td>{entry.old_worker_id || 'unknown'}</td>
                  <td>{entry.new_worker_id}</td>
                  <td>{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!audit.length && <p className="panel-message">No overrides recorded yet.</p>}
        </div>
      </article>
    </section>
  );
}

export default PrioritisationOverridePage;
