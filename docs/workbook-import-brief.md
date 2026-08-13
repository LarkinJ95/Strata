# STRATA — Inventory workbook importer

Implementation spec for an AI coding agent. Fourth in a set with `docs/ux-redesign-brief.md`,
`docs/inspection-forms-brief.md` and `docs/field-packet-brief.md`.

**The problem.** `scripts/import-production-workbook.ts` expects a purpose-built workbook with sheets
`Clients / Facilities / Buildings / Floors / Inventory` and snake_case columns (`client_number`,
`building_number`, `inventory_code`, `material_description`). **Zero** of the real workbooks have that shape.
Every building currently needs a hand-built intermediate file before it can be imported.

**The corpus.** 458 `*Inventory*.xlsx` files under `~/Documents/Asbestos/Customer_Files`, across 7 top-level
clients (Dow, Dow East, DuPont, Corteva, OxyChem, plus others), 139 Dow building folders alone. Workbooks
also name clients not present as folders — *Trinseo, Midland, MI* and *IFF, Midland, MI* appear in title
blocks.

---

## What the corpus actually looks like

Profiled: 110 workbooks sampled at random, excluding `Archive/` and `*OLD*`. Zero parse errors.

### Sheet presence (of 110)

| sheet | count | use |
|---|---|---|
| `Estimated Quantities` | **110** | the inventory — primary source |
| `Revision History` | 110 | ignore |
| `Sample Results` | **109** | laboratory results |
| `Annual Inspection Report` | 76 | narrative, older generation |
| `DVO` | 69 | ignore unless it turns out to matter |
| `Dashboard` · `Risk Assessment` · `Cost Estimation` · `Inspection History` · `Settings` | 35 | newer generation |
| `Removal & Repair Log` | 28 | removals and repairs |
| `Abatement Tracking` | 7 | removals, older name |

Two generations exist. Import must handle both: `Estimated Quantities` + `Sample Results` are universal;
everything else is optional.

### `Estimated Quantities` header variants

The canonical header (27 of the headers detected):

```
Condition | Labeling | Item # | Sample # | Status | Location Description | Material Identification | Est. Quantity | UOM | Friability | Condition | Notes
```

Observed variants:

| variant | notes |
|---|---|
| no `Condition` / `Labeling` columns | older generation, 8 columns |
| `… Status \| **Area** \| Location Description …` | extra location column |
| `… Status \| **Room** \| Location Description …` | extra location column |
| `… Status \| **Floor** \| **Room** \| Location Description …` | two extra |
| `… Status \| **Floor** \| **Locatiom** \| …` | **typo in the source file** |
| `Material Description` instead of `Material Identification` | |
| `Estimated Quantity` instead of `Est. Quantity` | |
| `Unit` instead of `UOM` | |

**Map by header label through a synonym table, never by column position.** Positions shift by up to three
columns across the corpus.

**`Condition` appears twice in the canonical header** — column A is the field-mark box (empty or `0` in an
unmarked workbook) and column K is a recorded condition value. Disambiguate by ordinal: the first
`Condition` is the mark column, the second is data. Getting this backwards silently imports "0" as a
condition on every row.

### Value domains, and what they reveal

`Status` across the sample: `Existing` (522), `Removed` (154) — and then `Jacketing` (36), `Insulation` (14),
`Transite board` (5), `Jacketing, pip…` (5). Those last are **column-shifted files**: the header row didn't
line up and material text landed in Status.

`UOM`: `SqFt` (139), `LF` (45), `Ea` (19), `Qty` (19), blank (167) — plus `Mudded F…` (57), `Transite` (37),
`Fume Hoo…` (28), `-`, `1`. Same shift problem.

**Therefore: validate every mapped column against its value domain, and quarantine the row when it fails.**
A row whose `Status` isn't in `{Existing, Removed}` or whose `UOM` isn't in `{SqFt, LF, Ea, Qty, ""}` has
almost certainly been mis-mapped — do not guess, do not import, report it.

