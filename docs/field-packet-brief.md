# STRATA — Field inspection packet redesign

Implementation spec for an AI coding agent. Third in a set with `docs/ux-redesign-brief.md` and
`docs/inspection-forms-brief.md`.
Annotated mockups: https://claude.ai/code/artifact/27d4ec6e-0a91-44ef-84ed-1b5f298e6b43

**Reference form.** This spec is modelled on the checklist actually carried in the field today: the Midland
WPS *NON-ROUTINE — Annual Asbestos Visual Evaluation Procedure* for I-Park Building 1707 (Dow Silicone),
2026 edition, and its companion `1707 Inventory.xlsx`. Match its conventions unless this document says
otherwise — inspectors have years of muscle memory in it.

Files: `src/lib/packet-pdf.ts` (299 lines, PDFKit), `src/app/api/buildings/[id]/packet/route.ts`,
`src/app/(app)/buildings/[id]/packet/page.tsx`.

---

## What the existing field form does, and what to keep

The 1707 checklist is one wide table per sheet:

```
Condition | Labeling | Item # | Sample # | Status | Location Description | Material Identification | Est. Quantity | UOM
```

grouped into **First Floor** (36 items) and **Basement** (79 items) — 115 items total, 81 sampled,
33 PACM, 1 removed.

**Keep — two write-in cells, not nine boxes.** Condition and Labeling are each a *single* cell. The inspector
ticks it when the material is fine and writes into it when it isn't. Do not replace this with one pre-printed
box per condition value; seven boxes would consume ~70 pt of every row, which is width the Location
Description needs far more.

**Do not draw a box inside the cell.** The table already rules every cell — a printed checkbox is a second
border around the same space. The cell *is* the box. Give the two write-in columns a 1 pt rule (heavier than
the 0.5 pt body rules) and keep them white through the zebra banding so they read as fields.

**Keep — field corrections written on the sheet.** The marked-up 2026 copy carries "Remove Same as #10"
across item 112, hood numbers beside Lab 37, "above ceiling" on the Mag TSI run, "B-31" correcting a room
number, and "Hot water supply" against the mechanical-room lines. Recording inventory corrections is half
this document's value. Give them a dedicated ruled **Field notes** column instead of making them compete
with the description text.

**Keep — the floor grouping and the Sample # / Status columns.** `PACM` in the Sample # column and
`Existing` / `Removed` in Status are the vocabulary already in use.

---

## P0 — Correctness bugs in the current generator

### 1. Twelve materials per page

`packet-pdf.ts:156` sets `const perPage = 12` with a 46 pt row on portrait Letter. Most of that row is spent
on a *string* that isn't a checkbox:

```ts
doc.text("[ ] Good  [ ] Repair  [ ] Removed  [ ] Inacc.   [ ] Label OK  [ ] Replaced  [ ] Missing", …)
```

115 items → 10 inventory pages; a 412-material building → 35, plus cover, additions and plans ≈ 39 sheets.

### 2. There is no code key anywhere on the sheet

The WPS procedure says to "mark any deficiencies found on the checklist" without saying how. A tick means
good; everything else is whatever that inspector invents. Four inspectors work this building
(J. Larkin A55114, L. Garchow A3309, N. Garchow A40817, P. Mogg A55111) and nothing on the page tells them
to agree. **This is the single most valuable addition in this spec** — see P2.

### 3. Tick options don't match the database

The printed options are *Good / Repair / Removed / Inacc.* `CONDITION_LABELS` in `src/lib/utils.ts` holds
seven values: `good, fair, damaged, significantly_damaged, needs_repair, removed, inaccessible`. Note the
Dow workbook's own Settings sheet uses only Good / Fair / Poor — the code key in P2 is the bridge between
the two vocabularies, and "Poor" maps to `significantly_damaged`.

### 4. Materials print in code order, not walking order

`route.ts` uses `orderBy: { inventoryCode: "asc" }`. Order by floor level → functional area → room → code,
matching the route sheet in field mode.

### 5. "PREV" prints today's condition, unlabelled as such

The `PREV` column renders `CONDITION_LABELS[it.condition]` — the current value, not the value at the last
inspection. Resolve the previous condition from the most recent completed `InspectionItem`.

### 6. Demo floor plans are hardcoded

`packet-pdf.ts:258–284` matches building names — `/mh01|Main Hospital/i`, `/mh03|Central Plant/i`,
`/lusa|Academic/i` — and draws invented room schematics. Real buildings fall through to one empty rectangle.
Delete `drawSchematic` and the name matching; render the real raster plan, else a ruled grid with a
"no drawing on file" note.

### 7. Fetched and never printed

