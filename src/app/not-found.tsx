import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper bg-aurora px-6">
      <div className="panel max-w-md rounded-3xl p-8 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">Record not in scope</div>
        <h1 className="mt-2 font-display text-2xl font-semibold">This record is not available</h1>
        <p className="mt-2 text-sm text-ink-3">
          It may not exist, or your role cannot see another client’s files.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Return</Link>
      </div>
    </div>
  );
}
