# STRATA — UI/UX redesign brief

Implementation spec for an AI coding agent. Tasks are ordered by dependency and impact.
Each task lists the files to touch, the change, and acceptance criteria.

Stack: Next 15 App Router (server components by default), Prisma + D1, Tailwind 3.4, lucide-react, sonner.
Conventions to preserve: `Panel` / `Chip` / `PageHeader` / `Kpi` / `Meta` / `SectionTitle` primitives in
`src/components/ui/primitives.tsx`; raw CSS component classes (`.chip`, `.btn`, `.bldg-tab`, `.stat-row`,
`table.data`, `.field`) in `src/app/globals.css`; server actions in `src/actions/`.

Do not introduce a component library, a CSS-in-JS runtime, or a client-side data layer. Keep pages server
components; add `"use client"` only for genuinely interactive leaves.

---

## P0 — Foundations (do these first; everything else assumes them)

### 1. Restore the Tailwind token layer

**Problem.** `tailwind.config.ts` ships `theme: { extend: {} }`, but the codebase uses custom token classes
that were never defined. Counts across `src/`:

| class | uses |
|---|---|
| `text-ink-3` | 156 |
| `font-display` | 52 |
| `bg-paper-2`, `text-teal-dim`, `bg-teal-soft`, `shadow-glow`, `text-status-*` | 93 |

Verified against build output: `.text-ink-3`, `.bg-paper-2`, `.font-display`, `.text-teal-dim` and
`.shadow-glow` produce **zero rules** in `.next/static/css/*.css`. Consequence: all secondary text renders at
full `#0c1320` (no hierarchy), Sora is loaded but never applied, and `hover:bg-paper-2` rows have no hover
state.

**File.** `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0c1320", 2: "#33415a", 3: "#6a7586" },
        paper: { DEFAULT: "#f1f5fa", 2: "#f4f7fb" },
        teal: { DEFAULT: "#0b857f", dim: "#0a5f5b", soft: "#e6f6f5" },
        status: { current: "#157347", attention: "#9a5808", action: "#b42318" },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: { glow: "0 0 0 3px rgba(12, 138, 132, 0.16)" },
    },
  },
  plugins: [],
} satisfies Config;
```

**Then:** grep for any remaining undefined utility (`text-ink-2`, `bg-teal-soft/40`, `border-ink-*`, etc.) and
either add the token or replace the class. Do not delete usages — add the tokens.

**Acceptance.** `npm run build`, then confirm `.text-ink-3{color:#6a7586}`, `.font-display`, `.bg-paper-2`,
`.text-teal-dim` and `.shadow-glow` all appear in `.next/static/css/*.css`.

---

### 2. Mobile navigation (currently there is none)

**Problem.** `src/components/layout/shell.tsx` — the `<aside>` is `hidden … lg:flex` and nothing replaces it
below 1024px. No hamburger, no bottom bar. The mobile header contains only `GlobalSearch`. Users outside
`/field` mode can reach a page but cannot leave it.

**Change.** Add a bottom tab bar for `< lg` (field-first product; prefer this over a hamburger):

- Fixed to viewport bottom, `lg:hidden`, hidden entirely when `fieldMode`.
- Height 56px + `env(safe-area-inset-bottom)` padding; same surface treatment as the sidebar
  (`bg-white/90 backdrop-blur-xl`, top hairline `rgba(16,36,72,0.08)`).
- Five items max from the same `items` array the sidebar uses (truncate to the first five); icon 20px above a
  10px label; active state uses `text-teal-dim` + a 2px teal bar at the top edge of the item.
- Add `pb-[72px] lg:pb-0` to `<main>` so content clears the bar.

**Acceptance.** At 390×844, every nav destination is reachable in one tap from any page; nothing overlaps the
last row of content; `/inspections/[id]/field` still renders chrome-free.

---

### 3. Inventory list: pagination and an honest result count

**Problem.** `src/app/(app)/inventory/page.tsx` uses `take: 200` with no count and no pager. A filtered list
that exceeds 200 looks complete and is not — unacceptable for a compliance record.

