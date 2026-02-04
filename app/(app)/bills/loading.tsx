export default function BillsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="h-10 w-28 bg-muted rounded" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