`specificLocation` is in the packet type and never rendered, so "N wall, above header" never reaches the
field. PPE, the designated person, and open repairs aren't in the packet at all.

---

## P1 — Page geometry

**One full-width table**, not multiple columns — the 1707 descriptions run to 82 characters
("Mechanical Room, near staircase, outside double doors, 1 in elbow, Condensate Line") and multi-column
layouts truncate them.

### Portrait is the default; landscape is an option

Turning the sheet costs 180 pt of width and buys 180 pt of height. Row count scales with height and column
widths scale with width, so **portrait holds 36% more rows per page**:

| | Landscape Letter | **Portrait Letter** |
|---|---|---|
| Printable (22 pt margins) | 748 × 568 pt | 568 × 748 pt |
| Rows per full page | 42 | **57** |
| Rows on page 1 (under the band) | 30 | **41** |
| Capacity in 3 pages | 114 | **155** |
| Location Description | 200 pt | 170 pt |
| Field notes | 150 pt | 104 pt |
| 1707 (115 items) | 3 pages, full | **3 pages, 26% spare** |

Portrait also fits a standard clipboard without turning the sheet, and files, scans and photocopies
alongside the rest of the WPS procedure, which is portrait. The 1707 checklist carried today is already
portrait paper with the table rotated onto it sideways.

Four cuts pay for the 180 pt, and three are improvements on their own:

1. **Drop the Status column** (−38 pt). It reads `Existing` on 114 of 115 rows. Removed items get a grey
   band and a struck description instead — more visible than the word was.
2. **Merge Est. Quantity and UOM** into one cell (−18 pt): `1,155 SqFt`. They were never two decisions.
3. **Strip the constant sample prefix** into the group header (−24 pt): `117A` under a header reading
   `sample prefix 1707-`, not `1707-117A` on every row.
4. **Trim the notes lane** 150 → 104 pt. The only genuine loss; 104 pt still holds "room is B-31 not B-33"
   at handwriting size.

Implement both orientations from one geometry table keyed by `paper` + `orientation`; `layoutRows()` reads
the widths and row count from it and is otherwise identical.

### Landscape Letter (792 × 612 pt)

| column | width | notes |
|---|---|---|
| Condition | 26 pt | write-in cell, centred, no drawn box, always white |
| Labeling | 26 pt | write-in cell, centred, no drawn box, always white |
| Item # | 24 pt | mono bold |
| Sample # | 58 pt | `1707-117A` or `PACM` |
| Status | 38 pt | Existing / Removed |
| **Location Description** | **200 pt** | full text, no truncation |
| Material Identification | 112 pt | `TSI, white` · `12x12 Floor Tiles, Beige` |
| Est. Quantity | 46 pt | numeric or free text (`3 Medium, 3 Large, 1 X-Large`) |
| UOM | 26 pt | SqFt / LF / Ea |
| **Field notes · corrections · new ACM** | **150 pt** | ruled, blank |

```
row height   12.5 pt (standard) | 11 pt (compact)
box size     13 pt  (standard) | 11 pt (compact)
page header  22 pt  ·  page footer 14 pt
brief band   150 pt, page 1 only
```

Rows per page: **30** on page 1 (under the band), **42** on pages 2–3.

### Portrait Letter (612 × 792 pt)

| column | width | notes |
|---|---|---|
| Condition | 24 pt | write-in cell, no drawn box, always white |
| Labeling | 24 pt | write-in cell, no drawn box, always white |
| Item # | 20 pt | mono bold |
| Sample # | 34 pt | prefix stripped to the group header |
| **Location Description** | **170 pt** | wraps to a second line when it overruns |
| Material Identification | 96 pt | |
| Est. Quantity | 54 pt | quantity and UOM in one cell |
| **Field notes · corrections** | **104 pt** | ruled, blank |

Brief band 200 pt (two columns, with the code key as a full-width strip beneath them).
Rows per page: **41** on page 1, **57** on pages 2–3.

### Long descriptions wrap; they never truncate

A 200 pt column at 7 pt Helvetica holds roughly 57 characters. Eight or nine 1707 rows exceed that — the
longest is 82 characters. Rows must grow to a second line when the description overruns, at roughly a
half-row of cost each (~5 rows across 1707), which the portrait budget absorbs. Truncating a location
description is not an option: it is the sentence that tells the inspector where to stand.

---

## P2 — The code key (print this on page 1)

A single box per column only works if the vocabulary is printed on the same sheet. Render this in the
right-hand third of the brief band, and derive the labels from `CONDITION_LABELS` so the paper and the
database can't drift.

### Condition — write one code in the cell

