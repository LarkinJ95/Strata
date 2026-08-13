# STRATA — Inspection forms: field mode + historical entry

Implementation spec for an AI coding agent. Companion to `docs/ux-redesign-brief.md`.
Annotated mockups: https://claude.ai/code/artifact/edd0dd19-1413-494c-891b-9046bbe54af9

## The problem in one line

Every inspection currently goes through `startInspection()` → `/inspections/[id]/field` → one material at a
time → `submitInspection()`. That path hardcodes "now" in five places and is shaped for a phone in a boiler
room. Entering a paper survey from 2019 through it **corrupts current data** and takes 412 taps.

Split into two modes:

| | Field mode (existing, improved) | Historical entry (new) |
|---|---|---|
| When | Inspection is happening now | Inspection already happened |
| Device | Phone, one-handed, poor signal | Desk, keyboard, a scanned document |
| Shape | One material at a time, navigable | Whole building in one grid |
| Route | `/inspections/[id]/field` | `/inspections/new/historical`, `/inspections/[id]/edit` |
| Writes | `in_progress` → `completed`, dated now | `completed` directly, dated in the past |
| Current state | Always updates inventory + building dates | **Only if it is the newest record** |

---

# PART A — Backend correctness (do this first; both forms depend on it)

## A1. `submitInspection` resets the surveillance clock

`src/actions/mutations.ts`

```ts
await db.building.update({
  where: { id: insp.buildingId },
  data: {
    lastInspectionAt: new Date(),                                        // ← always "now"
    nextInspectionAt: new Date(Date.now() + (insp.building.inspectionIntervalDays || 365) * 86400000),
  },
});
```

A March 2019 survey entered today makes the building read as freshly inspected and not due until 2027. The
compliance queue goes silent on a building that is years overdue.

**Rule.** Derive from the inspection's own performed date, and only move the building forward:

```ts
const performedAt = insp.completedAt ?? new Date();
if (!insp.building.lastInspectionAt || performedAt > insp.building.lastInspectionAt) {
  await db.building.update({
    where: { id: insp.buildingId },
    data: {
      lastInspectionAt: performedAt,
      nextInspectionAt: new Date(performedAt.getTime() + (insp.building.inspectionIntervalDays || 365) * 86400000),
    },
  });
}
```

## A2. `submitInspection` overwrites current condition regardless of date

Same function pushes each item's `currentCondition` onto `InventoryItem.condition` unconditionally, so
whichever inspection was *keyed in* last wins rather than whichever *happened* last. A backfilled 2019 "Good"
silently replaces a 2026 "Significantly damaged".

**Rule.** Per material, apply to `InventoryItem` only when this inspection is the newest completed inspection
that recorded a condition for it:

```ts
const newerExists = await db.inspectionItem.findFirst({
  where: {
    inventoryItemId: inv.id,
    inspected: true,
    inspectionId: { not: inspectionId },
    inspection: { status: "completed", completedAt: { gt: performedAt } },
  },
  select: { id: true },
});

// Always write history (dated correctly). Only mutate current state when nothing newer exists.
await db.inventoryConditionHistory.create({
  data: { …, changedAt: performedAt },
});
if (!newerExists) {
  await db.inventoryItem.update({ where: { id: inv.id }, data: { condition: item.currentCondition, … } });
}
```

`InventoryConditionHistory.changedAt` and `InventoryLabelHistory` equivalents are `@default(now())` — pass
`changedAt` explicitly, do not rely on the default.

## A3. Every timestamp is hardcoded to now

| function | hardcoded |
|---|---|
| `startInspection` | `scheduledDate: new Date()`, `startedAt: new Date()`, `inspectorId: user.id`, `status: "in_progress"` |
| `saveInspectionItem` | `inspectedAt: new Date()` |
| `submitInspection` | `completedAt`, `signedAt`, `Signature.signedAt`, both history `changedAt` defaults |

**Change.** Thread an optional `performedAt: Date` (and `inspectorName: string` for non-user inspectors)
through all three. Default to `new Date()` so existing call sites are unaffected.

