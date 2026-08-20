"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { createSuspectMaterial } from "@/actions/mutations";
import { uploadCapture } from "@/lib/photo-capture";
import { MATERIAL_CATEGORIES, UNITS } from "@/lib/utils";

const NEW = "__new__";

const CONDITIONS = ["good", "fair", "needs_repair", "damaged", "significantly_damaged"];
const FRIABILITY = ["friable", "non_friable", "unknown"];
const ACTIONS = ["Collect sample now", "Assume ACM", "Schedule sampling", "Add provisional inventory record"];

export type CreatedMaterial = Awaited<ReturnType<typeof createSuspectMaterial>>;

/**
 * Adds a material discovered mid-inspection. Floor and room are pickers over
 * what the building already uses, because free text is how "2nd", "2nd Fl", and
 * "Second" end up as three different rooms in the same report - with an escape
 * hatch for the genuinely new space.
 */
export function NewMaterialInline({
  buildingId,
  inspectionId,
  floors = [],
  roomsByFloor = {},
  onCreated,
}: {
  buildingId: string;
  inspectionId?: string;
  floors?: string[];
  roomsByFloor?: Record<string, string[]>;
  onCreated?: (created: CreatedMaterial, photo: string | null) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [floor, setFloor] = useState(floors[0] ?? NEW);
  const [room, setRoom] = useState(NEW);
  const [newFloor, setNewFloor] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [unit, setUnit] = useState(UNITS[0]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  const rooms = useMemo(() => (floor && floor !== NEW ? roomsByFloor[floor] ?? [] : []), [floor, roomsByFloor]);

  const resolvedFloor = floor === NEW ? newFloor.trim() : floor;
  const resolvedRoom = room === NEW ? newRoom.trim() : room;

  function reset(form: HTMLFormElement) {
    form.reset();
    setPhoto(null);
    setNewRoom("");
    if (photoInput.current) photoInput.current.value = "";
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setError("");
        start(async () => {
          try {
            const created = await createSuspectMaterial({
              buildingId,
              inspectionId,
              floor: resolvedFloor,
              room: resolvedRoom,
              location: String(fd.get("location") || ""),
              material: String(fd.get("material")),
              materialCategory: String(fd.get("materialCategory") || ""),
              estimatedQty: fd.get("qty") ? Number(fd.get("qty")) : undefined,
              unit,
              condition: String(fd.get("condition") || "fair"),
              friability: String(fd.get("friability") || "unknown"),
              action: String(fd.get("action") || ACTIONS[0]),
              notes: String(fd.get("notes") || ""),
            });

            let storedPhoto: string | null = null;
            if (photo) {
              try {
                const stored = await uploadCapture({
                  file: photo,
                  buildingId,
                  inventoryId: created.id,
                  caption: `${created.inventoryCode} ${created.materialDescription}`,
                  category: "material",
                });
                storedPhoto = stored.storageKey;
              } catch (photoError) {
                // The material is already recorded; losing the photograph must
                // not read as losing the material.
                setError(photoError instanceof Error ? photoError.message : "Material saved, but the photo did not upload.");
              }
            }

            if (onCreated) {
              onCreated(created, storedPhoto);
              reset(form);
            } else {
              router.push(`/inventory/${created.id}`);
            }
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Could not add this material.");
          }
        });
      }}
    >
      <input name="material" required placeholder="Material description" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />

      <select name="materialCategory" defaultValue="Miscellaneous" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2">
        {MATERIAL_CATEGORIES.map((category) => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <select
            aria-label="Floor"
            value={floor}
            onChange={(e) => {
              setFloor(e.target.value);
              setRoom(NEW);
              setNewRoom("");
            }}
            className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2"
          >
            {floors.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value={NEW}>+ New floor...</option>
          </select>
          {floor === NEW && (
            <input
              value={newFloor}
              onChange={(e) => setNewFloor(e.target.value)}
              required
              placeholder="New floor name"
              className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2"
            />
          )}
        </div>

        <div className="grid gap-2">
          <select
            aria-label="Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2"
          >
            {rooms.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value={NEW}>+ New room...</option>
          </select>
          {room === NEW && (
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              required
              placeholder="New room name"
              className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2"
            />
          )}
        </div>
      </div>

      <input name="location" placeholder="Specific location (optional)" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />

      <div className="grid grid-cols-2 gap-2">
        <input name="qty" type="number" inputMode="decimal" min="0" step="any" placeholder="Quantity" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />
        <select
          aria-label="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2"
        >
          {UNITS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select name="condition" defaultValue="fair" aria-label="Condition" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2">
          {CONDITIONS.map((option) => (
            <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select name="friability" defaultValue="unknown" aria-label="Friability" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2">
          {FRIABILITY.map((option) => (
            <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>

      <select name="action" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2">
        {ACTIONS.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>

      <textarea name="notes" rows={2} placeholder="Notes (optional)" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => photoInput.current?.click()}
        className={`btn ${photo ? "btn-ghost border-[#b7e4c7] bg-[#e8f8ef]" : "btn-ghost"}`}
      >
        {photo ? <Check className="h-4 w-4 text-[#157347]" /> : <Camera className="h-4 w-4" />}
        {photo ? "Photo attached - tap to retake" : "Add photo"}
      </button>

      <button className="btn btn-primary" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Saving..." : "Add suspect material"}
      </button>

      {error && <span role="status" className="text-xs font-semibold text-status-action">{error}</span>}
    </form>
  );
}
