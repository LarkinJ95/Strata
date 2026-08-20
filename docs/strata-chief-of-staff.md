# Strata Chief of Staff

**Last reviewed:** 2026-08-20

This is the cross-thread evidence register. A successful source build, a Worker deployment, and an authenticated production workflow are separate kinds of proof.

Status labels are literal: **Complete** means finished at the stated layer; **Deployed** means an active Worker is identified; **Source-pushed** does not imply deployment; **Data complete** requires production D1 evidence; **Blocked** names a stopping condition; **In progress** is unfinished work; and **Planned** has no completed delivery evidence yet.

## Completed source work

| Area | Evidence | State |
|---|---|---|
| Field inspection material workflow | `8a9aaed` | **Source-pushed.** Production deployment and authenticated workflow validation are separate checks. |
| Offline field inspection support | `6616cc0` | **Source-pushed.** This commit was also the earlier recorded deployment at Worker `6aeb4e13-ed2d-46ed-b18c-a4e1bea70352`; signed-in acceptance remained open. |
| Building report-form override | `4216acf` | **Complete in source, source-pushed, and deployed.** The additive `0005_building_report_form_override.sql` migration was applied; existing buildings retain the default (`NULL`) selection. |
| Report-form policy | Corteva/SC Johnson → Annual Inspection Report; Dow Corporate → Dow Corporate Audit; all others → MIOPS | **Complete in source.** Template discovery and the building-level selector are complete. Actual report rendering, exact completed-form field mapping, signature capture/output, and immutable report storage remain **planned**. |

## Deployed evidence

| Item | Evidence | Remaining verification |
|---|---|---|
| Current Worker deploy | **Deployed:** commit `4216acf` on `agent/item-number-normalization`; Worker version `b61c736a-da0b-4b93-8698-ec9c0fac77d9`; `/api/health` returned 200. | The unauthenticated dashboard correctly redirected to login. Signed-in validation is still missing for report-form save/read-back and the broader Settings, Data Quality, facility-ordering, offline, and field-workflow acceptance paths. |
| Production bindings | D1 `strata`, R2 `strata`, organization `bierlein` | Reinspect existing bindings before any infrastructure change; do not provision replacements. |

## Production-data complete

| Area | Verified state |
|---|---|
| Phase 1 functional areas | **Data complete** outside the explicit Corteva **I-Park Steam Lines** exclusion: the completion gate covered 3,098 in-scope materials with zero unassigned materials, zero invalid FA links, and zero invalid FA-to-floor links. A 2026-08-20 read-only refresh shows 3,093 current in-scope materials and still zero assignment issues; the five-record delta was not investigated here, so 3,098 remains the Phase 1 completion count rather than a current row count. |
| I-Park scope | **Complete exclusion from Phase 1:** I-Park Steam Lines, including 25 lb Steam, was excluded from floor/FA creation and material-assignment totals because these are exterior systems. The exclusion does **not** automatically apply to targeted imports or historical-inspection review. |
| 175 lb Steam source truth | **Complete:** Corteva → I-Park Steam Lines → `175lb Steam` (`dec8b019-b10c-43f5-abca-4a03362e8d98`) contains 45 unique located circuit/material records, one FA per circuit, 0 real sample-result rows, 0 annual item condition/label rows, and 6 dated historical inspection headers. Header rows were not imported as data. |
| 175 lb Steam production | **Data complete:** a 2026-08-20 read-only D1 check shows 2 floors, 45 FAs, 45 materials, and 6 inspections. The available coordination record does not establish whether the eventual successful write used a later importer retry or the fallback SQL. |

## Historical blocker / operational fallback

| Area | Evidence | Current state |
|---|---|---|
| 175 lb Steam importer | `2912cce` | **Source-pushed.** Repeated guarded Cloudflare `D1_RESET_DO` attempts were **blocked** and each stopped with no partial write: 1 floor, 0 FAs, 0 materials, 0 inspections. That blocker is historical because the target is now data-complete. |
| 175 lb Steam fallback | [175lb-steam-fallback-import.sql](../175lb-steam-fallback-import.sql) | **Complete fallback, execution provenance uncertain.** It is scoped to the 45 FAs/materials and six inspection headers, omits unsupported samples/results, and is currently untracked. Do not stage it in documentation work or rerun it against the now-complete target. |
| Broader historical inspections | Backfill/import implementation must preserve history and never overwrite current inspection state. | **Planned:** continue source-by-source preflight; do not infer workbook coverage or fabricate missing rows. |

## In progress — not yet validated or deployed

| Area | Scope | Gate before state changes |
|---|---|---|
| WO / PO / PMO work tracking | **In progress:** additive work records, multi-material notes/outcomes, work attachments, building Work tab, and global open-work filters. | Schema/type/build validation, explicit source commit/push, then a separately authorized migration/deploy and authenticated production workflow check. Production currently has no `WorkRecord` or `WorkRecordItem` tables. |

## Branch alignment

- Current branch: `agent/item-number-normalization`, at `4216acf` before the in-progress work-record changes.
- It has 8 commits not in `origin/main`; `origin/main` has 2 commits not in this branch. Reconcile deliberately—do not force-push or assume either branch is the deployment source.
- `origin/main` was `d943111` and local `main` was stale at `5b2976e` during this review. This documentation task does not reconcile either ref.

## Checkout safety

Concurrent implementation currently touches `prisma/schema.prisma`, `scripts/import-corteva-175lb-steam-line.ts`, building/shell UI, permissions, `migrations/0006_work_records.sql`, work actions/routes/forms, and the untracked fallback SQL. Stage only this Chief of Staff document for the documentation commit.

## Operating rules

1. Treat imported production data as additive by default; preflight workbook sheets and `Import Exceptions` before writing.
2. Scope buildings by client and facility as well as building number.
3. Do not overlap OpenNext builds/deployments.
4. Keep the local numeric **Item #** separate from the building-prefixed internal inventory identifier.
5. A removal action may omit a photo; photographable conditions retain their photo requirement.