## A4. Duplicate guard blocks legitimate backfill

`startInspection` throws when an inspection of the same type is `draft | in_progress | submitted`. Correct for
live work. Historical entry creates a `completed` record and must not hit this guard — implement it as a
separate action rather than adding a flag to `startInspection`.

## A5. `photosSatisfied` is written by nothing

`InspectionItem.photoRequired` is set correctly by `saveInspectionItem` for damaged/removed conditions, but
`photosSatisfied` is never written and `submitInspection` never checks it. The field-mode "photograph
required" panel is decorative.

**Change.** Set `photosSatisfied` when a `PhotoLink` exists for that inventory item created after the
inspection started; block submit when any item has `photoRequired && !photosSatisfied` (unless
`building.photoPolicy === "prohibited"`).

## A6. `previousInspectionId` is never populated

The column exists on `Inspection` and nothing writes it. Set it on both creation paths to the most recent
completed inspection for that building **before** this one's date. Backfilling out of order should re-link
affected neighbours.

---

# PART B — New: historical inspection entry

## B1. Server action

New file or append to `src/actions/mutations.ts`:

```ts
export async function saveHistoricalInspection(input: {
  inspectionId?: string;              // present when editing a draft
  buildingId: string;
  inspectionType: string;
  performedAt: Date;                  // required
  inspectorName: string;              // free text — may not be a User
  inspectorId?: string;               // set when it maps to a real user
  accreditationNumber?: string;
  findings?: string;
  notes?: string;
  sourceDocumentId?: string;          // uploaded scan, stored as a Document
  status: "draft" | "completed";
  items: Array<{
    inventoryItemId: string;
    currentCondition?: string;        // omit = not inspected
    currentLabel?: string;
    quantityObserved?: number;
    materialRemoved?: boolean;
    removedQuantity?: number;
    notes?: string;
  }>;
}): Promise<{ id: string; applied: number; historyOnly: number }>
```

Behaviour:

1. Permission: `can(user, "inspections.perform")`. Recording a historical inspection someone else performed is
   a records task — do not require `inspections.approve`.
2. Validate `performedAt`: reject future dates; warn (do not block) if before `building.yearConstructed`.
3. Create/update the `Inspection` with `scheduledDate = startedAt = completedAt = signedAt = performedAt`,
   `status`, `inspectorId` (nullable), `completionPct` = filled ÷ scoped.
4. Create `InspectionItem` rows **only** for materials with at least one value. `previousCondition` =
   the condition as of `performedAt` — resolve from `InventoryConditionHistory` (latest row with
   `changedAt <= performedAt`), falling back to nothing. Do **not** use today's `InventoryItem.condition`.
5. `inspectedAt = performedAt` on every item.
6. Apply the A2 rule per material: always write history at `performedAt`; mutate `InventoryItem` only when no
   newer completed inspection recorded that material.
7. Apply the A1 rule for building dates.
8. `Signature`: `signerName = inspectorName`, `signedAt = performedAt`,
   `meaning: "Historical entry"`, `userId = user.id` (who keyed it in — keep the audit trail honest),
   `signatureData` = the typed name.
9. `activity()` with `title: "Historical inspection recorded"` and the performed date in the detail;
   `audit()` with `action: "inspection.backfill"`.
10. Return counts so the UI can report "148 materials recorded · 12 updated current condition · 136 history only".

**D1 constraint.** Do not send 289 items in one `createMany` or one transaction with a large `IN` clause —
batch in chunks of ~50, mirroring the batching already used in `src/app/(app)/quality/page.tsx`.

## B2. Page — `src/app/(app)/inspections/new/historical/page.tsx`

Server component: session check, load buildings in scope (`buildingWhere(user)`), then render the client grid.
When `?building=` is present, load that building's materials server-side and pass them down.

Materials in scope default: `createdAt <= performedAt` — backfilling a 2019 survey must not list a material
discovered in 2024. Provide an "include all materials" override in the scope selector. The count is shown in
the header field (`Existing at date · 289`).

## B3. Component — `src/components/forms/historical-inspection.tsx` (`"use client"`)

