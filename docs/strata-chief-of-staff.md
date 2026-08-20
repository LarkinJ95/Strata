# Strata Chief of Staff

**Purpose:** a living shared reference for work across Strata threads. Update this file when an item changes state, is deployed, or needs a decision.

**Last reviewed:** 2026-08-20

**Coordinator task:** `Strata Chief of Staff`
**Production boundary:** local checks, a successful build, and a deployed Worker are different kinds of evidence. Mark an item **live verified** only after checking the intended production route or workflow with approved data.

## Current snapshot

| Area | State | What is true now | Next move / verification needed |
|---|---|---|---|
| Cloudflare foundation | Operational, re-check before infrastructure work | Production uses D1 `strata`, R2 `strata`, and the OpenNext cache `strata-asbestos-compliance-opennext-cache`. | Before any infrastructure change, inspect the existing bindings and deployed version; do not provision replacement resources. |
| Production workbook imports | Completed for the recorded imports | The guarded importer supports additive `--merge` imports, reuses matching parents, and validates relationships. | Use the merge-safe path for future imports; preflight workbook sheets and `Import Exceptions` first. |
| 1707 inventory and lab data | Completed | Corporate 1707 has 115 inventory items, 81 samples, and linked floors/functional areas. | Keep Corporate 1707 distinct from a West/Midland building with the same number. |
| 1707 West completeness | Open | West 1707 is a separate facility/client-scoped identity. The source audit indicated 85 expected inventory items. | Confirm source workbook coverage and import the missing scoped building only if the source supports it. |
| Functional areas | Completed for 1707 | All 115 Corporate 1707 items were assigned to valid areas; shared `B-30/31` and separate `B-ST` were preserved. | Use the same source-first review for future cleanup. |
| Sample layers and large-building loading | Completed and live verified in the recorded work | Asbestos samples support layers/results; high-cardinality building relations are loaded separately to avoid D1 SQL-variable limits. | Preserve separate relation loading when modifying the building detail query. |
| Facilities tables | Completed | Dense facility lists default collapsed and provide explicit expand/collapse controls. | No action unless a regression is reported. |
| Field packet and floor plans | Deployed and production-verified in the recorded work | Building pages expose **Field packet**. The packet places the notes/additions/corrections worksheet before appended floor-plan PDFs, and versioned download URLs prevent stale packets. | Recheck with an authenticated real packet after any packet or caching change. |
| Local Item # format | Implemented on branch, not production-verified | Commit `db7d4ab` normalizes a value such as `EAST-2701-3` to `03` while retaining the building-prefixed identifier separately. | Review/merge the branch, deploy it, then perform a bounded D1 audit and real UI save/read-back. |
| Removal photos during field inspection | Implemented locally, not yet committed/deployed | The current checkout contains changes allowing **Removed** items to save without a photo, while other photo-required conditions remain protected. | Review the three-file diff, run the targeted check/build, commit, deploy, and verify the real removal workflow. |
| Inspection/backfill correctness | Not started from current coordination evidence | Existing briefs flag historical inspection handling as a data-loss priority before broad workbook backfill. | Address the backend correctness work before importing historical inspection rows at scale. |
| UX redesign and workbook expansion | Planned | Design/import briefs describe the remaining redesign, field-form, and 458-workbook import work. | Follow the order in `docs/README.md`: token layer, inspection correctness, read-only workbook profiler, then remaining brief tasks. |

## Current checkout safety

At the last review, the checkout was on `agent/item-number-normalization` at `db7d4ab`, with uncommitted changes limited to:

- `src/actions/mutations.ts`
- `src/components/forms/field-inspection.tsx`
- `src/app/(app)/buildings/[id]/page.tsx`

These changes are related to the removal-photo request. Do not fold unrelated workspace changes into that commit. There are also existing unrelated working-tree changes, including `wrangler.jsonc`, a deleted `src/lib/packet-pdf 2.ts`, and an untracked platform-spec document; inspect them separately before staging or publishing.

## Operating rules

1. Treat imported production data as additive by default. For production workbook imports, use:
   `npm run db:import:production-workbook -- <workbook.xlsx> bierlein --merge`
2. Scope buildings by client/facility as well as number. `1707` is not a global identifier.
3. Check `Import Exceptions` and workbook sheet coverage before calling missing samples or inventory an importer defect.
4. Do not run overlapping OpenNext builds/deployments; one build can remove another process's worker artifact.
5. Keep the local numeric **Item #** separate from the internal building-prefixed inventory identifier.
6. A removal action may omit a photo; conditions with photographable evidence should retain their photo requirement.

## Workstream registry

| Workstream | Related task | Status | Coordination note |
|---|---|---|---|
| Imports, inventory semantics, and field inspection | `Import project data` | Active reference | Holds the Item # branch and the uncommitted removal-photo change. |
| UX, PDF packets, and building workflow | `Implement requested changes` | Completed reference | Contains the deployed field-packet and floor-plan work. |
| Git history and deployment groundwork | `Sync Strata with GitHub` | Completed reference | Use for earlier sync/push history; check current branch state before acting. |

## Next decision queue

1. Approve the removal-photo change for commit, deployment, and authenticated production validation.
2. Decide whether to merge/deploy the Item # normalization branch, then audit its impact on production records.
3. If West 1707 is still required, provide or identify its source workbook so the scoped import can be preflighted.
4. Start the inspection/backfill correctness work before any large historical-inspection import.
