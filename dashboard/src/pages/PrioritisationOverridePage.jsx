import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchOverrideAudit,
  fetchQueue,
  fetchWorkers,
  submitOverride,
} from '../services/dashboardApi.js';
import { formatDateTime, shortId } from '../utils/dashboardData.js';

function PrioritisationOverridePage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState([]);
  const [audit, setAudit] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [reasonByJob, setReasonByJob] = useState({});
  const [newWorkerByJob, setNewWorkerByJob] = useState({});
  const [errorByJob, setErrorByJob] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError('');
      setIsLoading(true);
      try {
        const [queueData, auditData, workerData] = await Promise.all([
          fetchQueue(token),
          fetchOverrideAudit(token),
          fetchWorkers(token),
        ]);
        if (!mounted) {
          return;
        }
        setQueue(queueData);
        setAudit(auditData);
        setWorkers(workerData);
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

  // Show the worker's name instead of their UUID.
  const workerNames = useMemo(
    () =>
      Object.fromEntries(
        workers.map((worker) => [worker.id, worker.full_name || worker.email || shortId(worker.id)]),
      ),
    [workers],
  );

  const workerLabel = (id) => (id ? workerNames[id] || shortId(id) : 'unassigned');

  const onOverride = async (job) => {
    const reason = reasonByJob[job.id]?.trim();
    const newWorkerId = newWorkerByJob[job.id];

    if (!reason || !newWorkerId) {
      return;
    }

    setErrorByJob((current) => ({ ...current, [job.id]: '' }));

    try {
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
      setNewWorkerByJob((current) => ({ ...current, [job.id]: '' }));
    } catch (requestError) {
      setErrorByJob((current) => ({
        ...current,
        [job.id]: requestError.message || 'Override failed. Try again.',
      }));
    }
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
                <th>Request</th>
                <th>Category</th>
                <th>Severity</th>
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
                  <td title={job.report_id}>{shortId(job.report_id)}</td>
                  <td>{job.report?.category || 'unknown'}</td>
                  <td>{job.report?.severity ?? '-'}</td>
                  <td>{Number.isFinite(job.priority_score) ? job.priority_score.toFixed(2) : '-'}</td>
                  <td>{workerLabel(job.worker_id)}</td>
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
                      {workers
                        .filter((worker) => worker.id !== job.worker_id)
                        .map((worker) => (
                          <option key={worker.id} value={worker.id}>
                            {workerLabel(worker.id)}
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
                    {errorByJob[job.id] && (
                      <p className="form-error">{errorByJob[job.id]}</p>
                    )}
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
          {!queue.length && <p className="panel-message">No pending requests in the queue.</p>}
        </div>
      </article>

      <article className="panel-card">
        <h3>Override audit log</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Request</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id || `${entry.job_id}-${entry.created_at}`}>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td title={entry.report_id}>{shortId(entry.report_id || entry.job_id)}</td>
                  <td>{workerLabel(entry.old_worker_id)}</td>
                  <td>{workerLabel(entry.new_worker_id)}</td>
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
