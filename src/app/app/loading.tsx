/** Shown instantly while a dashboard tab loads, so navigation never looks frozen. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-zinc-200/70" />
        <div className="h-4 w-72 max-w-full rounded bg-zinc-200/50" />
      </div>
      <div className="card h-36" />
      <div className="card divide-y divide-zinc-100">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="size-8 rounded-md bg-zinc-200/70" />
            <div className="flex-1 space-y-2"><div className="h-3.5 w-1/3 rounded bg-zinc-200/70" /><div className="h-3 w-2/3 rounded bg-zinc-200/50" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