**Change.**
- Add `const total = await db.inventoryItem.count({ where })` alongside the existing `findMany`.
- Read `page` and `per` from `searchParams` (default `per=50`, allowed 25/50/100); apply `skip`/`take`.
- Render a footer inside the results `Panel`: `Showing {from}–{to} of {total} matching records` on the left,
  page controls on the right, plus a per-page selector.
- Pagination links must preserve all existing query params.

**Acceptance.** With >50 matching rows, the footer count matches `db.inventoryItem.count`, page 2 shows rows
51+, and changing a facet resets to page 1.

---

### 4. Inventory detail: stop rendering half-empty pages

**Problem.** `src/app/(app)/inventory/[id]/page.tsx` wraps everything in a fixed
`grid xl:grid-cols-[1.1fr_0.9fr]`, but **both** columns gate on the same `section` value:

- `section=photos` and `section=samples` → only the left column renders; right half is blank.
- `section=repairs` → only the right column renders; left half is blank.
- `section=documents` → both columns empty, and the documents panel renders *below* the empty grid.

**Change.** Choose the grid per section instead of gating panels inside a fixed grid:

```
status   → 2 columns  (left: current status · right: quantity summary, quick update, editor)
history  → 2 columns  (left: quantity history table · right: condition history, inspections, timeline)
photos   → 1 column
samples  → 1 column
repairs  → 1 column   (repairs and removals side by side within it on md+)
documents→ 1 column   (move the panel inside the section switch, not after it)
```

Extract each section into a small component or a `renderSection()` switch so the page reads as
`<SectionShell cols={…}>` per branch.

**Also in this file:** line 69 (the whole header) and line 166 (quantity summary) are single JSX lines of
~1,300 and ~900 characters. Break them into readable multi-line JSX or extract
`<InventoryHeader item={…} />` and `<QuantitySummary item={…} />`. No visual change intended.

**Acceptance.** Every section fills the width it is given; no section renders an empty column; the documents
section appears inside the tab body, not below it.

---

### 5. Drop the obsolete raw-SQL workarounds

**Problem.** `functionalAreaId` is now a real field **and** relation on `InventoryItem` in
`prisma/schema.prisma` (`functionalAreaId String?`, `functionalArea BuildingArea? @relation("InventoryFunctionalArea", …)`).
Three pages still fetch it with `$queryRawUnsafe` and stitch it back with a `Map`:

- `src/app/(app)/buildings/[id]/page.tsx` (~line 96)
- `src/app/(app)/inventory/[id]/page.tsx` (~line 56)
- `src/app/(app)/quality/page.tsx` (unassigned-FA query)

**Change.** Replace with normal Prisma selects — `include: { functionalArea: { select: { id: true, name: true, faCode: true } } }`
where the name is useful, or `where: { functionalAreaId: null }` for the quality query. Delete the `Map`
stitching and the `…WithArea` intermediate objects.

**Constraint.** D1 caps SQL variables per query; the existing batched/split query strategy in these files
exists for that reason. Keep the batching — only remove the raw-SQL FA workaround.

**Acceptance.** No `$queryRawUnsafe` referencing `functionalAreaId` remains; the Spaces tab and quality page
show the same data; FA **name** (not just id) is available for display.

---

## P1 — Separate reading from editing

### 6. Building page: inline editors are drowning the data

**Problem.** `src/app/(app)/buildings/[id]/page.tsx` renders write UI inline with read UI everywhere:
`BuildingEditor` inside the header panel; a `FunctionalAreaEditor` **and** a delete `<form>` on every
functional-area card; the same on every sample, paint sample, PPE item, repair and inspection card. A building
with 38 functional areas renders 38 editors and 38 delete buttons interleaved with the content.

**Change.**
- One `Edit` affordance per record (icon button, top-right of the card) that opens the existing editor in a
  drawer or toggles the card into edit mode. Reuse `Disclose` from `src/components/forms/access-field.tsx` if
  a drawer is too large a change — the requirement is that the editor is **closed and visually secondary by
  default**, not that it moves to a new container.
- Destructive actions (`deleteFloor`, `deleteFunctionalArea`, `deletePaintSample`, `deletePhoto`,
  `deleteDocument`) move behind a `⋯` overflow menu on the card; keep `ConfirmDeleteButton` as the confirm step.
