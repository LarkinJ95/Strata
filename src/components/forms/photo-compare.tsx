"use client";

import { useState } from "react";
import { fileUrl } from "@/lib/files";

export function PhotoCompare({
  photos,
}: {
  photos: { id: string; storageKey: string; label: string }[];
}) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(Math.min(1, photos.length - 1));
  if (photos.length < 2) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Compare photographs</div>
      <div className="grid gap-3 md:grid-cols-2">
        {[a, b].map((idx, i) => (
          <div key={i}>
            <select
              className="mb-2 w-full rounded-lg border border-[rgba(16,36,72,0.1)] bg-white px-2 py-1 text-xs"
              value={idx}
              onChange={(e) => (i === 0 ? setA(Number(e.target.value)) : setB(Number(e.target.value)))}
            >
              {photos.map((p, n) => (
                <option key={p.id} value={n}>{p.label}</option>
              ))}
            </select>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(photos[idx].storageKey)} alt="" className="h-48 w-full rounded-xl object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
