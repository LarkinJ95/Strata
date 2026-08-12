"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { enterSampleResult } from "@/actions/mutations";

export function ResultForm({ sampleId }: { sampleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4 grid gap-2 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await enterSampleResult({
            sampleId,
            layerNumber: Number(fd.get("layerNumber") || 1),
            asbestosDetected: fd.get("detected") === "yes",
            asbestosPercent: fd.get("pct") && !String(fd.get("pct")).startsWith("<") ? Number(fd.get("pct")) : undefined,
            detectionLimit: String(fd.get("pct") || "").startsWith("<") ? String(fd.get("pct")) : undefined,
            fiberTypes: fd.getAll("fibers").map(String),
            method: String(fd.get("method") || "PLM"),
            comments: String(fd.get("comments") || ""),
          });
          router.refresh();
        });
      }}
    >
      <div className="field"><label>Layer</label><input name="layerNumber" type="number" defaultValue={1} min={1} /></div>
      <div className="field">
        <label>Detected</label>
        <select name="detected"><option value="yes">Asbestos detected</option><option value="no">Not detected</option></select>
      </div>
      <div className="field"><label>Percent / reporting limit</label><input name="pct" inputMode="decimal" placeholder="1 or <1%" /></div>
      <div className="field md:col-span-2"><label>Asbestos type(s)</label><div className="flex flex-wrap gap-3 rounded-lg border border-[rgba(16,36,72,0.12)] p-2 text-sm">{["Chrysotile", "Amosite", "Crocidolite", "Tremolite", "Actinolite", "Anthophyllite"].map((fiber) => <label key={fiber} className="flex items-center gap-1.5"><input name="fibers" type="checkbox" value={fiber} />{fiber}</label>)}</div></div>
      <div className="field">
        <label>Method</label>
        <select name="method">
          {["PLM", "PLM Point Count", "TEM", "Gravimetric Reduction", "Chatfield"].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="field"><label>Comments</label><input name="comments" /></div>
      <button className="btn btn-primary md:col-span-2" disabled={pending}>{pending ? "Saving…" : "Enter laboratory result"}</button>
    </form>
  );
}
