export default function DataSettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-40 bg-muted rounded" />
      <div className="border-2 border-muted/40 bg-muted/10 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-5 bg-muted rounded-full" />
          <div className="h-5 w-32 bg-muted rounded" />
        </div>
        <div className="h-4 w-96 bg-muted rounded" />
        <div className="border border-muted/40 p-4 bg-background space-y-4">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-10 w-40 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
