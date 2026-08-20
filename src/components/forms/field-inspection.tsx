"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, CloudOff, Loader2, Map as MapIcon, RotateCcw, X } from "lucide-react";
import { collectInspectionItemSample } from "@/actions/mutations";
import { countPending, drain, enqueue } from "@/lib/field-queue";
import { fileUrl } from "@/lib/files";
import { uploadCapture } from "@/lib/photo-capture";
import { readStoredSession } from "@/lib/session-client";
import { requiresFieldSample } from "@/lib/inspection-rules";
import { cn, conditionTone, worstCondition } from "@/lib/utils";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { PhotoUpload } from "@/components/forms/photo-upload";
import { SubmitInspectionForm } from "@/components/forms/actions-ui";
import { NewMaterialInline, type CreatedMaterial } from "@/components/forms/new-material";

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

export type FieldFloorPlan = {
  id: string;
  name: string;
  storageKey: string;
  mimeType: string;
  floor: string | null;
};

/**
 * Full-screen plan viewer. Opens over Field Mode rather than navigating away,
 * so an inspector orienting themselves mid-room keeps their place and their
 * unsynced work. Floor plans may be uploaded as PDFs or images, so both are
 * handled; a PDF gets an iframe, everything else an img.
 */
function FloorPlanViewer({
  plans,
  initialFloor,
  onClose,
}: {
  plans: FieldFloorPlan[];
  initialFloor?: string | null;
  onClose: () => void;
}) {
  // Opening from inside a room should land on that room's floor when one
  // matches, rather than making the inspector hunt for it.
  const [activeId, setActiveId] = useState(() => {
    const match = initialFloor
      ? plans.find((p) => (p.floor ?? "").trim().toLowerCase() === initialFloor.trim().toLowerCase())
      : undefined;
    return (match ?? plans[0]).id;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const active = plans.find((p) => p.id === activeId) ?? plans[0];
  const isPdf = active.mimeType === "application/pdf" || active.storageKey.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[rgba(12,19,32,0.94)]" role="dialog" aria-modal="true" aria-label="Floor plans">
      <div className="flex items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/60">Floor plan</div>
          <div className="truncate font-display text-base font-semibold text-white">{active.name}</div>
        </div>
        <a
          href={fileUrl(active.storageKey)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white"
        >
          Open full
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close floor plans"
          className="shrink-0 rounded-lg border border-white/25 p-2 text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {plans.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setActiveId(plan.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                plan.id === active.id
                  ? "border-teal bg-teal text-white"
                  : "border-white/25 bg-white/5 text-white/80"
              )}
            >
              {plan.floor ?? plan.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white/5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {isPdf ? (
          <iframe src={fileUrl(active.storageKey)} title={active.name} className="h-full min-h-[60vh] w-full rounded-lg bg-white" />
        ) : (
          // Pinch-to-zoom handles magnification; the image is shown at natural
          // width so the inspector can scroll into a dense corner of the plan.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(active.storageKey)} alt={active.name} className="mx-auto h-auto max-w-none rounded-lg bg-white" />
        )}
      </div>
    </div>
  );
}

/** Conditions that need visual evidence before the record stands up. */
const PHOTO_CONDITIONS = ["damaged", "significantly_damaged", "needs_repair"];

function photoRequired(item: Item, photoPolicy: string) {
  return photoPolicy !== "prohibited" && PHOTO_CONDITIONS.includes(item.currentCondition ?? "");
}

function photoOutstanding(item: Item, photoPolicy: string) {
  return photoRequired(item, photoPolicy) && !item.photo;
}

/**
 * Holds the screen on for the duration of Field Mode. An inspector up a ladder
 * or writing on a clipboard should not have to unlock the phone one-handed
 * between materials. The lock is dropped automatically when the tab is hidden,
 * so it is re-requested on return.
 */
function useScreenAwake() {
  useEffect(() => {
    type Sentinel = { released: boolean; release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = (await nav.wakeLock!.request("screen")) ?? null;
      } catch {
        /* Denied on low battery or by policy; the screen simply sleeps. */
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

function conditionLabel(id: string | null) {
  return CONDITIONS.find((c) => c.id === id)?.label ?? "unset";
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
function roomStatus(room: Room, photoPolicy: string) {
  const done = room.items.filter(itemComplete).length;
  // An item that has been assessed but still owes a sample is not "done", yet
  // the room has plainly been walked. Tracking that separately keeps such a
  // room out of the not-inspected band and off the "Not started" label.
  const touched = room.items.filter((i) => i.currentCondition || i.inspected).length;
  const total = room.items.length;
  const complete = done === total;
  const pendingSamples = room.items.filter(sampleOutstanding).length;
  const pendingPhotos = room.items.filter((i) => photoOutstanding(i, photoPolicy)).length;
  const worst = worstCondition(room.items.map((i) => i.currentCondition).filter((c): c is string => Boolean(c)));
  // A sample is only ever owed on a damaged / significantly damaged /
  // needs-repair material, so the condition tone is already at least "warn"
  // here. Overriding it with "warn" could only ever mask a "danger" room.
  const tone = !complete ? (touched === 0 ? "untouched" : "partial") : conditionTone(worst ?? "");
  return { done, total, touched, complete, pendingSamples, pendingPhotos, worst, tone };
}

/**
 * Work order for the rooms list: what still needs a visit rises, what is
 * finished sinks. Within a band the natural floor/room walk order is kept.
 *   0 not inspected  1 outstanding requirements  2 done with damage  3 done
 */
const DAMAGE_CONDITIONS = ["needs_repair", "damaged", "significantly_damaged"];

function roomRank(status: ReturnType<typeof roomStatus>) {
  if (status.touched === 0) return 0;
  if (!status.complete || status.pendingSamples > 0 || status.pendingPhotos > 0) return 1;
  if (status.worst && DAMAGE_CONDITIONS.includes(status.worst)) return 2;
  return 3;
}

/**
 * Status bands for the rooms list. Completed rooms collapse by default: in a
 * 100-room building they are the majority by the end of a sweep, and hiding
 * them also stops a finished room visibly reshuffling under the inspector's
 * thumb - it simply leaves the working list.
 */
const ROOM_BANDS = [
  { rank: 0, id: "untouched", label: "Not inspected", defaultOpen: true, accent: "bg-[#cbd5e1]" },
  { rank: 1, id: "outstanding", label: "Outstanding requirements", defaultOpen: true, accent: "bg-[#2563eb]" },
  { rank: 2, id: "damaged", label: "Damaged", defaultOpen: true, accent: "bg-[#d97706]" },
  { rank: 3, id: "complete", label: "Completed", defaultOpen: false, accent: "bg-[#17a34a]" },
] as const;

const MAIN_TABS = [
  { id: "rooms", label: "Rooms" },
  { id: "material", label: "New material" },
  { id: "end", label: "End inspection" },
] as const;

type MainTab = (typeof MAIN_TABS)[number]["id"];

const ROOM_ROW: Record<string, string> = {
  untouched: "border-l-[#cbd5e1] bg-white",
  partial: "border-l-[#2563eb] bg-[#f7faff]",
  ok: "border-l-[#17a34a] bg-[#f4fbf7]",
  fair: "border-l-[#2563eb] bg-[#f7faff]",
  warn: "border-l-[#d97706] bg-[#fffaf1]",
  danger: "border-l-[#dc2626] bg-[#fef6f6]",
  removed: "border-l-[#94a3b8] bg-white",
  muted: "border-l-[#94a3b8] bg-white",
};

export function FieldInspection({
  inspectionId,
  building,
  items,
  completion,
  floorPlans = [],
  buildingFloors = [],
  buildingRooms = [],
}: {
  inspectionId: string;
  building: { id: string; name: string; number: string; photoPolicy: string; photoMessage: string | null; client: string };
  items: Item[];
  completion: number;
  floorPlans?: FieldFloorPlan[];
  buildingFloors?: string[];
  buildingRooms?: { floor: string | null; room: string }[];
}) {
  const [local, setLocal] = useState(items);
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sampleMessage, setSampleMessage] = useState("");
  const [samplePending, setSamplePending] = useState(false);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [undo, setUndo] = useState<{ item: Item; label: string } | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [tab, setTab] = useState<MainTab>("rooms");
  const [openBands, setOpenBands] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ROOM_BANDS.map((band) => [band.id, band.defaultOpen]))
  );
  const router = useRouter();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScreenAwake();

  const rooms = useMemo(() => groupRooms(local), [local]);
  const done = local.filter(itemComplete).length;
  const pct = local.length ? Math.round((done / local.length) * 100) : completion;

  const outstandingSamples = local.filter(sampleOutstanding).length;
  const outstandingPhotos = local.filter((i) => photoOutstanding(i, building.photoPolicy)).length;

  const activeRoom = roomKey ? rooms.find((r) => r.key === roomKey) ?? null : null;
  const openItem = openItemId ? local.find((i) => i.id === openItemId) ?? null : null;

  const flush = useCallback(async () => {
    setSyncing(true);
    const token = readStoredSession();
    const result = await drain(async (edit) => {
      const response = await fetch(`/api/inspections/${edit.inspectionId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-strata-session": token } : {}),
        },
        body: JSON.stringify({ itemId: edit.itemId, ...edit.payload }),
      });
      // 422 means the server will never accept this record; dropping it stops
      // one bad edit from blocking every later one behind it.
      if (response.status === 422) return true;
      return response.ok;
    });
    setQueued(result.remaining);
    setSyncing(false);
    return result;
  }, []);

  // Reconcile the badge with what is actually on disk, then drain whenever the
  // radio comes back or the inspector returns to the app.
  useEffect(() => {
    let alive = true;
    void countPending().then((n) => alive && setQueued(n));
    setOnline(navigator.onLine);

    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void flush();
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    const ticker = setInterval(() => {
      if (navigator.onLine) void flush();
    }, 20000);

    if (navigator.onLine) void flush();

    return () => {
      alive = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(ticker);
    };
  }, [flush]);

  // Closing the tab with unsent work would lose it silently, which is the exact
  // failure this queue exists to prevent.
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (queued > 0) e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queued]);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const record = useCallback(
    (target: Item, p: Partial<Item>) => {
      const next = { ...target, ...p };
      setLocal((arr) => arr.map((x) => (x.id === target.id ? next : x)));
      void (async () => {
        await enqueue({
          itemId: target.id,
          inspectionId,
          updatedAt: Date.now(),
          payload: {
            currentCondition: next.currentCondition ?? undefined,
            currentLabel: next.currentLabel ?? undefined,
            notes: next.notes ?? undefined,
            quantityObserved: next.quantityObserved,
            materialRemoved: next.materialRemoved,
            removedQuantity: next.removedQuantity,
          },
        });
        setQueued(await countPending());
        if (navigator.onLine) void flush();
      })();
    },
    [inspectionId, flush]
  );

  /** Writes the edit and arms a short undo window, so one mis-tap on a ladder
   *  does not quietly overwrite a real observation. */
  const patch = useCallback(
    (target: Item, p: Partial<Item>, undoLabel?: string) => {
      if (undoLabel) {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo({ item: target, label: undoLabel });
        undoTimer.current = setTimeout(() => setUndo(null), 7000);
      }
      record(target, p);
    },
    [record]
  );

  const revert = useCallback(() => {
    if (!undo) return;
    const previous = undo.item;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    record(previous, {
      currentCondition: previous.currentCondition,
      currentLabel: previous.currentLabel,
      inspected: previous.inspected,
    });
  }, [undo, record]);

  const pendingLabel = !online
    ? `Offline${queued ? ` - ${queued} waiting` : ""}`
    : queued
      ? `${syncing ? "Syncing" : "Waiting to sync"} - ${queued}`
      : "All saved";

  const floorOptions = useMemo(() => {
    const names = new Set<string>();
    for (const name of buildingFloors) if (name.trim()) names.add(name.trim());
    for (const item of local) if (item.floor?.trim()) names.add(item.floor.trim());
    return [...names].sort(naturalCompare);
  }, [local, buildingFloors]);

  const roomsByFloor = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const room of rooms) {
      if (room.room === "Unassigned room") continue;
      (map[room.floor] ??= []).push(room.room);
    }
    // Catalogued spaces that hold no inventory are still real rooms an
    // inspector can walk into and find something in.
    for (const area of buildingRooms) {
      const key = area.floor?.trim();
      if (!key || !area.room.trim()) continue;
      (map[key] ??= []).push(area.room.trim());
    }
    for (const key of Object.keys(map)) map[key] = [...new Set(map[key])].sort(naturalCompare);
    return map;
  }, [rooms, buildingRooms]);

  const addCreated = useCallback((created: CreatedMaterial, photo: string | null) => {
    if (!created.inspectionItemId) {
      // No InspectionItem means the material exists but is not part of this
      // sweep; a refresh is the honest way to reflect that.
      router.refresh();
      return;
    }
    setLocal((arr) => [
      ...arr,
      {
        id: created.inspectionItemId!,
        inventoryId: created.id,
        code: created.inventoryCode,
        material: created.materialDescription,
        floor: created.floor,
        room: created.room,
        location: created.specificLocation,
        qty: created.currentQuantity,
        unit: created.quantityUnit,
        acm: created.acmClassification,
        previousCondition: null,
        currentCondition: null,
        previousLabel: null,
        currentLabel: null,
        notes: null,
        inspected: false,
        sampleCollected: false,
        photo,
      },
    ]);
  }, [router]);

  // `rooms` arrives in walk order (floor, then room, naturally sorted), and
  // bucketing preserves that order inside each band, so a band always reads as
  // a route through the building rather than an arbitrary pile.
  const bands = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? rooms.filter(
          (room) =>
            `${room.floor} ${room.room}`.toLowerCase().includes(q) ||
            room.items.some((i) => `${i.code} ${i.material} ${i.location ?? ""}`.toLowerCase().includes(q))
        )
      : rooms;

    const buckets = new Map<number, { room: Room; status: ReturnType<typeof roomStatus> }[]>();
    for (const room of matched) {
      const status = roomStatus(room, building.photoPolicy);
      const list = buckets.get(roomRank(status));
      if (list) list.push({ room, status });
      else buckets.set(roomRank(status), [{ room, status }]);
    }
    return ROOM_BANDS.map((band) => ({ ...band, entries: buckets.get(band.rank) ?? [] }));
  }, [rooms, query, building.photoPolicy]);

  const matchCount = bands.reduce((total, band) => total + band.entries.length, 0);
  const searching = query.trim().length > 0;

  if (!local.length) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-semibold">No inventory on this inspection</h1>
      </div>
    );
  }

  const header = (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-teal">{building.client}</div>
          <h1 className="truncate font-display text-xl font-semibold">
            {building.number} &middot; {building.name}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {floorPlans.length > 0 && (
            <button
              type="button"
              onClick={() => setPlansOpen(true)}
              className="btn btn-ghost text-xs"
              aria-label={`Open floor plan${floorPlans.length === 1 ? "" : "s"}`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Plans
            </button>
          )}
          <Link href={`/inspections/${inspectionId}`} className="btn btn-ghost text-xs">
            Exit
          </Link>
        </div>
      </div>

      {plansOpen && floorPlans.length > 0 && (
        <FloorPlanViewer plans={floorPlans} initialFloor={activeRoom?.floor} onClose={() => setPlansOpen(false)} />
      )}

      {(!online || queued > 0) && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
            online ? "border-[#c7d7fb] bg-[#eef4ff] text-[#1d4ed8]" : "border-[#f0d29a] bg-[#fff4e0] text-[#9a5808]"
          )}
          role="status"
        >
          {online ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
          <span>
            {online
              ? `Syncing ${queued} change${queued === 1 ? "" : "s"}...`
              : `No connection - ${queued} change${queued === 1 ? "" : "s"} saved on this phone`}
          </span>
          {!online && queued > 0 && (
            <button type="button" className="btn btn-ghost ml-auto text-[11px]" onClick={() => void flush()}>
              Retry
            </button>
          )}
        </div>
      )}

      {undo && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
          <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
            <span className="min-w-0 flex-1 truncate">{undo.label}</span>
            <button type="button" className="flex items-center gap-1.5 font-semibold text-teal-soft" onClick={revert}>
              <RotateCcw className="h-3.5 w-3.5" />
              Undo
            </button>
          </div>
        </div>
      )}
    </>
  );

  const photoBanner = building.photoMessage ? (
    <div className="mb-4 rounded-xl bg-[#fdecec] px-4 py-3 text-center text-sm font-bold tracking-wide text-[#b42318]">
      {building.photoMessage}
    </div>
  ) : null;

  // ---------------------------------------------------------------- item view
  if (openItem) {
    const item = openItem;
    const needsPhoto = photoRequired(item, building.photoPolicy);
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

          <ConditionPicker
            item={item}
            onPick={(id) => patch(item, { currentCondition: id, inspected: true }, `${item.code} set to ${conditionLabel(id)}`)}
          />

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
                disabled={samplePending}
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

          <LabelPicker item={item} onPick={(id) => patch(item, { currentLabel: id }, `${item.code} label set`)} />

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
    const status = roomStatus(activeRoom, building.photoPolicy);
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
            {status.pendingPhotos > 0 &&
              ` - ${status.pendingPhotos} photo${status.pendingPhotos === 1 ? "" : "s"} outstanding`}
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

              {!item.previousCondition && (
                <div className="mt-2 text-xs text-ink-3">
                  {/* No prior cycle to carry forward, so the missing "Same as
                      last" shortcut is expected rather than a fault. */}
                  <span className="chip chip-ice">New this inspection</span>
                </div>
              )}
              {item.previousCondition && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span>Previously</span>
                  <ConditionChip value={item.previousCondition} />
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() =>
                      patch(item, { currentCondition: item.previousCondition, inspected: true }, `${item.code} kept as ${conditionLabel(item.previousCondition)}`)
                    }
                  >
                    Same as last
                  </button>
                </div>
              )}

              <ConditionPicker
                item={item}
                compact
                onPick={(id) => patch(item, { currentCondition: id, inspected: true }, `${item.code} set to ${conditionLabel(id)}`)}
              />
              <LabelPicker item={item} compact onPick={(id) => patch(item, { currentLabel: id }, `${item.code} label set`)} />

              {sampleOutstanding(item) && (
                <div className="mt-3 rounded-lg border border-[#efb3a8] bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#a23725]">
                  Field sample required - open this material to record it
                </div>
              )}
              {photoOutstanding(item, building.photoPolicy) && (
                <div className="mt-3 rounded-lg border border-[#f0d29a] bg-[#fff4e0] px-3 py-2 text-xs font-semibold text-[#9a5808]">
                  Photograph required for this condition - use the camera above
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
            {pct}% &middot;{" "}
            <span className={cn(!online && "font-semibold text-status-attention", queued > 0 && online && "text-ink-2")}>
              {pendingLabel}
            </span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-3">
          <div className="h-full bg-gradient-to-r from-teal to-teal-glow" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-paper-3 p-1">
        {MAIN_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-xs font-semibold",
              tab === entry.id ? "bg-white text-ink shadow-sm" : "text-ink-3"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "rooms" && (
        <>
      <input
        className="mb-4 w-full"
        placeholder="Search room, material, or code"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="grid gap-3">
        {bands.map((band) => {
          if (!band.entries.length) return null;
          // A search should never hide a hit behind a collapsed heading.
          const open = searching || openBands[band.id];
          return (
            <div key={band.id} className="overflow-hidden rounded-2xl border border-[rgba(16,36,72,0.1)] bg-white">
              <button
                type="button"
                onClick={() => setOpenBands((prev) => ({ ...prev, [band.id]: !prev[band.id] }))}
                aria-expanded={open}
                disabled={searching}
                className="flex w-full items-center gap-2 bg-paper-2 px-3 py-2 text-left"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", band.accent)} />
                <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                  {band.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink-3">{band.entries.length}</span>
                {!searching && <ChevronDown className={cn("h-4 w-4 text-ink-3 transition-transform", !open && "-rotate-90")} />}
              </button>

              {open &&
                band.entries.map(({ room, status }, index) => {
                  const outstanding: string[] = [];
                  if (status.pendingSamples) outstanding.push(`${status.pendingSamples} sample${status.pendingSamples === 1 ? "" : "s"}`);
                  if (status.pendingPhotos) outstanding.push(`${status.pendingPhotos} photo${status.pendingPhotos === 1 ? "" : "s"}`);
                  return (
                    <button
                      key={room.key}
                      onClick={() => setRoomKey(room.key)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-l-4 px-3 py-2 text-left",
                        "border-t border-t-[rgba(16,36,72,0.07)]",
                        index === 0 && "border-t-[rgba(16,36,72,0.12)]",
                        ROOM_ROW[status.tone] ?? ROOM_ROW.untouched
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm leading-tight">
                          <span className="text-ink-3">{room.floor}</span>
                          <span className="mx-1.5 text-ink-4">&middot;</span>
                          <span className="font-display font-semibold">{room.room}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-2">
                          {status.done}/{status.total}
                        </span>
                        <span className="w-[4.75rem] shrink-0 text-right">
                          {status.complete && status.worst ? (
                            <ConditionChip value={status.worst} />
                          ) : (
                            <span className="text-[11px] text-ink-3">{status.touched === 0 ? "Not started" : "In progress"}</span>
                          )}
                        </span>
                      </div>
                      {outstanding.length > 0 && (
                        <div className="text-[11px] font-semibold text-[#a23725]">{outstanding.join(" \u00b7 ")} outstanding</div>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
      {!matchCount && <div className="panel rounded-2xl p-5 text-sm text-ink-3">No rooms match that search.</div>}
        </>
      )}

      {tab === "material" && (
        <div className="panel rounded-2xl p-4">
          <div className="mb-1 font-display font-semibold">New suspect material</div>
          <p className="mb-3 text-xs text-ink-3">
            Added to this inspection, so it appears in its room ready to be assessed.
          </p>
          <NewMaterialInline
            buildingId={building.id}
            inspectionId={inspectionId}
            floors={floorOptions}
            roomsByFloor={roomsByFloor}
            onCreated={(created, photo) => {
              addCreated(created, photo);
              setTab("rooms");
            }}
          />
        </div>
      )}

      {tab === "end" && (
        <div className="grid gap-4">
          <div className="panel rounded-2xl p-4">
            <div className="mb-2 font-display font-semibold">Before you finish</div>
            <ul className="grid gap-1.5 text-sm">
              <li className={cn("flex justify-between gap-3", done === local.length ? "text-[#157347]" : "text-status-attention")}>
                <span>Materials inspected</span>
                <span className="font-mono">{done}/{local.length}</span>
              </li>
              <li className={cn("flex justify-between gap-3", outstandingSamples ? "text-status-action" : "text-ink-3")}>
                <span>Samples outstanding</span>
                <span className="font-mono">{outstandingSamples}</span>
              </li>
              <li className={cn("flex justify-between gap-3", outstandingPhotos ? "text-status-attention" : "text-ink-3")}>
                <span>Photographs outstanding</span>
                <span className="font-mono">{outstandingPhotos}</span>
              </li>
              <li className={cn("flex justify-between gap-3", queued ? "text-status-attention" : "text-ink-3")}>
                <span>Changes waiting to sync</span>
                <span className="font-mono">{queued}</span>
              </li>
            </ul>
          </div>
          <div className="panel rounded-2xl p-4">
            <div className="mb-2 font-display font-semibold">Sign &amp; submit</div>
            <SubmitInspectionForm inspectionId={inspectionId} />
          </div>
        </div>
      )}
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
      const stored = await uploadCapture({
        file,
        buildingId,
        inventoryId: item.inventoryId,
        caption: `${item.code} ${item.material}`,
        category: "condition",
      });
      onStored(stored.storageKey);
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
