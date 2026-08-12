export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#071019] px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(18,150,143,0.18),transparent_52%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] sm:p-9">
        <div className="mb-8 text-center">
          <img src="/strata-logo.png" alt="Strata" className="mx-auto h-12 w-auto max-w-full object-contain" />
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-3">Sign in to access your organization.</p>
        </div>
        <form action="/api/auth/session-login" method="post" className="space-y-4">
          <input type="hidden" name="next" value={safeNext} />
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="username" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && <div className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-[#b42318]">{error === "invalid" ? "Incorrect email or password." : "Email and password are required."}</div>}
          <button className="btn btn-primary w-full btn-lg" type="submit">Sign in</button>
        </form>
        <p className="mt-7 text-center text-xs leading-5 text-ink-3">Need access? Contact your organization administrator.</p>
      </section>
    </main>
  );
}
