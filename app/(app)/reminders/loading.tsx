export default function RemindersLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="h-10 w-40 bg-muted rounded" />
      </div>
      <div className="space-y-6">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