| code | value stored | printed gloss |
|---|---|---|
| `✓` | *previous condition* | Good — no change since last inspection |
| `F` | `fair` | Fair — minor wear, intact, no debris |
| `D` | `damaged` | Damaged — tears, gouges, delamination |
| `S` | `significantly_damaged` | Significantly damaged — >10% of surface |
| `R` | `needs_repair` | Needs repair — response action required |
| `X` | `removed` | Removed — no longer present |
| `N` | `inaccessible` | Not accessed — say why in Notes |

### Labeling — write one code in the cell

| code | value stored | printed gloss |
|---|---|---|
| `✓` | `good` | Label present — legible & visible |
| `R` | `replaced` | Replaced — you applied a new label |
| `M` | `missing` / `unable_to_replace` | Missing — could not replace |
| `–` | *null* | Not required — under carpet / concealed |

### Notes-column markers

`↺` location correction (write the correct room) · `+` new ACM found, log on page 3

### The rule printed under the key

> **Any code other than ✓ requires a note.** Where photography is permitted, photograph D, S, R and X
> before leaving the location. Leave a cell blank only if you did not reach it — a blank cell is recorded as
> **not inspected**, not as good.

### Transcription rules (these are the reason the key exists)

1. `✓` resolves to the material's **previous condition**, not to `good`. On a material last recorded as
   Fair, a tick means still Fair.
2. A blank cell is `inspected: false`. Never infer good.
3. `X` sets `InventoryItem.recordStatus = "removed"` and prompts for a `RemovalEvent`.
4. `N` requires the Notes text; block the transcription row until it's present.
5. An ambiguous or unreadable mark is flagged for review, never guessed.

---

## P3 — Page composition

### Page 1: brief band (150 pt), three columns

| column | contents |
|---|---|
| Identity | building name and client, inventory counts (`115 items · 81 sampled · 33 PACM · 1 removed`), total quantity (`15,218 SqFt · 855 LF`), last inspection with inspector and finding, next due, procedure reference (`WPSMiOps2018010005 · AHERA 40 CFR 763 E`), then blanks: inspector, licence #, date, in/out times |
| What to check | the four checks lifted from the WPS procedure — ACM not damaged/deteriorated; encapsulation and jacketing intact; all ACM labeled, legible and visible; **location on the inventory is correct**. Plus the hard rule `DO NOT DISTURB OR REPAIR ACM`, PPE, the exposure response, and "all work coordinated through Bierlein" |
| **Code key** | P2, in full |

The brief must be a band, not a page. A cover page is a page you can't write on.

Every page carries a header (`STRATA · ANNUAL ASBESTOS VISUAL EVALUATION · {building} · {client}` + a QR to
the building record) and a footer (`{building} · PAGE n OF m · {range} OF {total}`). Checklists get
separated — every sheet must identify itself.

### Group headers

`First Floor   36 items   ___ / 36 COMPLETE` — grey band, 1.5 pt top rule, with a blank for the inspector's
own count. A group header must never be the last row of a page.

### Layer nesting

1707-27A/27B, 49A/49B, 50A/50B, 58A/58B, 60A/60B, 61A/61B, 62A/62B, 65A/65B, 69A/69B, 70A/70B, 76A/76B,
86A/86B, 87A/87B, 90A/90B, 99A/99B, 100A/100B, 101A/101B, 113A/113B are all second and third **layers** of
one run, sampled twice, with the quantity carried only on the first row. On the current sheet the inspector
ticks each separately.

Indent layer rows under their parent with a `↳ layer 2 —` prefix and a dash for quantity. The run is looked
at once and marked once; transcription still writes both `InspectionItem` records, copying the parent's
codes. Detect layers by sample-number stem (`1707-49` + suffix letter) **and** identical
`Location Description`; never merge across different locations.

This is what makes 1707 fit — it buys back roughly nine rows in the basement alone.

### Page 3: closeout

Occupies the lower band once the table runs out, in three columns:

- **New ACM found — not on the inventory** — location, material, est. qty, UOM, ☐ assume ACM ☐ sample now,
  with the reminder to mark the location on the building map. Writes to `SuspectMaterial`.
