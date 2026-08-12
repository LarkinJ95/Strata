"use client";

import Link from "next/link";
import { Search, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/actions/mutations";

type Results = Awaited<ReturnType<typeof globalSearch>>;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const request = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults(null); return; }
    const requestId = ++request.current;
    const timer = window.setTimeout(() => start(async () => {
      try {
        const next = await globalSearch(term);
        if (request.current === requestId) setResults(next);
      } catch {
        if (request.current === requestId) setResults(null);
      }
    }), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const rows = results ? [
    ...results.clients.map((item) => ({ id: `client-${item.id}`, href: `/clients/${item.id}`, type: "Client", title: item.name, detail: item.clientNumber })),
    ...results.facilities.map((item) => ({ id: `facility-${item.id}`, href: `/clients/${item.clientId}`, type: "Facility", title: item.name, detail: `${item.facilityId} · ${item.client.name}` })),
    ...results.buildings.map((item) => ({ id: `building-${item.id}`, href: `/buildings/${item.id}`, type: "Building", title: item.name, detail: item.buildingNumber })),
    ...results.inventory.map((item) => ({ id: `inventory-${item.id}`, href: `/inventory/${item.id}`, type: "Inventory", title: item.materialDescription, detail: `${item.inventoryCode} · ${item.building.name}` })),
  ].slice(0, 10) : [];

  return (
    <div className="relative max-w-xl">
      <form onSubmit={(event) => { event.preventDefault(); if (query.trim().length >= 2) { setOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`); } }}>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" size={15} />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          type="search"
          minLength={2}
          placeholder="Search clients, facilities, buildings, inventory…"
          aria-label="Search records"
          aria-autocomplete="list"
          aria-expanded={open && query.trim().length >= 2}
          className="h-9 w-full rounded-xl border border-[rgba(16,36,72,0.11)] bg-white pl-9 pr-8 text-sm outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
        />
        {pending && <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-teal" size={14} />}
      </form>
      {open && query.trim().length >= 2 && (
        <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[rgba(16,36,72,0.12)] bg-white p-1 shadow-[0_18px_40px_-18px_rgba(16,36,72,0.35)]">
          {rows.map((row) => (
            <Link key={row.id} href={row.href} role="option" onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-teal-soft/70">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{row.title}</span><span className="block truncate text-xs text-ink-3">{row.detail}</span></span>
              <span className="chip chip-teal shrink-0">{row.type}</span>
            </Link>
          ))}
          {!pending && results && rows.length === 0 && <p className="px-3 py-3 text-sm text-ink-3">No matching records.</p>}
          <button type="button" onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query.trim())}`); }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-teal-dim hover:bg-teal-soft/70">View all results for “{query.trim()}”</button>
        </div>
      )}
    </div>
  );
}
