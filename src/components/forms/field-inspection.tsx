"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { collectInspectionItemSample, saveInspectionItem } from "@/actions/mutations";
import { fileUrl } from "@/lib/files";
import { readStoredSession } from "@/lib/session-client";
import { requiresFieldSample } from "@/lib/inspection-rules";
import { cn, conditionTone, worstCondition } from "@/lib/utils";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { PhotoUpload } from "@/components/forms/photo-upload";
import { SubmitInspectionForm } from "@/components/forms/actions-ui";
import { NewMaterialInline } from "@/components/forms/new-material";

const CONDITIONS = [
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "needs_repair", label: "Needs repair" },
  { id: "damaged", label: "Damaged" },
  { id: "significantly_damaged", label: "Significantly damaged" },
  { id: "removed", label: "Removed" },
  { id: "inaccessible", label: "Inaccessible" },
];
const LABELS = [
  { id: "good", label: "Good" },
  { id: "replaced", label: "Replaced" },
  { id: "missing", label: "Missing" },
  { id: "unable_to_replace", label: "Could not replace" },
];

type Item = {
  id: string;
  inventoryId: string;
  code: string;
  material: string;
  floor: string | null;
  room: string | null;
  location: string | null;
  qty: number | null;
  unit: string;
  acm: string;
  previousCondition: string | null;
  currentCondition: string | null;
  previousLabel: string | null;
  currentLabel: string | null;
  notes: string | null;
  inspected: boolean;
  sampleCollected: boolean;
  photo: string | null;
  quantityObserved?: number | null;
  materialRemoved?: boolean;
  removedQuantity?: number | null;
};

/** An item counts as finished only once any lab confirmation it triggered has been collected. */
function itemComplete(item: Item) {
  return item.inspected && (!requiresFieldSample(item.acm, item.currentCondition) || item.sampleCollected);
}

function sampleOutstanding(item: Item) {
  return requiresFieldSample(item.acm, item.currentCondition) && !item.sampleCollected;
}

/** "Room 10" must sort after "Room 9", so compare digit runs numerically. */
function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

type Room = {
  key: string;
  floor: string;
  room: string;
  items: Item[];
};

function groupRooms(items: Item[]): Room[] {
  const map = new Map<string, Room>();
  for (const item of items) {
    const floor = item.floor?.trim() || "Unassigned floor";
    const room = item.room?.trim() || "Unassigned room";
    const key = `${floor} :: ${room}`;
    const existing = map.get(key);
    if (existing) existing.items.push(item);
    else map.set(key, { key, floor, room, items: [item] });
  }
  return [...map.values()].sort((a, b) => naturalCompare(a.floor, b.floor) || naturalCompare(a.room, b.room));
}

/**
 * A room is colour-coded by the worst condition recorded in it, but only once
 * every material in it is finished. A partly-swept room stays neutral so that
 * green always means "done, and nothing wrong here".
 */
function roomStatus(room: Room) {
  const done = room.items.filter(itemComplete).length;
  const total = room.items.length;
  const complete = done === total;
  const pendingSamples = room.items.filter(sampleOutstanding).length;
  const worst = worstCondition(room.items.map((i) => i.currentCondition).filter((c): c is string => Boolean(c)));
  const tone = !complete
    ? done === 0
      ? "untouched"
      : "partial"
    : pendingSamples > 0
      ? "warn"
      : conditionTone(worst ?? "");
  return { done, total, complete, pendingSamples, worst, tone };
}

const ROOM_CARD: Record<string, string> = {
  untouched: "border-[rgba(16,36,72,0.12)] bg-white",
  partial: "border-[#c7d7fb] bg-[#eef4ff]",
  ok: "border-[#b7e4c7] bg-[#e8f8ef]",
  fair: "border-[#c7d7fb] bg-[#eef4ff]",
  warn: "border-[#f0d29a] bg-[#fff4e0]",
  danger: "border-[#f4c2c0] bg-[#fdecec]",
  removed: "border-[#d4dae3] bg-[#eef1f5]",
  muted: "border-[#d4dae3] bg-[#eef1f5]",
};

const ROOM_DOT: Record<string, string> = {
  untouched: "bg-[#cbd5e1]",
  partial: "bg-[#2563eb]",
  ok: "bg-[#17a34a]",
  fair: "bg-[#2563eb]",
  warn: "bg-[#d97706]",
  danger: "bg-[#dc2626]",
  removed: "bg-[#94a3b8]",
  muted: "bg-[#94a3b8]",
};