`Sample #` shapes: `1707-24C` style (282), literal `PACM` (278), blank (125), `A-nn` (44), `B-nn` (13),
`DEA-nn` (3), `WG-nn` (1) — and some cells carry an embedded newline plus a note
(`"…\nabove ceiling"`). Parse the first line, keep the remainder as a note.

### Floor / section rows

Floors appear as a single-cell row (`First Floor`, `Basement`) immediately above a repeated header row. A
naive "one non-empty cell = a floor" heuristic picks up an enormous amount of junk — in my first pass it
returned `#`, bare numbers `02`–`20`, `Dow, Midland, MI`, `PMO: 28401705126`, `PO: 28401729806`.

**Rule:** a section label is a row with exactly one non-empty cell **that is immediately followed by a header
row**. Nothing else. Title-block rows (client, PO/PMO numbers, `Asbestos Inventory - Estimated Quantities`)
sit above the first header and are metadata, not floors.

### `Sample Results`

```
Associated Item # | Sample Number | Sample Identification / Location | Asbestos Type | Concentration
```

with optional `Sample Date` and `Zone`. **`Associated Item #` is frequently empty** — in 1707 it is empty on
every row. The inventory→sample link must be recovered by matching `Sample Results.Sample Number` against
`Estimated Quantities.Sample #`, not by trusting that column.

### `Inspection History` (newer generation)

```
Inspector | Findings | Action\n Required? | Recommended Action | Inspection Date | Next Due Date | Notes
```

Note the literal newline inside `Action\n Required?` — normalize whitespace before matching headers.

Values are controlled by the `Settings` sheet: Findings ∈ {*Asbestos is in good condition*, *in poor
condition*, *in need of repair*, *No asbestos was found visually*}; Recommended Action ∈ {*Full Removal*,
*Encapsulation*, *Enclosure*, *Repair*}; Inspectors as `Name - Licence` (`Jason Larkin - A55114`). Dates are
Excel serials (`46245` = 11 Aug 2026) — `XLSX.readFile(path, { cellDates: true })` handles this; do not
parse the serial by hand.

### Do not import these sheets

`Risk Assessment` and `Cost Estimation` in `1707 Inventory.xlsx` describe a **different building** — items
01–07 read "Lab bench top, Lab 113-20", "hood 113-1-C", "113-2", "Exterior, Outside door 113-C/E-4", while
the real item 01 in `Estimated Quantities` is basement mastic. They look like template data that was never
replaced. Both sheets are present in all 35 newer-generation workbooks; assume the same contamination until
proven otherwise. Report the mismatch, never import from them.

`Risk Assessment` does carry a **Risk Score (1–9)** computed from Friability × Condition × Accessibility.
That is the same concept as `riskScore()` in `docs/ux-redesign-brief.md` task 13 — match this scale rather
than inventing a competing one, so a number means the same thing in both places.

---

## P0 — Profile before you import

Build the dry-run first; it is how you discover the variants this document hasn't seen.

```
npm run import:profile -- "<glob>"
```

Emits, without touching the database:

- sheet-name sets and their counts
- every distinct `Estimated Quantities` header row, with counts and file examples
- value-domain histograms for Status, UOM, Sample #, Friability, Condition
- files whose header could not be located at all
- per-file row counts and detected floor sections
- a `unmapped-headers.json` the synonym table can be extended from

Ship this as a permanent command, not a throwaway. With 458 files and two generations, "what shapes exist"
is a question that will be asked again.

---

## P1 — Mapping to the schema

### Identity