- The "add" editors (`FloorEditor`, `FunctionalAreaEditor`, `PpeEditor`, `SampleEditor`, `InventoryEditor`
  with no record) become one primary button per tab, not a form pinned above the list.
- `BuildingEditor` moves out of the header panel behind the header's `Edit` button.

**Acceptance.** With `user.isClient === false`, the Spaces tab is ≤ ~40% of its current scroll height at the
same data volume, and no destructive control is visible without an explicit user action.

---

## P2 — Building page redesign

Target layout (desktop ≥1280px). All values below come from data already in the schema.

### 7. Header

```
[breadcrumb]  Clients › {client} › {facility} › {building}        ← add facility + link /buildings
┌─┬──────────────────────────────────────────────────────────────┐
│▌│ [status chip]                        [Start inspection] [Generate ▾] [Edit] [⋯] │
│▌│ {building.name}                                              │
│▌│ {facility} · {client} · {address}                            │
│▌│ #{num} · BUILT {year} · {sf} SF · {floors} FLOORS · {occupancy} · {n} MATERIALS │
│▌│ [alert pills…]                                               │
└─┴──────────────────────────────────────────────────────────────┘
```

- `▌` = 4px severity rail on the panel's left edge, coloured by `compliance.status`
  (`current` → `#157347`, `attention` → `#9a5808`, `action` → `#b42318`).
- Facts row: `font-mono`, 10.5px, `text-ink-3`, uppercase.
- **Alert pills carry age, not just count.** Today: `"3 damaged material(s)"`. Required:
  `"3 damaged ACM — oldest 41 days"`, `"Inspection overdue — 34 days"`,
  `"2 open repairs — 1 past due"`, `"6 results awaiting reconciliation"`, plus the photo-policy pill.
  Each pill links to the relevant tab/filtered list.
- Collapse the four header buttons: `Start inspection` primary, then a `Generate ▾` menu containing
  Inspection packet PDF / Management plan / Floor plans, then `Edit`, then `⋯`.

### 8. Tabs: 11 flat → 5 grouped, with counts and state

| new tab | contains (as sub-tabs) | count shown |
|---|---|---|
| Overview | Snapshot · Compliance history · Responsible parties | — |
| Materials | Inventory · Samples · Paint | inventory count, red pip if any damaged ACM |
| Spaces | (existing floor tabs) | `{floors} · {areas}` |
| Program | PPE · Repairs · Inspections | open repairs + scheduled inspections |
| Records | Photos · Documents | photos + documents |
| Activity | — | — |

- Count renders as `font-mono` 10.5px `text-ink-3` after the label; a 6px `#b42318` pip appears when the tab
  holds something needing action.
- A tab with zero records renders at reduced opacity and its body shows a proper `Empty` state with the
  relevant "add" button — never a bare sentence.
- Sub-tabs render as pill-shaped secondary controls below the tab bar (reuse the existing floor-tab pattern
  but pill-styled, not underlined, so the two levels are visually distinct).
- Rename `Floors / FA` → `Spaces`. Internal shorthand should not reach a client-visible tab.

### 9. Overview body

12-column grid, `gap-3`.

**A. "Needs attention" — `col-span-7`.** Replaces the current label/count `stat-row` lists. A ranked list of
real records, severity-sorted, each row:

```
● {title}                                                    [CTA]
  {context: classification · condition · floor · FA · age}
```

Sources, in severity order: damaged ACM/PACM items (red) → overdue inspection (red) → overdue repairs (amber)
→ open repairs (amber) → unreconciled results (blue) → inventory missing a functional area (blue). Cap at 6
rows with `+N more → queue`. Severity dot is 7px with a 3px ring (`.dot` classes already exist in
`globals.css`). Each row links to the record; the CTA links to the action (`Open repair`, `Schedule`,
`Reconcile`, `Bulk assign`).

**B. "Surveillance cycle" — `col-span-5`.** Replaces the `Inspection Status` list.

- A horizontal timeline bar: teal fill from `lastInspectionAt` to today, red diagonal-hatch overrun beyond
  `nextInspectionAt` when overdue; node markers at both dates; `6-MONTH PERIODIC` / `TODAY {date}` legend.
