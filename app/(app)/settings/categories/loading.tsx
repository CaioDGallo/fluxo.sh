export default function CategoriesLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-8 w-40 bg-muted rounded" />
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-9 w-24 bg-muted rounded" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, itemIndex) => (
                <div key={itemIndex} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
