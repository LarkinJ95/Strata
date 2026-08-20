import assert from "node:assert/strict";
import {
  inspectionScheduleFor,
  latestCompletedInspectionDate,
  summarizeInspectionConditions,
} from "../src/lib/inspection-lifecycle";

const older = new Date("2023-04-01T12:00:00.000Z");
const newest = new Date("2025-05-15T12:00:00.000Z");
assert.deepEqual(latestCompletedInspectionDate([older, newest]), newest, "an older historical entry cannot become last inspected");
assert.equal(inspectionScheduleFor(newest, 365).nextInspectionAt.toISOString(), "2026-05-15T12:00:00.000Z");
assert.equal(summarizeInspectionConditions(["good", "good"]), "good");
assert.equal(summarizeInspectionConditions(["good", "needs_repair"]), "needs_repair");
assert.equal(summarizeInspectionConditions([null, undefined]), "no_results");
console.log("Inspection lifecycle fixtures passed.");