- Below it, rows for: survey status, management plan status, 3-year re-inspection date + days remaining,
  designated person, photography policy — each value as a `Chip` where it is a state, plain mono text where it
  is a date.

**C. "Material risk — classification × condition" — `col-span-7`.** New. A matrix, rows =
`ACM_LABELS` order (Confirmed / Assumed / PACM / Non-ACM / Unsampled), columns = Good / Fair / Damaged /
Sig. damaged / Inaccessible / Total. Cell = count, background scaled by risk (classification severity ×
condition severity), zero cells rendered as a muted em-dash. **Every non-zero cell links to
`/inventory?building={id}&acm={…}&condition={…}`.** This is the single highest-value addition on the page.

**D. "Quantity ledger & record health" — `col-span-5`.** New.

- Stacked bar of `currentQuantity` / `quantityRepaired` / `quantityRemoved` against `originalQuantity`,
  summed over ACM+PACM+assumed items, grouped by `quantityUnit` (one bar per unit; show the dominant unit
  first). Legend below with absolute numbers.
- Four thin meters: materials linked to a sample, assigned to a functional area, ACM/PACM with a photo, placed
  on a floor plan. Colour by threshold: <50% `#b42318`, <85% `#d97706`, else `#157347`.

### 10. Building page — remaining fixes

- **Inventory tab: 5 anchors per row.** Each of five `<td>`s wraps its own `<Link>` to the same href — five
  tab stops and five duplicate links per row (2,060 tab stops at 412 materials). Use one anchor on the ID cell
  plus a stretched-link pseudo-element, or a row-level click handler. Better: **delete this table and reuse
  `InventoryTable` from `src/components/records.tsx`** with `showBuilding={false}`, extended with the new
  columns from task 12.
- **Functional-area cards** should lead with a rollup — `12 materials · 3 ACM · worst: damaged` — before
  listing items, so a floor can be triaged without opening every room.
- **Floor plans.** `floorPlanX` / `floorPlanY` exist on every inventory item and only surface in `/plans`.
  Render the floor's plan in the Spaces tab with its materials pinned and coloured by condition.

---

## P3 — Inventory redesign

### 11. Toolbar (`src/components/forms/inventory-filters.tsx`)

Current problems:
- Three unlabelled `<select>`s; "All classifications" is the only clue what the middle one does.
- The four view buttons **silently contradict** the selects: `view=damaged` overwrites
  `where.acmClassification` and `where.condition` in the page's query, but the selects keep displaying the
  user's choice. The controls lie about the query being run.
- No sort control anywhere.

Required structure:

1. **Saved views** — segmented control with counts: `All records` · `Damaged ACM` · `Unsampled` · `TSI` ·
   `No photo` · `Removed`. A view **populates** the facets rather than overriding them, so the controls always
   describe the actual query. (`Unsampled` = `acmClassification: "unknown"` or no sample link; `No photo` =
   ACM/PACM with no `photoLinks`.)
2. **Facets** — labelled fields (reuse `.field` label styling): Search, Building, Classification, Condition,
   Functional area, Response action. Multi-select where it makes sense (Condition); show `Damaged +2` when
   collapsed.
3. **Active filter chips** — one removable chip per active facet, a `Clear all`, and the result count
   (`{n} of {total} records`) on the same row, right-aligned, next to `Save as view`.
4. **Sort** — right-aligned select: Risk (default), ID, Remaining quantity, Last seen, Building.

### 12. Table (`InventoryTable` in `src/components/records.tsx`)

| col | content |
|---|---|
| risk rail | 3px full-height bar, colour from the risk score (task 13) |
| ID | `inventoryCode` mono/teal-dim; below it `internalCode` / `haCode` at 10px ink-3; `Provisional` chip inline |
| Material | `materialDescription` semibold; below, `materialCategory · friable` at 10px |
| Location | `{buildingNumber} · {floor} · {FA name}`; `specificLocation` at 10px below; italic muted "no functional area" when unassigned |
| Classification | `AcmChip`; below, `{asbestosPercent}% {fiberTypes}` or "not sampled" |
| Condition | `ConditionChip` |
| Remaining | right-aligned mono value + a 62px bar of remaining vs removed |
| Last seen | relative age from `InspectionItem.inspectedAt` + inspector name |
| Response | `responseAction` as a chip |
| actions | on row hover: `Open`, `Log condition` |

