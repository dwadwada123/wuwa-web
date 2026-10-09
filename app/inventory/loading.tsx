export default function InventoryLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Header Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-secondary/80 rounded-lg" />
          <div className="h-4 w-96 bg-secondary/50 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-secondary/70 rounded-lg" />
          <div className="h-9 w-36 bg-primary/30 rounded-lg" />
        </div>
      </div>

      {/* Filter Toolbar Skeleton */}
      <div className="rounded-xl border border-border/80 bg-card/60 p-5 space-y-4">
        <div className="h-10 w-full bg-secondary/60 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-secondary/70 rounded-md" />
          <div className="h-7 w-24 bg-secondary/50 rounded-md" />
          <div className="h-7 w-24 bg-secondary/50 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-secondary/50 rounded-md" />
          <div className="h-7 w-16 bg-secondary/50 rounded-md" />
          <div className="h-7 w-16 bg-secondary/50 rounded-md" />
          <div className="h-7 w-16 bg-secondary/50 rounded-md" />
        </div>
      </div>

      {/* Resonator Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-16 bg-secondary/70 rounded-md" />
              <div className="h-4 w-12 bg-secondary/50 rounded" />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-14 w-14 rounded-xl bg-secondary/80 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-28 bg-secondary/80 rounded" />
                <div className="h-3.5 w-16 bg-secondary/50 rounded" />
              </div>
            </div>

            <div className="h-16 rounded-lg bg-secondary/30" />

            <div className="pt-2 border-t border-border/40 flex justify-between gap-2">
              <div className="h-7 flex-1 bg-secondary/60 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
