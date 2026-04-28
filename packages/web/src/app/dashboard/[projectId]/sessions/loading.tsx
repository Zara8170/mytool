export default function SessionsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-24 bg-panel rounded" />
      <div className="bg-panel border rounded-lg overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 border-b last:border-b-0 px-4 flex items-center">
            <div className="h-3 w-32 bg-muted/20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