- **Repair / removal recommended** — item #, problem, recommended action (repair / encapsulation /
  enclosure / full removal — the exact vocabulary in the workbook's Settings sheet), plus a short
  **Inventory corrections** block (item # · what changed).
- **Sheet reconciliation** — blanks for ✓ GOOD / CODED / BLANK / PHOTOS that must total the item count,
  with the note that a checklist which doesn't reconcile goes back before transcription. Then **Overall
  finding** as tick boxes using the workbook's own wording — *Asbestos is in good condition · in need of
  repair · in poor condition* — plus *Action required ☐ Yes ☐ No*. Then two signatures: inspector
  (signature, printed name/licence #, date) and **transcribed by** (name, date).

Also add a **"Not accessed this visit"** group at the end of the table: a few blank rows where an
inaccessible material gets an item number and a reason, so `N` codes never become unexplained gaps.

---

## P4 — Fitting larger buildings

Applied in this order:

1. **Layer nesting** (default on, −8 to 15%). Above.
2. **Group repeated materials** (default on, −25 to 40%). Items 98–101 and 109–111 are the same 9x9 green
   tile under carpet in seven different offices. One row with a room tick-list —
   `Offices 7 ☐ 8 ☐ 9 ☐ 13 ☐ 15 ☐ 18 ☐` — is the same information in a seventh of the space and matches how
   a corridor is walked. Group by `homogeneousAreaId` (or identical `materialDescription` +
   `materialCategory`) within one functional area. **Auto-expand** to individual rows if any member was last
   recorded worse than Good, or has an open repair.
3. **Compact density** (−15%): 11 pt rows and boxes → 47 rows/page. A setting, not a default.
4. **Legal or A3 landscape** (+27%): 14 × 8.5 in adds 216 pt — a second notes lane, or 52 rows.

### The page-budget preview is required

`src/app/(app)/buildings/[id]/packet/page.tsx` must compute and display the page count **live**:

> **3 pages** · 115 items · layers nested · standard density · Letter landscape

with the levers as controls beside it. Options to expose: paper size, density, layer nesting, group repeated
materials, include floor plans, include removed items, and scope to a floor or functional area for a
half-day visit.

---

## P5 — Implementation notes

### Generator structure

`packet-pdf.ts` is one 200-line function with magic numbers inline. Restructure:

```ts
type PacketOptions = {
  paper: "letter" | "legal" | "a4" | "a3";
  orientation: "portrait" | "landscape";   // portrait is the default
  density: "standard" | "compact";
  nestLayers: boolean;
  groupRepeated: boolean;
  includeFloorPlans: boolean;
  includeRemoved: boolean;
  scope?: { floorId?: string; functionalAreaId?: string };
};

const GEOMETRY = { /* margins, row heights, box sizes, column widths per paper */ };

function layoutRows(items, options): Page[]      // pure — pagination, groups, nesting, collapsing
function drawBriefBand(doc, building, ctx)       // includes the code key
function drawTablePage(doc, page, ctx)
function drawCloseout(doc, ctx)
```

`layoutRows` must be pure and unit-testable — it is where the page-count promise lives, and the preview in
P4 calls the same function so the estimate can never disagree with the PDF.

### No drawn checkboxes

The write-in cells are formed by the table rules themselves — `doc.rect()` for the cell border at 1 pt, and
nothing inside it. Do not emit `[ ]` as text (the current generator does) and do not draw a second rectangle
inside a ruled cell.

### Fonts

PDFKit's built-in Helvetica at 7–7.5 pt is legible for the table. Keep it — embedding IBM Plex adds ~300 KB
per packet for no field benefit. Helvetica-Bold for item numbers, group headers and the code key letters.

### Query changes (`route.ts`)

- Order floor → FA → room → code.
- Include `functionalArea`, `homogeneousArea`, `floor`, PPE, open repairs, and the previous inspection's
  items (batched — D1 has a low SQL-variable ceiling).
- Keep `recordStatus: "active"`, and add removed items as a short appendix group when `includeRemoved` is
  on, so an inspector can confirm a removal actually happened (item 112 is exactly this case).

---

## Acceptance criteria

- Building 1707 (115 items, 36 first floor / 79 basement) prints on **3 pages** at standard density on
  **portrait** Letter with layer nesting on, and the preview shows "3 pages" before generating. The same
  inventory also fits 3 pages in landscape, with no spare capacity.
- The code key appears on page 1, every code maps to a value in `CONDITION_LABELS` or the label states, and
  the key's glosses are derived from those maps rather than hardcoded twice.
- No checkbox glyph or drawn box appears inside any table cell; the Condition and Labeling cells are empty,
  white, and bounded only by the table rules.
- No Location Description is ever truncated in either orientation; rows that overrun the column wrap to a
  second line, and the longest 1707 description
  ("Mechanical Room, near staircase, outside double doors, 1 in elbow, Condensate Line") renders in full.
- Every row has a blank Field notes cell — at least 104 pt portrait, 150 pt landscape.
- Layer rows appear indented under their parent, with the parent's quantity shown once.
- Every page identifies its building, page number and item range in the footer.
- No building name appears in a `RegExp` anywhere in `packet-pdf.ts`.
- `layoutRows()` has unit tests for: exact page fill, a group header never landing last on a page, layer
  nesting, repeated-material grouping, auto-expansion of a non-Good member, and the closeout sizing to the
  free space on the final page.
