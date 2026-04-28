export default function OverviewLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-32 bg-panel rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-panel border rounded-lg p-4 h-20" />
        ))}
      </div>
      <div className="bg-panel border rounded-lg h-48" />
    </div>
  );
}
