export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">403</h1>
      <p className="mt-2 text-lg">You don't have permission to access this page.</p>
      <a href="/login" className="mt-4 text-primary hover:underline">Go to sign in</a>
    </div>
  );
}