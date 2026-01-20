export default function SettingsBudgetsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="flex items-center gap-3">
          <div className="size-10 bg-muted rounded" />
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="size-10 bg-muted rounded" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-40 bg-muted rounded" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
