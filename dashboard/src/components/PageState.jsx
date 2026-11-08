export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="page-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry = () => window.location.reload() }) {
  return (
    <div className="page-state page-state-error" role="alert">
      <p>{message}</p>
      <button type="button" className="secondary-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
