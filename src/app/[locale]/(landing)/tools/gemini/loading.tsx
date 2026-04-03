export default function GeminiLoading() {
  return (
    <div className="pt-24 pb-16 md:pt-36">
      {/* Hero skeleton */}
      <div className="mx-auto mb-12 max-w-3xl px-4 text-center">
        <div className="mx-auto mb-6 h-7 w-56 animate-pulse rounded-full bg-muted" />
        <div className="mx-auto mb-4 h-12 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
        <div className="mx-auto h-6 w-full max-w-md animate-pulse rounded bg-muted" />
      </div>

      {/* Upload zone skeleton */}
      <div className="mx-auto max-w-2xl px-4">
        <div className="flex h-64 animate-pulse flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted bg-muted/30">
          <div className="mb-4 h-10 w-10 animate-pulse rounded-xl bg-muted" />
          <div className="mb-2 h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
