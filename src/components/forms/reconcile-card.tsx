"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reconcileSample } from "@/actions/mutations";

type Layer = { n: number; desc: string; detected: boolean | null; pct: number | null; fibers: string[]; method: string };

export function ReconcileCard({
  sample,
  inventory,
}: {
  sample: {
    id: string;
    sampleNumber: string;
    material: string;
    floor: string | null;
    room: string | null;
    location: string | null;
    buildingId: string;
    buildingName: string;
    layers: Layer[];
  };
  inventory: { id: string; inventoryCode: string; materialDescription: string; floor: string | null; room: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"create" | "link" | "update" | "supporting" | "none">("create");
  const [invId, setInvId] = useState(inventory[0]?.id || "");
  const [explain, setExplain] = useState("");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mono-id text-teal-dim">{sample.sampleNumber}</div>
          <div className="font-display text-lg font-semibold">{sample.material}</div>
          <div className="text-sm text-ink-3">{sample.buildingName} · {[sample.floor, sample.room, sample.location].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        {sample.layers.map((l) => (
          <div key={l.n} className="rounded-lg bg-paper-2 px-3 py-2">
            Layer {l.n} · {l.desc} — {l.detected ? `${l.pct}% ${l.fibers.join(", ")}` : "None detected"} ({l.method})
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["create", "link", "update", "supporting", "none"] as const).map((a) => (
          <button key={a} type="button" onClick={() => setAction(a)} className={`btn ${action === a ? "btn-primary" : "btn-ghost"} text-xs`}>
            {a === "create" ? "Add as new inventory" : a === "link" ? "Link existing" : a === "update" ? "Update existing" : a === "supporting" ? "Supporting sample" : "No inventory entry"}
          </button>
        ))}
      </div>
      {(action === "link" || action === "update" || action === "supporting") && (
        <div className="field mt-3">
          <label>Existing inventory</label>
          <select value={invId} onChange={(e) => setInvId(e.target.value)}>
            {inventory.map((i) => (
              <option key={i.id} value={i.id}>{i.inventoryCode} · {i.materialDescription} · {i.floor}/{i.room}</option>
            ))}
          </select>
        </div>
      )}
      {action === "none" && (
        <div className="field mt-3">
          <label>Explanation (required)</label>
          <input value={explain} onChange={(e) => setExplain(e.target.value)} required />
        </div>
      )}
      <button
        className="btn btn-primary mt-4"
        disabled={pending || (action === "none" && !explain)}
        onClick={() =>
          start(async () => {
            await reconcileSample({
              sampleId: sample.id,
              action,
              inventoryItemId: invId || undefined,
              explanation: explain,
              newItem: {
                material: sample.material,
                classification: sample.layers.some((l) => l.detected) ? "confirmed_acm" : "non_acm",
                floor: sample.floor ?? undefined,
                room: sample.room ?? undefined,
                location: sample.location ?? undefined,
                quantity: 0,
                unit: "SF",
                condition: "good",
              },
            });
            router.refresh();
          })
        }
      >
        {pending ? "Saving…" : "Commit reconciliation"}
      </button>
    </div>
  );
}
