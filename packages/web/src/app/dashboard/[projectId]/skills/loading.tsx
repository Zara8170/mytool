export default function SkillsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-24 bg-panel rounded" />
      <div className="bg-panel border rounded-lg p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-40 bg-muted/20 rounded" />
            <div className="h-3 w-12 bg-muted/20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
