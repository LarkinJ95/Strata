"use client";

import { useRouter } from "next/navigation";

const VIEWS = [
  ["", "All records"], ["damaged", "Damaged ACM"], ["unsampled", "Unsampled"],
  ["tsi", "TSI"], ["no-photo", "No photo"], ["removed", "Removed"],
] as const;

export function InventoryFilters({ buildings, current, total }: { buildings: { id: string; name: string; buildingNumber: string }[]; current: Record<string, string | undefined>; total: number }) {
  const router = useRouter();
  function update(next: Record<string, string>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...next })) if (v && k !== "page") p.set(k, v);
    router.push(`/inventory?${p.toString()}`);
  }
  function view(v: string) {
    const values: Record<string, string> = { view: v, acm: "", condition: "" };
    if (v === "damaged") Object.assign(values, { acm: "confirmed_acm,assumed_acm,pacm", condition: "damaged,significantly_damaged,needs_repair" });
    if (v === "removed") values.condition = "removed";
    update(values);
  }
  const active = Object.entries(current).filter(([key, value]) => value && !["page", "per", "sort", "view"].includes(key));
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-1 rounded-xl border border-[rgba(16,36,72,0.08)] bg-white/70 p-1">
      {VIEWS.map(([value, label]) => <button key={value} onClick={() => view(value)} className={`btn ${current.view === value || (!current.view && !value) ? "btn-primary" : "btn-ghost"} text-xs`}>{label}</button>)}
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <label className="field lg:col-span-1"><span>Search</span><input defaultValue={current.q || ""} placeholder="Code, material, room" onKeyDown={(e) => { if (e.key === "Enter") update({ q: e.currentTarget.value }); }} /></label>
      <label className="field"><span>Building</span><select value={current.building || ""} onChange={(e) => update({ building: e.target.value })}><option value="">All buildings</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.buildingNumber} · {b.name}</option>)}</select></label>
      <label className="field"><span>Classification</span><select value={current.acm || ""} onChange={(e) => update({ acm: e.target.value })}><option value="">All classifications</option><option value="confirmed_acm">Confirmed ACM</option><option value="assumed_acm">Assumed ACM</option><option value="pacm">PACM</option><option value="non_acm">Non-ACM</option><option value="unknown">Unknown</option><option value="confirmed_acm,assumed_acm,pacm">ACM + assumed + PACM</option></select></label>
      <label className="field"><span>Condition</span><select value={current.condition || ""} onChange={(e) => update({ condition: e.target.value })}><option value="">All conditions</option><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="significantly_damaged">Significantly damaged</option><option value="needs_repair">Needs repair</option><option value="removed">Removed</option><option value="damaged,significantly_damaged,needs_repair">Damaged + repair needed</option></select></label>
      <label className="field"><span>Sort</span><select value={current.sort || "risk"} onChange={(e) => update({ sort: e.target.value })}><option value="risk">Risk</option><option value="id">ID</option><option value="quantity">Remaining quantity</option><option value="building">Building</option></select></label>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
      {active.map(([key, value]) => <button key={key} className="chip chip-muted" onClick={() => update({ [key]: "" })}>{key}: {value} ×</button>)}
      {active.length > 0 && <button className="text-teal-dim hover:underline" onClick={() => router.push("/inventory")}>Clear all</button>}
      <span className="ml-auto font-mono">{total} matching records</span>
    </div>
  </div>;
}
