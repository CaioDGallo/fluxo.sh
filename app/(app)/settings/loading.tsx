export default function SettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 bg-muted rounded" />
      <div className="grid gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
