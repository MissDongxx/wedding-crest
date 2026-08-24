export default function Loading() {
  return (
    <main
      className="space-y-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading frame form"
    >
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>

      <div className="max-w-xl space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </main>
  );
}
