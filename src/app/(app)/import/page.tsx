"use client";

import { useMemo, useState } from "react";

export default function ImportPage() {
  const [text, setText] = useState("inventory_code,floor,room,location,material,classification,quantity,unit,condition\nMH01-099,2,Storage,Above ceiling,Suspect pipe wrap,unknown,12,LF,fair");
  const [committed, setCommitted] = useState(false);

  const rows = useMemo(() => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line, i) => {
      const cols = line.split(",");
      const rec: Record<string, string> = { _row: String(i + 1) };
      headers.forEach((h, idx) => (rec[h] = (cols[idx] || "").trim()));
      rec._error = !rec.material || !rec.inventory_code ? "Missing required fields" : "";
      rec._dup = rec.inventory_code?.startsWith("MH01-00") ? "Possible duplicate of existing record" : "";
      return rec;
    });
  }, [text]);

  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">Bulk operations</div>
        <h1 className="font-display text-2xl font-semibold">Inventory import wizard</h1>
        <p className="text-sm text-ink-3">Upload is previewed and validated before anything is written. Records are never merged automatically.</p>
      </div>
      <div className="panel rounded-2xl p-5">
        <ol className="mb-4 flex flex-wrap gap-2 text-xs">
          {["1. Upload", "2. Map", "3. Preview", "4. Validate", "5. Confirm"].map((s, i) => (
            <li key={s} className={`rounded-full px-3 py-1 ${i < 4 ? "bg-teal-soft text-teal-dim" : "bg-paper-2 text-ink-3"}`}>{s}</li>
          ))}
        </ol>
        <div className="field">
          <label>CSV</label>
          <textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setCommitted(false); }} />
        </div>
        <div className="table-wrap mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>Row</th><th>Code</th><th>Material</th><th>Class</th><th>Qty</th><th>Validation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._row}>
                  <td>{r._row}</td>
                  <td className="mono-id">{r.inventory_code}</td>
                  <td>{r.material}</td>
                  <td>{r.classification}</td>
                  <td>{r.quantity} {r.unit}</td>
                  <td className="text-xs">{r._error || r._dup || "Ready"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-primary mt-4" onClick={() => setCommitted(true)}>Confirm import (demo preview)</button>
        {committed && (
          <p className="mt-3 text-sm text-teal-dim">
            Preview accepted. In production this transaction would create inventory rows, quantity history, and an import job summary — never silently overwrite existing compliance records.
          </p>
        )}
      </div>
    </div>
  );
}
