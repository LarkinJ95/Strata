"use client";

import { useSearchParams } from "next/navigation";
import { persistSession, readStoredSession } from "@/lib/session-client";
import { useEffect } from "react";

const DEMOS = [
  { email: "emma.wright@northline.env", role: "Organization Admin", name: "Emma Wright" },
  { email: "marcus.chen@northline.env", role: "Environmental Manager", name: "Marcus Chen" },
  { email: "sofia.reyes@northline.env", role: "Inspector", name: "Sofia Reyes" },
  { email: "patricia.holm@metrohealth.org", role: "Client Administrator", name: "Patricia Holm" },
  { email: "renee.vale@abatepro.com", role: "Contractor", name: "Renee Vale" },
];

export function LoginForm() {
  const params = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    const existing = readStoredSession();
    const next = params.get("next") || "/dashboard";
    if (existing && !error) {
      persistSession(existing);
      window.location.replace(`${next}${next.includes("?") ? "&" : "?"}access=${encodeURIComponent(existing)}`);
    }
  }, [error, params]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04070d]">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(900px 420px at 18% 40%, rgba(20,120,255,0.28), transparent 55%), radial-gradient(700px 360px at 80% 80%, rgba(12,80,180,0.18), transparent 50%)",
        }}
      />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="text-white">
          <img src="/strata-logo.png" alt="Strata" className="mb-8 h-16 w-auto max-w-full object-contain drop-shadow-[0_0_40px_rgba(40,140,255,0.55)]" />
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            The permanent record
            <br />
            of every material.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/70">
            Inventory, sampling, laboratory results, inspections, photographs, repairs, and
            removals — linked into one traceable asbestos record for each building.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-center gap-3">
            <img src="/favicon.png" alt="" className="h-10 w-10 rounded-xl shadow-glow" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">Authorized access</div>
              <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
            </div>
          </div>
          <form action="/api/auth/session-login" method="post" className="space-y-4">
            <input type="hidden" name="next" value={params.get("next") || ""} />
            <div className="field">
              <label>Email</label>
              <input name="email" defaultValue="emma.wright@northline.env" autoComplete="username" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input name="password" type="password" defaultValue="Strata2026!" autoComplete="current-password" required />
            </div>
            {error && (
              <div className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-[#b42318]">
                {error === "invalid" ? "Invalid credentials." : "Email and password are required."}
              </div>
            )}
            <button className="btn btn-primary w-full btn-lg" type="submit">
              Enter platform
            </button>
          </form>
          <div className="hairline my-6" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Demonstration identities</div>
          <div className="mt-3 space-y-1.5">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  const form = document.querySelector("form") as HTMLFormElement | null;
                  if (!form) return;
                  (form.elements.namedItem("email") as HTMLInputElement).value = d.email;
                  (form.elements.namedItem("password") as HTMLInputElement).value = "Strata2026!";
                }}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm hover:bg-teal-soft/60"
              >
                <span>
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-2 text-xs text-ink-3">{d.email}</span>
                </span>
                <span className="chip chip-teal">{d.role}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] text-ink-4">Password for all demo accounts: Strata2026!</p>
        </div>
      </div>
    </div>
  );
}
