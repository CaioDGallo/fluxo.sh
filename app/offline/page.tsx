export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          Check your connection and try again
        </p>
      </div>
    </div>
  );
}