Sticky header, hairline rows (no zebra), sortable headers on Remaining and Last seen. Keep `table.data`
styling in `globals.css` as the base and extend it rather than adding a second table system.

### 13. Risk score (shared helper — build before tasks 9C and 12)

Add to `src/lib/utils.ts` (pure) or `src/lib/queries.ts` (if it needs data):

```ts
export function riskScore(item: {
  acmClassification: string;
  condition: string;
  accessibility?: string | null;
  disturbancePotential?: string | null;
  friable?: string | null;
}): number  // 0–100
```

Weighting: classification (confirmed > assumed > pacm > unknown > non-acm) × condition
(significantly_damaged > damaged > needs_repair > fair > good) with additive contributions from
`accessibility`, `disturbancePotential` and `friable`. `accessibility` and `disturbancePotential` are stored
on every `InventoryItem` and currently drive **nothing** — they appear only as text on the detail page.

Expose `riskTone(score)` → `"danger" | "warn" | "info" | "muted"` for the rail and matrix cells.

### 14. Derived "last inspected" per material

`InspectionItem` has `inspectedAt` and `currentCondition` per material, but no list surfaces it. Staleness is
the most important property of a compliance record and is currently invisible outside one item's history tab.

Either compute it in the list query (group-by max on `InspectionItem`, batched for D1's variable ceiling), or
denormalise `lastInspectedAt` onto `InventoryItem` and write it when an inspection is completed
(`src/actions/mutations.ts`). Prefer the denormalised column — the list query is on the hot path and D1
group-bys over large sets are expensive.

---

## P4 — Long tail

### 15. Reports page

`src/app/(app)/reports/page.tsx` renders one button per building **per report card** — 8 cards × N buildings.
At 23 buildings that is 184 near-identical buttons; at 100 it is unusable. Split the two decisions: pick the
report, then pick scope inside the report view (searchable building selector + "All in scope"). Remember the
last building used.

### 16. Queue and Quality prioritisation

`src/app/(app)/queue/page.tsx` and `src/app/(app)/quality/page.tsx` render nine unbounded `Block`s; Quality
renders up to 200 rows per block. Cap each block at 6 rows with `view all N`, order blocks by severity, and
collapse empty blocks to a single "All clear" line rather than a full card containing the word "None."

### 17. Dashboard trends

`src/app/(app)/dashboard/page.tsx` shows eight `Kpi` tiles with a bare integer. Add a delta and a 12-week
sparkline to the four **action** tiles (`ActivityEvent` and `InventoryConditionHistory` already hold what's
needed). Leave the four portfolio tiles as plain counts. Extend `Kpi` in `primitives.tsx` with optional
`delta` and `series` props.

### 18. Empty states

`Empty` exists in `primitives.tsx` and is barely used; most empty states are a sentence fragment ("None.",
"No inventory materials have been recorded for this building."). Every empty state should carry a title, one
line of explanation, and the button the user was about to look for.

### 19. Per-building data-quality scores

`/quality` computes unassigned FAs, missing floors, unlinked samples and duplicate codes org-wide. Scope the
same four checks per building to feed the meters in task 9D, so data quality gets fixed in the building while
someone is already there.

---

## Non-UI issue worth a deliberate decision

`src/app/layout.tsx` injects an inline script that intercepts **every** internal link click and rewrites the
href to append `?access=<session token>`. UX cost: unshareable URLs, broken middle-click and copy-link, a
synthetic navigation on every click. Security cost: session tokens land in browser history, server logs, and
`Referer` headers on any outbound navigation.

Do not change this as part of the redesign — it touches every link in the product. Raise it and let the owner
decide (the standard alternative is a `SameSite=Lax` httpOnly session cookie, which `src/lib/session-cookie.ts`
suggests already partly exists).

---

## Reference — full-fidelity annotated mockups

Rendered mockups of the redesigned Building and Inventory pages, with callouts keyed to tasks 7–12:
https://claude.ai/code/artifact/a58ad793-f409-4236-8eb7-f74878b61805