### Header strip (set once)

Two rows in a `Panel`, 6-column grid:

| field | notes |
|---|---|
| Building | select, disabled once rows are edited |
| Inspection type | select, same options as `AddInspectionControl` |
| Date performed | date input, **required**, drives everything |
| Inspector (as recorded) | free text with typeahead over org users; free text wins |
| Accreditation # | free text |
| Source document | file upload → `Document` linked to the inspection (reuse `DocumentUpload`) |
| Findings / notes as written | text |
| Materials in scope | select: "Existing at date (n)" / "All materials (n)" |

### Disclosure banner (required — this is the core feature)

Above the form, recomputed whenever `performedAt` changes:

> **Historical record.** Dated 14 Mar 2019 — 5 completed inspections exist after this date, so current
> material conditions and the surveillance schedule will not change. Condition history is written at the 2019
> date.

When the date is newer than every existing inspection, say the opposite explicitly: *"This is the most recent
inspection on record — saving will update current material conditions and the building's inspection dates."*
The user must never be guessing which of the two is about to happen.

### Bulk toolbar

Sticky under the header: selection count · `Set all to Good` · `Set selected to ▾` · `Copy previous
inspection` (fills each row from the prior completed inspection's values) · `Clear selected` · filters (Floor,
Functional area, ACM only) · right-aligned progress (`243 of 289 filled · 46 left blank`).

### Grid

Columns: checkbox · ID · Material · Location · On record then · **Condition** · Label · Qty observed ·
Removed · Notes. Grouped by floor → functional area with a group header row.

Interaction requirements:

- **Keyboard first.** Arrow keys move the active cell; `1`–`7` set condition by severity order (Good, Fair,
  Needs repair, Damaged, Significantly damaged, Removed, Inaccessible); `Enter` moves down; `Tab` moves right;
  `Esc` clears the cell. Show the digit as a hint in the header.
- **Paste.** `⌘V`/`Ctrl+V` on the grid accepts a two-column TSV block (`inventoryCode`, `condition`) and maps
  rows by code. Unmatched codes are collected and shown in a review list — never silently dropped. Accept
  common condition spellings ("sig damaged", "significantly damaged", "S/D").
- **Blank is valid.** An empty row = not inspected, writes nothing, is not a validation error. State this
  under the grid.
- **Local state only.** No autosave-per-cell. One `Save draft` and one `Save historical inspection`. Field
  mode autosaves because connectivity is unreliable; this form is at a desk and per-cell round trips would
  make it slower than paper.
- Virtualise or paginate above ~300 rows.

### Footer

`+ Suspect material found on this inspection` (creates a `SuspectMaterial` against the inspection) ·
blank-row explainer · `Save draft` · `Save historical inspection`.

## B4. Edit an existing inspection — `/inspections/[id]/edit`

Same component, loaded with the inspection's saved values. Rules:

- `draft` / `in_progress` → fully editable.
- `completed` → editable only with `inspections.approve`; every change writes an `AuditEvent` with
  `previousValue`; show a "Editing a completed record" warning banner.
- Changing `performedAt` on a completed inspection re-runs the A1/A2 evaluation for every material — including
  potentially *reverting* a current condition that this inspection had previously set. Implement as
  "recompute current state for affected materials from history" rather than incremental patching.
- Never hard-delete `InspectionItem` rows on edit; setting a row back to blank clears the values and sets
  `inspected: false`.

---

# PART C — Field mode improvements

`src/components/forms/field-inspection.tsx` (212 lines, single carousel).

## C1. Route sheet (highest impact)

Today navigation is Previous/Next only — reaching material 300 of 412 takes 299 taps. Add a bottom sheet
opened from the header:

- Search over code, material description, and room.
- Filter tabs: `Route` · `Remaining` · `Flagged` · `ACM only`.
- Grouped by floor → functional area, each group showing a progress bar and `n/m`.
- Row = tick state (done / flagged / untouched), material name, code + current selection.
- Tap a row to jump; the current item is highlighted.
- Per-group **"Mark all same"** — sets every untouched item in the group to its `previousCondition`, with an
  undo toast (`sonner` is already installed).

