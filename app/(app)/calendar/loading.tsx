export default function CalendarLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between flex-col md:flex-row space-y-4 md:space-y-0">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="h-10 w-32 bg-muted rounded" />
          <div className="h-10 w-32 bg-muted rounded" />
          <div className="h-10 w-32 bg-muted rounded" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-32 bg-muted rounded" />
        <div className="h-9 w-32 bg-muted rounded" />
        <div className="h-9 w-40 bg-muted rounded" />
        <div className="h-9 w-36 bg-muted rounded" />
      </div>
      <div className="h-[520px] bg-muted rounded-lg" />
    </div>
  );
}
