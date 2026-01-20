export default function AccountsLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="mb-6 flex items-center flex-col md:flex-row space-y-4 md:space-y-0 justify-between">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-48 bg-muted rounded" />
          <div className="h-10 w-32 bg-muted rounded" />
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3">
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, itemIndex) => (
                <div key={itemIndex} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
