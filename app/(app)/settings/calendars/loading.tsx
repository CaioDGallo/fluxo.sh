export default function CalendarsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="mb-6 flex items-center flex-col md:flex-row space-y-4 md:space-y-0 justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
        <div className="h-10 w-36 bg-muted rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
