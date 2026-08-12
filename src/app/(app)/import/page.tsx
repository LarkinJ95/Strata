"use client";

import { useState, useTransition } from "react";
import { AccessField } from "@/components/forms/access-field";
import { importStructuredCsv } from "@/actions/imports";

const files = ["clients", "facilities", "buildings", "floors", "functional-areas", "inventory"] as const;

export default function ImportPage() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div>
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">Bulk operations</div>
        <h1 className="font-display text-2xl font-semibold">Structured portfolio import</h1>
        <p className="text-sm text-ink-3">Add new clients, facilities, buildings, floors, functional areas, and inventory in a single validated operation. Existing records are never merged or overwritten.</p>
      </div>
      <form className="panel max-w-3xl rounded-2xl p-5" onSubmit={(event) => {
        event.preventDefault(); setMessage("");
        const form = new FormData(event.currentTarget);
        start(async () => {
          try {
            const result = await importStructuredCsv(form);
            setMessage(`Imported ${result.clients} clients, ${result.facilities} facilities, ${result.buildings} buildings, and ${result.inventory} inventory records.`);
            event.currentTarget.reset();
          } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
        });
      }}>
        <AccessField />
        <ol className="mb-5 list-decimal space-y-1 pl-5 text-sm text-ink-3">
          <li>Download the <a className="text-teal underline" href="/imports/STRATA-import-template.xlsx">workbook template</a> or use the supplied CSV samples.</li>
          <li>Attach all six CSV files. Join keys are validated in this order: client → facility → building → floor / functional area → inventory.</li>
          <li>Confirm the import. Duplicate client or inventory codes stop the entire import.</li>
        </ol>
        <div className="grid gap-3 md:grid-cols-2">
          {files.map((name) => <div className="field" key={name}><label>{name}.csv</label><input name={name} type="file" accept=".csv,text/csv" required /></div>)}
        </div>
        <button className="btn btn-primary mt-5" disabled={pending}>{pending ? "Importing…" : "Validate and import"}</button>
        {message && <p className={`mt-3 text-sm ${message.startsWith("Imported") ? "text-teal-dim" : "text-red-700"}`}>{message}</p>}
      </form>
    </div>
  );
}
