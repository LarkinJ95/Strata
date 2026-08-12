"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6">
      <div className="panel max-w-lg rounded-3xl p-8 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b42318]">System</div>
        <h1 className="mt-2 font-display text-2xl font-semibold">Something interrupted this view</h1>
        <p className="mt-2 text-sm text-ink-3">{error.message}</p>
        <button className="btn btn-primary mt-6" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
