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
            asbestosPercent: fd.get("pct") ? Number(fd.get("pct")) : undefined,
            fiberTypes: String(fd.get("fibers") || "").split(",").map((s) => s.trim()).filter(Boolean),
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
      <div className="field"><label>Percent</label><input name="pct" type="number" step="0.1" /></div>
      <div className="field"><label>Fiber types</label><input name="fibers" placeholder="Chrysotile, Amosite" /></div>
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
