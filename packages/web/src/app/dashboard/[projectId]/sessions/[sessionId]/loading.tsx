export default function SessionDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-panel rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-panel border rounded-lg p-4 h-16" />
        ))}
      </div>
      <div className="bg-panel border rounded-lg h-64" />
    </div>
  );
}