| target | source | notes |
|---|---|---|
| `Client` | directory name, normalized | `Dow` / `Dow East` are separate directories; workbook title blocks say `Dow, Midland, MI`, `Dupont, Midland, MI`, `Trinseo, Midland, MI`, `IFF, Midland, MI`. Requires an explicit normalization table — see P2. |
| `Facility` | intermediate directory | `Corporate:Campus Bldgs`, `1130 Block`, `Block 800`, `Buildings`. Where absent, create one facility named for the client. |
| `Building` | leaf directory (`1707 Bldg`) + workbook title (`I-Park Building 1707`) | `buildingNumber` from the directory, `name` from the title block when it adds information. |
| `BuildingFloor` | section rows | `First Floor`, `Basement`, etc. `level` inferred from the name (Basement = −1, First = 1); leave null when unclear rather than guessing. |

### `InventoryItem`

| field | source | rule |
|---|---|---|
| `inventoryCode` | `{buildingNumber}-{Item #}` | `Item #` is only unique within a building. Preserve leading zeros (`08`, not `8`). |
| `internalCode` | `Item #` verbatim | this is the number the field checklist and the client both use |
| `floor` | section label | |
| `specificLocation` | `Location Description` **verbatim** | do **not** parse rooms out of it. "Mechanical Room, near staircase, outside double doors, 1 in elbow, Condensate Line" is one string an inspector reads; splitting it loses more than it gains. Leave `room` and `area` null unless the workbook has explicit `Room` / `Area` columns. |
| `materialDescription` | `Material Identification` | |
| `materialCategory` | derived | keyword map: `TSI`/`Mag TSI`/`insulation` → Thermal System Insulation; `floor tile`/`mastic`/`cove base` → Miscellaneous; `Transite`/`countertop`/`gasket`/`sink coating`/`joint compound` → Miscellaneous; surfacing terms → Surfacing. Unmatched → `Unclassified`, and report the distinct unmatched values so the map can grow. |
| `acmClassification` | `Sample #` + `Sample Results` | `PACM` → `pacm`; a sample number with a positive result → `confirmed_acm`; `None Detected` → `non_acm`; a sample number with no matching result → `assumed_acm`; blank → `unknown`. |
| `asbestosPercent`, `fiberTypes` | `Sample Results` Concentration / Asbestos Type | Concentration arrives as a fraction (`0.1` = 10%) in some files and a percent string (`10-15%`) in others. Normalize to percent; ranges take the upper bound and the raw text goes to `quantityNotes`-style provenance. |
| `originalQuantity` / `currentQuantity` | `Est. Quantity` | numeric only. Free text (`3 Medium, 3 Large, 1 X-Large`, `2 Medium, 2 Large`) → leave both **null** and put the text in `quantityNotes`. Never coerce "3 Medium, 3 Large" to 3. |
| `quantityUnit` | `UOM` | normalize `SqFt`→`SF`, `LF`→`LF`, `Ea`/`Qty`→`EA`. Blank → `EA` only when the quantity is also blank; otherwise quarantine. |
| `recordStatus` | `Status` | `Existing`→`active`, `Removed`→`removed`. Anything else → quarantine. |
| `friable` | `Friability` | High/Medium/Low/None → `friable` / `friable` / `non_friable` / `non_friable`, keeping the raw value in notes. Absent in the older generation. |
| `condition` | second `Condition` column | when absent or blank use **`unable_to_inspect`**, not `good`. An unstated condition is not a good condition, and defaulting to `good` would fabricate 15,000 SF of clean material across the corpus. |
| `notes` | `Notes` column | |

### Layer rows

Sample numbers ending in a suffix letter over a shared stem — `1707-49A` / `1707-49B`, `27A` / `27B` — with
an identical `Location Description` are **layers of one material**, and only the first carries a quantity.
Import each as its own `InventoryItem` (they are separately sampled), but link them to a shared
`HomogeneousArea` so the field packet and field mode can nest them (see `docs/field-packet-brief.md`).
Never merge across differing location descriptions.

### `Sample` and results

One `Sample` per `Sample Results` row. Link to inventory via `SampleInventoryLink` by matching sample number
to the inventory row's `Sample #`; where `Associated Item #` is populated, use it as a cross-check and report
disagreements rather than silently preferring one.

### Historical inspections

