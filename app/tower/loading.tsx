export default function TowerLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <div className="h-8 w-72 bg-secondary/80 rounded-lg" />
          <div className="h-4 w-96 bg-secondary/50 rounded-md" />
        </div>
        <div className="h-8 w-44 bg-secondary/60 rounded-lg" />
      </div>

      {/* Configuration Controls Skeletons */}
      <div className="space-y-4">
        <div className="h-20 rounded-xl border border-border/70 bg-card/60" />
        <div className="h-28 rounded-xl border border-border/70 bg-card/60" />
        <div className="h-20 rounded-xl border border-border/70 bg-card/60" />
      </div>

      {/* Stage Assignments Skeleton */}
      <div className="space-y-6 pt-4 border-t border-border">
        <div className="h-6 w-56 bg-secondary/70 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 rounded-xl border border-border/60 bg-card/60" />
          <div className="h-40 rounded-xl border border-border/60 bg-card/60" />
        </div>
      </div>
    </div>
  );
}
