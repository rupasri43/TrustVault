/** Shown while a page's data is loading. */
export function PagePending() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]" aria-busy="true" aria-label="Loading">
      <aside className="hidden h-screen bg-ink-gradient lg:block" />
      <main className="px-5 py-10 md:px-10">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-3 w-24 rounded bg-brass-soft" />
          <div className="h-9 w-80 max-w-full rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-lg border border-border bg-card" />)}
          </div>
          <div className="h-72 rounded-lg border border-border bg-card" />
        </div>
      </main>
    </div>
  );
}