Groups come from `functionalAreaId` (now a real relation — see `docs/ux-redesign-brief.md` task 5) falling
back to `floor` / `room`.

## C2. "Same as last inspection" per item

The dominant outcome on a surveillance visit is "unchanged", and it currently costs exactly as much as
recording damage. Add a `✓ Same` button in the previous-condition row: sets
`currentCondition = previousCondition`, `inspected = true`, advances to the next item.

## C3. Show the change as a delta

When `currentCondition !== previousCondition`, render `Good → Significantly damaged` with severity colour, and
state the consequence ("repair will be suggested at submit") when severity increases.

## C4. Enforce the photo requirement

Depends on A5. When `photoRequired && !photosSatisfied`, the item shows a blocking badge, the route-sheet row
shows the amber tick, and the submit button is disabled with its blockers listed
(`Sign & submit · 2 blockers`). Bypass entirely when `building.photoPolicy === "prohibited"`.

## C5. Offline queue

Every condition tap currently fires a server action; inspections happen in basements. Buffer writes in
IndexedDB (or `localStorage` for simplicity), flush on `online`, and show a pending count
(`Offline — 6 changes queued`). `saveInspectionItem` is already idempotent per item, so replay is safe.

## C6. Debounce notes

`patch({ notes })` fires on every keystroke → one server action per character. Debounce to 500ms and keep
local state authoritative between flushes.

## C7. Surface the fields that already exist

`quantityObserved`, `materialRemoved` and `removedQuantity` are in the schema **and** in
`saveInspectionItem`'s signature, but no UI ever sends them. Add a compact three-up row (Qty observed /
Removed / Label) under the condition grid.

## C8. Progress and context

Split the progress bar into inspected (teal) and flagged (amber); add a context strip showing
`LEVEL 1 › FA-104 BOILER RM · 4 of 12`. Move `Sign & submit` out of the last card and into the route sheet
footer so it is reachable at any point but never sitting under an item at 4% completion.

---

# PART D — Entry points

`src/app/(app)/inspections/page.tsx` currently shows one 40-row table mixing scheduled, in-progress and
completed, with a single `AddInspectionControl`.

```
My inspections
├── Today · Drafts · Awaiting verification      (keep the existing three cards)
├── [ Active ] [ Scheduled ] [ Completed ]      (tabs over the table)
└── Actions:
    ├── Start inspection      → in_progress, opens /field                (now)
    ├── Schedule inspection   → scheduled, future date, no field mode
    └── Add historical record → /inspections/new/historical              (before)
```

Add a `Records` column to the Completed tab showing `Historical` for inspections whose `signedAt` is
materially earlier than `createdAt`, so a reader can tell an as-performed record from a backfilled one.

`StartInspectionButton` on the building header keeps its current behaviour. **Do not** put historical entry on
the building page — it is a records task, not a field task.

---

# Order of work

1. **Part A** (A1–A6) — backend correctness. Nothing else is safe to build first; A1 and A2 are active data
   loss the moment anyone backfills.
2. **B1** — `saveHistoricalInspection`, with tests for: backfill older than existing (history only), backfill
   newer than existing (applies), out-of-order backfill, blank rows, future date rejection.
3. **B2/B3** — historical entry page and grid.
4. **C1/C2** — route sheet and "same as last", the two changes that most reduce field time.
5. **B4** — edit flow.
6. **C3–C8** — remaining field-mode work.
7. **Part D** — entry points.

## Acceptance criteria

- Backfilling an inspection dated before the newest existing one changes **zero** `InventoryItem.condition`
  values and **zero** building dates, while writing correctly-dated `InventoryConditionHistory` rows.
- Backfilling an inspection dated after the newest existing one updates both.
- Entering two historical inspections out of chronological order produces the same final state as entering
  them in order.
- A 289-material historical inspection can be completed with the keyboard alone, without a page transition.
- Field mode can jump to any material in ≤3 taps from any other material.
- Submitting a field inspection with an unsatisfied `photoRequired` item is impossible in a building where
  photography is permitted.
