"use client";

import { useRouter } from "next/navigation";

export function InventoryFilters({
  buildings,
  current,
}: {
  buildings: { id: string; name: string; buildingNumber: string }[];
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  function set(key: string, value: string) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) if (v) p.set(k, v);
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/inventory?${p.toString()}`);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <select className="rounded-xl border border-[rgba(16,36,72,0.1)] bg-white px-3 py-2 text-sm" defaultValue={current.building || ""} onChange={(e) => set("building", e.target.value)}>
        <option value="">All buildings</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>{b.buildingNumber} · {b.name}</option>
        ))}
      </select>
      <select className="rounded-xl border border-[rgba(16,36,72,0.1)] bg-white px-3 py-2 text-sm" defaultValue={current.acm || ""} onChange={(e) => set("acm", e.target.value)}>
        <option value="">All classifications</option>
        <option value="confirmed_acm">Confirmed ACM</option>
        <option value="assumed_acm">Assumed ACM</option>
        <option value="pacm">PACM</option>
        <option value="non_acm">Non-ACM</option>
        <option value="unknown">Unknown</option>
        <option value="removed">Removed</option>
      </select>
      <select className="rounded-xl border border-[rgba(16,36,72,0.1)] bg-white px-3 py-2 text-sm" defaultValue={current.condition || ""} onChange={(e) => set("condition", e.target.value)}>
        <option value="">All conditions</option>
        <option value="good">Good</option>
        <option value="fair">Fair</option>
        <option value="damaged">Damaged</option>
        <option value="significantly_damaged">Significantly damaged</option>
        <option value="needs_repair">Needs repair</option>
        <option value="removed">Removed</option>
      </select>
      {[
        ["", "All records"],
        ["damaged", "Damaged ACM"],
        ["tsi", "TSI"],
        ["removed", "Removed"],
      ].map(([v, l]) => (
        <button key={v} onClick={() => set("view", v)} className={`btn ${current.view === v || (!current.view && !v) ? "btn-primary" : "btn-ghost"} text-xs`}>
          {l}
        </button>
      ))}
    </div>
  );
}
