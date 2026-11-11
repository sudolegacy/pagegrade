export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true">
      <span className="sr-only">Loading report…</span>
      <div className="space-y-2"><div className="h-7 w-64 max-w-full rounded-md bg-zinc-200/70" /><div className="h-4 w-80 max-w-full rounded bg-zinc-200/50" /></div>
      <div className="h-10 rounded-lg bg-zinc-200/40" />
      <div className="card flex gap-6 p-6"><div className="size-32 shrink-0 rounded-full bg-zinc-200/70" /><div className="flex-1 space-y-3"><div className="h-5 w-1/2 rounded bg-zinc-200/70" /><div className="h-4 w-full rounded bg-zinc-200/50" /><div className="h-4 w-5/6 rounded bg-zinc-200/50" /></div></div>
      <div className="card h-64" />
    </div>
  );
}
