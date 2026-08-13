"use client";

import { useId, useMemo, useState } from "react";

type Area = { id: string; name: string; faCode: string | null; floor?: { name: string } | null };
const label = (area: Area) => [area.faCode, area.name, area.floor?.name].filter(Boolean).join(" · ");

export function FunctionalAreaSelect({ areas, initialId, initialLabel }: { areas: Area[]; initialId?: string | null; initialLabel?: string | null }) {
  const listId = useId();
  const initial = useMemo(() => areas.find((area) => area.id === initialId), [areas, initialId]);
  const [value, setValue] = useState(initial ? label(initial) : initialLabel || "");
  const [selectedId, setSelectedId] = useState(initialId || "");
  return <>
    <input type="hidden" name="functionalAreaId" value={selectedId} />
    <input name="functionalAreaSearch" list={listId} value={value} placeholder="Type to search functional areas" onChange={(event) => {
      const next = event.target.value;
      setValue(next);
      setSelectedId(areas.find((area) => label(area) === next)?.id || "");
    }} />
    <datalist id={listId}>{areas.map((area) => <option key={area.id} value={label(area)} />)}</datalist>
    <p className="mt-1 text-xs text-ink-3">Start typing to search, then choose a listed functional area.</p>
  </>;
}