export function FieldInspection({
  inspectionId,
  building,
  items,
  completion,
}: {
  inspectionId: string;
  building: { id: string; name: string; number: string; photoPolicy: string; photoMessage: string | null; client: string };
  items: Item[];
  completion: number;
}) {
  const [local, setLocal] = useState(items);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState("");
  const [sampleMessage, setSampleMessage] = useState("");
  const [samplePending, setSamplePending] = useState(false);

  const rooms = useMemo(() => groupRooms(local), [local]);
  const done = local.filter(itemComplete).length;
  const pct = local.length ? Math.round((done / local.length) * 100) : completion;

  const activeRoom = roomKey ? rooms.find((r) => r.key === roomKey) ?? null : null;
  const openItem = openItemId ? local.find((i) => i.id === openItemId) ?? null : null;

  function patch(target: Item, p: Partial<Item>) {
    const next = { ...target, ...p };
    setLocal((arr) => arr.map((x) => (x.id === target.id ? next : x)));
    start(async () => {
      await saveInspectionItem({
        itemId: target.id,
        currentCondition: next.currentCondition ?? undefined,
        currentLabel: next.currentLabel ?? undefined,
        notes: next.notes ?? undefined,
        quantityObserved: next.quantityObserved,
        materialRemoved: next.materialRemoved,
        removedQuantity: next.removedQuantity,
      });
      setSaved("Autosaved");
      setTimeout(() => setSaved(""), 1200);
    });
  }

  const visibleRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (room) =>
        `${room.floor} ${room.room}`.toLowerCase().includes(q) ||
        room.items.some((i) => `${i.code} ${i.material} ${i.location ?? ""}`.toLowerCase().includes(q))
    );
  }, [rooms, query]);

  if (!local.length) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-semibold">No inventory on this inspection</h1>
      </div>
    );
  }

  const header = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-teal">{building.client}</div>
        <h1 className="truncate font-display text-xl font-semibold">
          {building.number} &middot; {building.name}
        </h1>
      </div>
      <Link href={`/inspections/${inspectionId}`} className="btn btn-ghost shrink-0 text-xs">
        Exit field mode
      </Link>
    </div>
  );

  const photoBanner = building.photoMessage ? (
    <div className="mb-4 rounded-xl bg-[#fdecec] px-4 py-3 text-center text-sm font-bold tracking-wide text-[#b42318]">
      {building.photoMessage}
    </div>
  ) : null;

  // ---------------------------------------------------------------- item view
  if (openItem) {
    const item = openItem;
    const needsPhoto =
      ["damaged", "significantly_damaged", "needs_repair"].includes(item.currentCondition || "") &&
      building.photoPolicy !== "prohibited";
    const needsSample = sampleOutstanding(item);
    return (
      <div className="mx-auto max-w-3xl pb-16">
        {header}
        {photoBanner}
        <button className="btn btn-ghost mb-4" onClick={() => setOpenItemId(null)}>
          &larr; Back to {item.room?.trim() || "room"}
        </button>

        <div className="panel rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mono-id text-teal-dim">{item.code}</div>
              <div className="font-display text-2xl font-semibold leading-tight">{item.material}</div>
              <div className="mt-1 text-sm text-ink-3">
                {item.floor} &middot; {item.room} &middot; {item.location}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AcmChip value={item.acm} />
                <span className="chip chip-muted">
                  {item.qty} {item.unit}
                </span>
                {item.previousCondition && (
                  <span className="text-xs text-ink-3">
                    Previously <ConditionChip value={item.previousCondition} />
                  </span>
                )}
              </div>
            </div>
            {item.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(item.photo)} alt="" className="h-28 w-36 rounded-xl object-cover" />
            )}
          </div>

          <ConditionPicker item={item} onPick={(id) => patch(item, { currentCondition: id, inspected: true })} />

          {item.currentCondition && item.previousCondition && item.currentCondition !== item.previousCondition && (
            <div className="mt-3 rounded-xl bg-[#fff4e0] px-3 py-2 text-sm text-status-attention">
              {item.previousCondition.replaceAll("_", " ")} &rarr; {item.currentCondition.replaceAll("_", " ")}
              {["damaged", "significantly_damaged", "needs_repair"].includes(item.currentCondition) &&
                " - repair will be suggested at submit"}
            </div>
          )}

          {needsSample && (
            <div className="mt-4 rounded-xl border border-[#efb3a8] bg-[#fff0ed] p-4">
              <div className="font-semibold text-[#a23725]">Field sample required before this item is complete</div>
              <p className="mt-1 text-sm text-ink-3">
                This material is {item.acm === "pacm" ? "PACM" : "assumed ACM"} and its condition requires laboratory
                confirmation.
              </p>
              <button
                className="btn btn-primary mt-3"
                disabled={samplePending || pending}
                onClick={async () => {
                  setSamplePending(true);
                  setSampleMessage("");
                  try {
                    const result = await collectInspectionItemSample(item.id);
                    setLocal((values) =>
                      values.map((value) => (value.id === item.id ? { ...value, sampleCollected: true } : value))
                    );
                    setSampleMessage(`Sample ${result.sampleNumber} recorded and linked.`);
                  } catch (error) {
                    setSampleMessage(error instanceof Error ? error.message : "Could not record the sample.");
                  } finally {
                    setSamplePending(false);
                  }
                }}
              >
                {samplePending ? "Recording sample..." : "Collect required sample"}
              </button>
              {sampleMessage && (
                <div role="status" className="mt-2 text-sm font-medium">
                  {sampleMessage}
                </div>
              )}
            </div>
          )}
          {!needsSample && item.sampleCollected && (
            <div className="mt-4 rounded-xl border border-[#9bd0bc] bg-[#edf9f3] p-4">
              <div className="font-semibold text-[#176b4d]">Required field sample collected</div>
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="field">
              <span>Qty observed</span>
              <input
                type="number"
                value={item.quantityObserved ?? ""}
                onChange={(e) => patch(item, { quantityObserved: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
            <label className="field">
              <span>Removed quantity</span>
              <input
                type="number"
                disabled={!item.materialRemoved}
                value={item.removedQuantity ?? ""}
                onChange={(e) => patch(item, { removedQuantity: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
            <label className="field">
              <span>Removed</span>
              <select
                value={item.materialRemoved ? "yes" : "no"}
                onChange={(e) => patch(item, { materialRemoved: e.target.value === "yes" })}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </div>

          <LabelPicker item={item} onPick={(id) => patch(item, { currentLabel: id })} />

          <div className="field mt-6">
            <label>Notes</label>
            <textarea
              rows={3}
              value={item.notes ?? ""}
              onChange={(e) => patch(item, { notes: e.target.value })}
              placeholder="Field observations"
            />
          </div>

          {needsPhoto && (
            <div className="mt-4 rounded-xl border border-[#f0d29a] bg-[#fff4e0] p-3">
              <div className="mb-2 text-sm font-semibold text-[#9a5808]">Photograph required for this condition change</div>
              <PhotoUpload buildingId={building.id} recordType="inventory" recordId={item.inventoryId} />
            </div>
          )}
          {!needsPhoto && building.photoPolicy !== "prohibited" && (
            <div className="mt-4">
              <PhotoUpload buildingId={building.id} recordType="inventory" recordId={item.inventoryId} />
            </div>
          )}

          <button className="btn btn-primary btn-lg mt-6 w-full" onClick={() => setOpenItemId(null)}>
            Done with this material
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- room view
  if (activeRoom) {
    const status = roomStatus(activeRoom);
    return (
      <div className="mx-auto max-w-3xl pb-16">
        {header}
        {photoBanner}
        <button className="btn btn-ghost mb-4" onClick={() => setRoomKey(null)}>
          &larr; All rooms
        </button>

        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-3">{activeRoom.floor}</div>
          <h2 className="font-display text-2xl font-semibold">{activeRoom.room}</h2>
          <div className="mt-1 text-sm text-ink-3">
            {status.done} of {status.total} inspected
            {status.pendingSamples > 0 &&
              ` - ${status.pendingSamples} sample${status.pendingSamples === 1 ? "" : "s"} outstanding`}
          </div>
        </div>

        <div className="grid gap-3">
          {activeRoom.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "panel rounded-2xl border p-4",
                itemComplete(item) ? "border-[#b7e4c7]" : "border-[rgba(16,36,72,0.1)]"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mono-id text-teal-dim">{item.code}</div>
                  <div className="font-display text-lg font-semibold leading-tight">{item.material}</div>
                  {item.location && <div className="mt-0.5 text-xs text-ink-3">{item.location}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <AcmChip value={item.acm} />
                    {itemComplete(item) && <span className="chip chip-ok">Done</span>}
                  </div>
                  <MaterialCamera
                    item={item}
                    buildingId={building.id}
                    disabled={building.photoPolicy === "prohibited"}
                    onStored={(storageKey) =>
                      setLocal((values) => values.map((v) => (v.id === item.id ? { ...v, photo: storageKey } : v)))
                    }
                  />
                </div>
              </div>

              {item.previousCondition && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span>Previously</span>
                  <ConditionChip value={item.previousCondition} />
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => patch(item, { currentCondition: item.previousCondition, inspected: true })}
                  >
                    Same as last
                  </button>
                </div>
              )}

              <ConditionPicker item={item} compact onPick={(id) => patch(item, { currentCondition: id, inspected: true })} />
              <LabelPicker item={item} compact onPick={(id) => patch(item, { currentLabel: id })} />

              {sampleOutstanding(item) && (
                <div className="mt-3 rounded-lg border border-[#efb3a8] bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#a23725]">
                  Field sample required - open this material to record it
                </div>
              )}

              <button className="btn btn-ghost mt-3 w-full text-xs" onClick={() => setOpenItemId(item.id)}>
                Open material - qty, notes, photo{sampleOutstanding(item) ? ", sample" : ""}
              </button>
            </div>
          ))}
        </div>

        <button className="btn btn-primary btn-lg mt-6 w-full" onClick={() => setRoomKey(null)}>
          {status.complete ? "Room complete - back to rooms" : "Back to rooms"}
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------- rooms view
  return (
    <div className="mx-auto max-w-3xl pb-16">
      {header}
      {photoBanner}

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-ink-3">
          <span>
            {done} of {local.length} inspected
          </span>
          <span>
            {pct}% &middot; {saved || (pending ? "Saving..." : "Idle")}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-3">
          <div className="h-full bg-gradient-to-r from-teal to-teal-glow" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <input
        className="mb-4 w-full"
        placeholder="Search room, material, or code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleRooms.map((room) => {
          const status = roomStatus(room);
          return (
            <button
              key={room.key}
              onClick={() => setRoomKey(room.key)}
              className={cn(
                "rounded-2xl border p-4 text-left transition hover:shadow-sm",
                ROOM_CARD[status.tone] ?? ROOM_CARD.untouched
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-ink-3">{room.floor}</div>
                  <div className="truncate font-display text-lg font-semibold">{room.room}</div>
                </div>
                <span
                  className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", ROOM_DOT[status.tone] ?? ROOM_DOT.untouched)}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="font-mono text-sm">
                  {status.done}/{status.total} inspected
                </span>
                {status.complete && status.worst ? <ConditionChip value={status.worst} /> : null}
              </div>
              {status.pendingSamples > 0 && (
                <div className="mt-2 text-xs font-semibold text-[#a23725]">
                  {status.pendingSamples} sample{status.pendingSamples === 1 ? "" : "s"} outstanding
                </div>
              )}
            </button>
          );
        })}
      </div>
      {!visibleRooms.length && <div className="panel rounded-2xl p-5 text-sm text-ink-3">No rooms match that search.</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="panel rounded-2xl p-4">
          <div className="mb-2 font-display font-semibold">New suspect material</div>
          <NewMaterialInline buildingId={building.id} inspectionId={inspectionId} />
        </div>
        <div className="panel rounded-2xl p-4">
          <div className="mb-2 font-display font-semibold">Sign &amp; submit</div>
          <SubmitInspectionForm inspectionId={inspectionId} />
        </div>
      </div>
    </div>
  );
}

/**
 * One-tap capture straight from the material card. Sends `primaryPhoto=auto` so
 * the first photo an item receives becomes its thumbnail, which is what proves
 * to the inspector that the shot actually attached to this material.
 */
function MaterialCamera({
  item,
  buildingId,
  disabled,
  onStored,
}: {
  item: Item;
  buildingId: string;
  disabled?: boolean;
  onStored: (storageKey: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (disabled) return null;

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("buildingId", buildingId);
      body.set("recordType", "inventory");
      body.set("recordId", item.inventoryId);
      body.set("category", "condition");
      body.set("caption", `${item.code} ${item.material}`);
      body.set("primaryPhoto", "auto");
      const token = readStoredSession();
      const response = await fetch(`/api/buildings/${buildingId}/photos`, {
        method: "POST",
        body,
        headers: token ? { "x-strata-session": token } : undefined,
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; photo?: { id: string; storageKey: string } }
        | null;
      if (!response.ok || !payload?.photo) throw new Error(payload?.error || "Could not store photograph.");
      onStored(payload.photo.storageKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not store photograph.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="flex items-center gap-2">
        {item.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(item.photo)} alt="" className="h-9 w-9 rounded-lg object-cover" />
        )}
        <button
          type="button"
          aria-label={item.photo ? `Add another photo of ${item.material}` : `Take a photo of ${item.material}`}
          className="btn btn-ghost h-9 w-9 !p-0"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      </div>
      {error && <span className="max-w-[9rem] text-right text-[10px] font-semibold text-status-action">{error}</span>}
    </div>
  );
}

function ConditionPicker({ item, onPick, compact }: { item: Item; onPick: (id: string) => void; compact?: boolean }) {
  return (
    <div className={compact ? "mt-3" : "mt-6"}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Condition</div>
      <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
        {CONDITIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className={cn(compact ? "btn text-xs" : "btn btn-lg", item.currentCondition === c.id ? "btn-primary" : "btn-ghost")}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LabelPicker({ item, onPick, compact }: { item: Item; onPick: (id: string) => void; compact?: boolean }) {
  return (
    <div className={compact ? "mt-3" : "mt-6"}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Labeling</div>
      <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 md:grid-cols-4")}>
        {LABELS.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className={cn(compact ? "btn text-xs" : "btn btn-lg", item.currentLabel === c.id ? "btn-primary" : "btn-ghost")}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
