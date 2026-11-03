export default function Loading() {
  return (
    <div className="container app-state" role="status" aria-live="polite">
      <div className="app-spinner" aria-hidden="true" />
      <span className="visually-hidden">Loading…</span>
    </div>
  );
}