`Inspection History` rows become completed historical inspections — **route them through
`saveHistoricalInspection()` from `docs/inspection-forms-brief.md`**, not through direct writes. That
function already carries the rules this data needs: dates come from the row, not from now; the building's
`lastInspectionAt` / `nextInspectionAt` only move when the row is the newest; and current material
conditions are not overwritten by an older inspection. 1707 alone has six rows going back to 2021.

`Inspector` splits on ` - ` into name and licence number. The person is usually not a STRATA user — pass the
name as free text.

### Documents

Each building folder holds the annual inspection PDFs (`1707 Annual Inspection 2021.pdf` … `2026.pdf`), a
floor plan (`1707 Floor Plan 2026.pdf`), and lab reports. Attach them as `Document` records on the building,
and where the filename carries a year that matches an imported inspection, attach it to that inspection as
its source document.

---

## P2 — Client normalization

The importer must not create clients from raw strings. Ship an explicit table:

```ts
const CLIENT_ALIASES: Record<string, string> = {
  "dow": "Dow Chemical",
  "dow east": "Dow Chemical",
  "dow, midland, mi": "Dow Chemical",
  "dow silicone": "Dow Silicones",
  "dow silicon": "Dow Silicones",      // typo in Dashboard row 3 of several workbooks
  "dupont": "DuPont",
  "dupont, midland, mi": "DuPont",
  // …
};
```

Unmapped client strings **abort the import for that file** and are listed in the report. Silent
near-duplicate clients are far more expensive to unpick later than a failed run is now.

`Dow` and `Dow East` are almost certainly one client with two facilities — confirm with the user before
collapsing them, and make it a table entry either way rather than a code branch.

---

## P3 — Execution

### Shape

```
npm run import:profile  -- "<glob>"            # P0, read-only
npm run import:dry      -- "<glob>" [--client] # full mapping, writes a report, no DB writes
npm run import          -- "<glob>" [--client] # writes, transactional per building
```

Every run writes `import-report-<timestamp>.json` and a human-readable summary: per file — building
resolved, rows read, rows imported, rows quarantined with reasons, unmatched samples, unmapped headers,
unmapped material categories.

### Idempotency

Re-running must update, not duplicate. Key on `(organizationId, buildingId, internalCode)` for inventory and
`(organizationId, sampleNumber)` for samples. A second run of an unchanged workbook must produce zero
changes — assert this in a test, because it is the property that makes a 458-file import survivable.

### D1 constraints

The existing importer shells out to `wrangler d1 execute` with generated SQL. Keep that approach — Prisma's
batching hits D1's SQL-variable ceiling on inventories of this size (1707 is 115 rows; the corpus reaches
141) — but batch inserts at ~50 rows and wrap each building in its own transaction so one bad file cannot
half-import a building.

### Order

Clients → facilities → buildings → floors → homogeneous areas → inventory → samples → sample links →
historical inspections → documents. Later stages must be individually re-runnable against an
already-imported building.

---

## Acceptance criteria

- `import:profile` over all 458 workbooks completes and reports every distinct `Estimated Quantities` header
  shape with file examples.
- `1707 Inventory.xlsx` imports to 115 `InventoryItem` rows — 36 on First Floor, 79 in Basement, 1 with
  `recordStatus: "removed"` (item 112) — with `PACM` rows classified `pacm` and sampled rows classified from
  `Sample Results`.
- Item 79's quantity (`3 Medium, 3 Large`) imports as null quantity plus a note, not as `3`.
- The six `Inspection History` rows import as completed historical inspections dated 2021–2026, and the
  building's `lastInspectionAt` ends at 11 Aug 2026 — the newest — regardless of the order they were written.
- No row from `Risk Assessment` or `Cost Estimation` reaches the database.
- A column-shifted file (Status containing `Jacketing`) quarantines its rows with a stated reason and
  imports nothing from them.
- Re-running the import over the same workbook produces zero net changes.
- No client is created from a string absent from `CLIENT_ALIASES`.
