import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";

const [workbookPath, buildingId, mode] = process.argv.slice(2);
if (!workbookPath || !buildingId) throw new Error("Usage: tsx scripts/import-building-inventory-workbook.ts <workbook.xlsx> <building-id> [--apply]");
const apply = mode === "--apply";
const structureOnly = mode === "--structure";
const quote = (value: unknown) => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const query = <T>(sql: string) => JSON.parse(execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", "--command", sql, "--json"], { encoding: "utf8" })) as Array<{ results: T[] }>;
const value = (row: unknown[], index: number) => String(row[index] ?? "").trim();
const itemNumber = (raw: string) => raw.padStart(2, "0");
const quantity = (raw: string) => /^\s*[\d,.]+\s*$/.test(raw) ? Number(raw.replaceAll(",", "")) : null;
const unit = (raw: string) => ({ sqft: "SF", sf: "SF", lf: "LF", ea: "EA", qty: "EA" }[raw.toLowerCase().replaceAll(" ", "")] || "EA");
const fibers = (raw: string) => raw.split(",").map((part) => part.trim()).filter(Boolean);
const concentration = (raw: string) => raw.match(/[\d.]+/g)?.map(Number).filter(Number.isFinite) ?? [];

type InventoryRow = { item: string; sample: string; status: string; location: string; material: string; quantityRaw: string; uom: string; floor: string };
type ResultRow = { sample: string; location: string; fiberTypes: string[]; concentrationRaw: string };

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const quantities = XLSX.utils.sheet_to_json(workbook.Sheets["Estimated Quantities"], { header: 1, defval: "", raw: false }) as unknown[][];
  const results = XLSX.utils.sheet_to_json(workbook.Sheets["Sample Results"], { header: 1, defval: "", raw: false }) as unknown[][];
  if (!quantities.length || !results.length) throw new Error("Workbook must contain Estimated Quantities and Sample Results sheets");

  let floor = "Unspecified";
  const inventory = quantities.flatMap((row): InventoryRow[] => {
    const label = row.map((cell) => String(cell ?? "").trim()).find((cell) => /^(First Floor|Basement)$/i.test(cell)) || "";
    if (/^(First Floor|Basement)$/i.test(label)) floor = label;
    const item = value(row, 2);
    if (!/^\d+$/.test(item)) return [];
    return [{ item: itemNumber(item), sample: value(row, 3), status: value(row, 4), location: value(row, 5), material: value(row, 6), quantityRaw: value(row, 7), uom: value(row, 8), floor }];
  });
  const duplicateItems = inventory.map((row) => row.item).filter((item, index, all) => all.indexOf(item) !== index);
  if (duplicateItems.length) throw new Error(`Workbook contains duplicate item # ${duplicateItems[0]}`);
  const sampleResults = results.flatMap((row): ResultRow[] => {
    const sample = value(row, 1);
    if (!sample || /^Sample Number$/i.test(sample)) return [];
    return [{ sample, location: value(row, 2), fiberTypes: fibers(value(row, 3)), concentrationRaw: value(row, 4) }];
  });

  const building = query<{ organizationId: string; clientId: string; facilityId: string; buildingNumber: string }>(`SELECT "organizationId" AS organizationId, "clientId" AS clientId, "facilityId" AS facilityId, "buildingNumber" AS buildingNumber FROM "Building" WHERE id = ${quote(buildingId)};`)[0]?.results[0];
  if (!building) throw new Error("Target building not found");
  const floors = query<{ id: string; name: string }>(`SELECT id,name FROM "BuildingFloor" WHERE "buildingId" = ${quote(buildingId)};`)[0]?.results ?? [];
  const areas = query<{ floorId: string | null; name: string }>(`SELECT "floorId" AS floorId,name FROM "BuildingArea" WHERE "buildingId" = ${quote(buildingId)};`)[0]?.results ?? [];
  const existing = query<{ id: string; inventoryCode: string }>(`SELECT id, "inventoryCode" AS inventoryCode FROM "InventoryItem" WHERE "buildingId" = ${quote(buildingId)};`)[0]?.results ?? [];
  const existingByCode = new Map(existing.map((row) => [row.inventoryCode, row]));
  const workbookItemBySample = new Map(inventory.filter((row) => row.sample && row.sample !== "PACM").map((row) => [row.sample, row]));
  const adds = inventory.filter((row) => !existingByCode.has(row.item));
  const updates = inventory.filter((row) => existingByCode.has(row.item));
  const unmatchedSamples = sampleResults.filter((row) => !workbookItemBySample.has(row.sample));
  const resultLinks = sampleResults.filter((row) => workbookItemBySample.has(row.sample));

  const floorNames = [...new Set(inventory.map((row) => row.floor))];
  const areasToCreate = new Set(inventory.map((row) => `${row.floor}|${row.location}`));
  console.log(JSON.stringify({ building: building.buildingNumber, workbookItems: inventory.length, existingItems: existing.length, updates: updates.length, additions: adds.length, laboratoryResults: sampleResults.length, linkedResults: resultLinks.length, floors: floorNames, functionalAreas: areasToCreate.size, existingFloorRecords: floors.length, existingAreaRecords: areas.length, unmatchedResults: unmatchedSamples.map((row) => row.sample) }, null, 2));
  if (!apply && !structureOnly) return;

  const statements: string[] = [];
  if (structureOnly) {
    const floorIds = new Map(floors.map((row) => [row.name, row.id]));
    for (const floorName of floorNames) {
      if (floorIds.has(floorName)) continue;
      const id = randomUUID(); floorIds.set(floorName, id);
      const level = floorName === "Basement" ? -1 : floorName === "First Floor" ? 1 : 0;
      statements.push(`INSERT INTO "BuildingFloor" (id,"buildingId",name,level) VALUES (${[id, buildingId, floorName, level].map(quote).join(",")});`);
    }
    const existingAreas = new Set(areas.map((row) => `${row.floorId ?? ""}|${row.name}`));
    for (const key of areasToCreate) {
      const [floorName, name] = key.split("|");
      const floorId = floorIds.get(floorName)!;
      if (existingAreas.has(`${floorId}|${name}`)) continue;
      statements.push(`INSERT INTO "BuildingArea" (id,"buildingId","floorId",name,"areaType") VALUES (${[randomUUID(), buildingId, floorId, name, "room"].map(quote).join(",")});`);
    }
    for (const row of inventory) statements.push(`UPDATE "InventoryItem" SET floor=${quote(row.floor)},area=${quote(row.location)},"updatedAt"=CURRENT_TIMESTAMP WHERE "buildingId"=${quote(buildingId)} AND "inventoryCode"=${quote(row.item)};`);
  }
  if (!apply) {
    const dir = await mkdtemp(join(tmpdir(), "strata-1707-structure-"));
    const sqlFile = join(dir, "structure.sql");
    try { await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 }); execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", "--file", sqlFile], { stdio: "inherit" }); } finally { await rm(dir, { recursive: true, force: true }); }
    return;
  }
  for (const row of inventory) {
    const currentQuantity = quantity(row.quantityRaw);
    const status = row.status.toLowerCase() === "removed" ? "removed" : "active";
    const classification = row.sample === "PACM" ? "pacm" : "confirmed_acm";
    const condition = row.status.toLowerCase() === "removed" ? "removed" : "good";
    const notes = [row.quantityRaw && currentQuantity == null ? `Source quantity: ${row.quantityRaw}` : "", "Imported from 1707 Inventory.xlsx"].filter(Boolean).join(" · ");
    const fields = `"materialDescription"=${quote(row.material)},floor=${quote(row.floor)},"specificLocation"=${quote(row.location)},"currentQuantity"=${quote(currentQuantity)},"originalQuantity"=${quote(currentQuantity)},"quantityUnit"=${quote(unit(row.uom))},"acmClassification"=${quote(classification)},condition=${quote(condition)},friable=${quote(row.sample === "PACM" ? "non_friable" : null)},"recordStatus"=${quote(status)},notes=${quote(notes)},"updatedAt"=CURRENT_TIMESTAMP`;
    const existingItem = existingByCode.get(row.item);
    if (existingItem) statements.push(`UPDATE "InventoryItem" SET ${fields} WHERE id=${quote(existingItem.id)};`);
    else statements.push(`INSERT INTO "InventoryItem" (id,"organizationId","clientId","facilityId","buildingId","inventoryCode","internalCode","materialDescription",floor,"specificLocation","currentQuantity","originalQuantity","quantityUnit","materialCategory","acmClassification",condition,friable,"recordStatus",notes,"updatedAt") VALUES (${[randomUUID(), building.organizationId, building.clientId, building.facilityId, buildingId, row.item, `${building.buildingNumber}-${row.item}`, row.material, row.floor, row.location, currentQuantity, currentQuantity, unit(row.uom), "Miscellaneous", classification, condition, row.sample === "PACM" ? "non_friable" : null, status, notes].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  }
  for (const result of resultLinks) {
    const item = workbookItemBySample.get(result.sample)!;
    const itemId = existingByCode.get(item.item)?.id;
    const sampleId = randomUUID();
    const layerId = randomUUID();
    const resultId = randomUUID();
    const concentrationValues = concentration(result.concentrationRaw);
    const asbestosPercent = concentrationValues.length ? concentrationValues.reduce((sum, n) => sum + n, 0) : null;
    const comments = `Source concentration: ${result.concentrationRaw || "not stated"}; imported from 1707 Inventory.xlsx`;
    statements.push(`INSERT INTO "Sample" (id,"organizationId","clientId","buildingId","sampleNumber",material,"materialDescription",location,"collectionDate",analysisMethod,status,notes,"updatedAt") VALUES (${[sampleId, building.organizationId, building.clientId, buildingId, result.sample, item.material, result.location, result.location, "2026-08-12T00:00:00.000Z", "PLM", "results_received", "Imported from 1707 Inventory.xlsx; original collection date not provided"].map(quote).join(",")},CURRENT_TIMESTAMP);`);
    statements.push(`INSERT INTO "SampleLayer" (id,"sampleId","layerNumber",description,"asbestosDetected","asbestosPercent","fiberTypes",classification,comments) VALUES (${[layerId, sampleId, 1, item.material, 1, asbestosPercent, JSON.stringify(result.fiberTypes), "confirmed_acm", comments].map(quote).join(",")});`);
    statements.push(`INSERT INTO "SampleResult" (id,"sampleLayerId","asbestosDetected","asbestosPercent","fiberTypes",method,"labComments") VALUES (${[resultId, layerId, 1, asbestosPercent, JSON.stringify(result.fiberTypes), "PLM", comments].map(quote).join(",")});`);
    statements.push(`UPDATE "InventoryItem" SET "asbestosDetected"=1,"asbestosPercent"=${quote(asbestosPercent)},"fiberTypes"=${quote(JSON.stringify(result.fiberTypes))},"analyticalMethod"='PLM',"acmClassification"='confirmed_acm',"updatedAt"=CURRENT_TIMESTAMP WHERE "buildingId"=${quote(buildingId)} AND "inventoryCode"=${quote(item.item)};`);
    statements.push(`INSERT INTO "SampleInventoryLink" (id,"sampleId","inventoryItemId","layerNumber","linkType") SELECT ${quote(randomUUID())},${quote(sampleId)},id,1,'supporting' FROM "InventoryItem" WHERE "buildingId"=${quote(buildingId)} AND "inventoryCode"=${quote(item.item)};`);
  }
  const dir = await mkdtemp(join(tmpdir(), "strata-1707-import-"));
  const sqlFile = join(dir, "import.sql");
  try {
    await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 });
    execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", "--file", sqlFile], { stdio: "inherit" });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
