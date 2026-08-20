# STRATA design & implementation briefs

For the cross-thread current-state register, see [Strata Chief of Staff](strata-chief-of-staff.md).

Four specs written for an AI coding agent, in the order they should be worked.

| brief | scope | mockups |
|---|---|---|
| [ux-redesign-brief.md](ux-redesign-brief.md) | App shell, building page, inventory list & detail, dashboard, queue, quality, reports. 19 tasks. | [Interface review](https://claude.ai/code/artifact/a58ad793-f409-4236-8eb7-f74878b61805) |
| [inspection-forms-brief.md](inspection-forms-brief.md) | Field mode improvements, and a new grid-based historical/backfill entry form. | [Inspection forms](https://claude.ai/code/artifact/edd0dd19-1413-494c-891b-9046bbe54af9) |
| [field-packet-brief.md](field-packet-brief.md) | The printed field checklist — portrait, coded write-in cells, printed code key. Modelled on the Dow 1707 WPS form. | [Field packet](https://claude.ai/code/artifact/27d4ec6e-0a91-44ef-84ed-1b5f298e6b43) |
| [workbook-import-brief.md](workbook-import-brief.md) | Importing the 458 real `*Inventory*.xlsx` workbooks, whose shape the current importer cannot read. | — |

## Suggested order

1. **`ux-redesign` P0 task 1 — the Tailwind token layer.** Half an hour, and it changes every screen in the
   product. Nothing else in these documents is as cheap.
2. **`inspection-forms` Part A — backend correctness.** `submitInspection()` currently resets the building's
   surveillance clock and overwrites current conditions regardless of date. Both are active data loss the
   moment anyone backfills, and the importer in brief 4 backfills six inspections per building.
3. **`workbook-import` P0 — the profiler.** Read-only, and it tells you what the other 348 unprofiled
   workbooks contain before you commit to a mapping.
4. Everything else, in each document's own stated order.

Briefs 2 and 4 are coupled: the importer routes `Inspection History` rows through
`saveHistoricalInspection()`, so that function must exist and be correct first.
