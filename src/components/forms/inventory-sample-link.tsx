"use client";

import { useState, useTransition } from "react";
import { AccessField, Disclose } from "@/components/forms/access-field";
import { linkInventorySample } from "@/actions/records";

export function InventorySampleLink({ inventoryItemId, samples }: { inventoryItemId: string; samples: { id: string; sampleNumber: string; material: string }[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  if (!samples.length) return <p className="mt-3 text-xs text-ink-3">Create a sample in this building before linking it.</p>;
  return <Disclose label="Link sample"><form action={(form) => start(async () => { setMessage(""); try { await linkInventorySample(form); setMessage("Sample linked."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not link sample."); } })} className="space-y-3"><AccessField /><input type="hidden" name="inventoryItemId" value={inventoryItemId} /><div className="field"><label>Sample</label><select name="sampleId">{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleNumber} · {sample.material}</option>)}</select></div><div className="grid gap-3 md:grid-cols-2"><div className="field"><label>Layer (optional)</label><input name="layerNumber" type="number" min="1" /></div><div className="field"><label>Link type</label><select name="linkType"><option value="supporting">Supporting</option><option value="representative">Representative</option><option value="confirmatory">Confirmatory</option></select></div></div><div className="flex items-center gap-3"><button className="btn btn-primary" disabled={pending}>{pending ? "Linking…" : "Link sample"}</button>{message && <span className="text-sm text-ink-3">{message}</span>}</div></form></Disclose>;
}
