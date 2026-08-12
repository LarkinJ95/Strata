import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";

type Row = Record<string, unknown>;
const input = process.argv[2];
const argumentsAfterInput = process.argv.slice(3);
const merge = argumentsAfterInput.includes("--merge");
const organizationSlug = (argumentsAfterInput.find((argument) => !argument.startsWith("--")) || "bierlein").toLowerCase();
if (!input) throw new Error("Usage: tsx scripts/import-production-workbook.ts <workbook.xlsx> [organization-slug] [--merge]");

const text = (value: unknown) => String(value ?? "").trim();
const optional = (value: unknown) => text(value) || null;
const number = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${raw}`);
  return parsed;
};
const bool = (value: unknown) => {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  if (["yes", "true", "1"].includes(raw)) return 1;
  if (["no", "false", "0"].includes(raw)) return 0;
  throw new Error(`Invalid boolean: ${raw}`);
};
const quote = (value: string | number | null) => value == null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
const id = () => crypto.randomUUID();

function rows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Missing required sheet: ${name}`);
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
}
function requireField(row: Row, field: string, label: string) {
  const value = text(row[field]);
  if (!value) throw new Error(`${label} is required`);
  return value;
}
function duplicates(values: string[]) { return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]; }
function command(args: string[]) { return execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", ...args], { encoding: "utf8" }); }
function query<T>(sql: string) { return (JSON.parse(command(["--command", sql, "--json"])) as Array<{ results: T[] }>)[0]?.results || []; }
function inList(values: string[]) { return values.length ? values.map(quote).join(",") : "NULL"; }

async function main() {
  const workbook = XLSX.readFile(input, { cellDates: true });
  const clients = rows(workbook, "Clients");
  const facilities = rows(workbook, "Facilities");
  const buildings = rows(workbook, "Buildings");
  const floors = rows(workbook, "Floors");
  const inventory = rows(workbook, "Inventory");
  const invalid = [
    ...clients.filter((row) => !text(row.client_number) || !text(row.name)),
    ...facilities.filter((row) => !text(row.client_number) || !text(row.facility_id) || !text(row.name)),
    ...buildings.filter((row) => !text(row.client_number) || !text(row.facility_id) || !text(row.building_number) || !text(row.name)),
    ...inventory.filter((row) => !text(row.client_number) || !text(row.building_number) || !text(row.inventory_code) || !text(row.material_description)),
  ];
  if (invalid.length) throw new Error(`${invalid.length} rows are missing required fields`);
  const duplicateInventory = duplicates(inventory.map((row) => text(row.inventory_code)));
  const duplicateBuildings = duplicates(buildings.map((row) => text(row.building_number)));
  if (duplicateInventory.length || duplicateBuildings.length) throw new Error(`Duplicate identifiers: ${[...duplicateInventory, ...duplicateBuildings].join(", ")}`);

  const facilitiesBySourceId = new Map(facilities.map((row) => [text(row.facility_id).toLowerCase(), row]));
  const buildingsByNumber = new Map(buildings.map((row) => [text(row.building_number), row]));
  for (const row of buildings) if (!facilitiesBySourceId.has(text(row.facility_id).toLowerCase())) throw new Error(`Building references unknown facility: ${text(row.facility_id)}`);
  for (const row of [...floors, ...inventory]) if (!buildingsByNumber.has(text(row.building_number))) throw new Error(`Row references unknown building: ${text(row.building_number)}`);

  const organizationId = query<{ id: string }>(`SELECT id FROM \"Organization\" WHERE slug = ${quote(organizationSlug)};`)[0]?.id;
  if (!organizationId) throw new Error(`Organization not found: ${organizationSlug}`);
  const clientCodes = clients.map((row) => text(row.client_number));
  const inventoryCodes = inventory.map((row) => text(row.inventory_code));
  const existing = query<{ type: string; code: string }>(`SELECT 'client' AS type, \"clientNumber\" AS code FROM \"Client\" WHERE \"organizationId\" = ${quote(organizationId)} AND \"clientNumber\" IN (${inList(clientCodes)}) UNION ALL SELECT 'inventory', \"inventoryCode\" FROM \"InventoryItem\" WHERE \"organizationId\" = ${quote(organizationId)} AND \"inventoryCode\" IN (${inList(inventoryCodes)});`);
  if (!merge && existing.length) throw new Error(`Import stopped: existing ${existing[0].type} code ${existing[0].code}. This importer never merges records. Use --merge only for an additive import that preserves existing records.`);

  const clientIds = new Map<string, string>();
  const facilityIds = new Map<string, string>();
  const buildingIds = new Map<string, string>();
  const existingClients = merge ? query<{ id: string; clientNumber: string }>(`SELECT id, \"clientNumber\" AS clientNumber FROM \"Client\" WHERE \"organizationId\" = ${quote(organizationId)} AND \"clientNumber\" IN (${inList(clientCodes)});`) : [];
  const existingFacilities = merge ? query<{ id: string; clientId: string; facilityId: string }>(`SELECT id, \"clientId\" AS clientId, \"facilityId\" AS facilityId FROM \"Facility\" WHERE \"organizationId\" = ${quote(organizationId)} AND \"facilityId\" IN (${inList(facilities.map((row) => text(row.facility_id)))});`) : [];
  const existingBuildings = merge ? query<{ id: string; clientId: string; facilityId: string; buildingNumber: string }>(`SELECT id, \"clientId\" AS clientId, \"facilityId\" AS facilityId, \"buildingNumber\" AS buildingNumber FROM \"Building\" WHERE \"organizationId\" = ${quote(organizationId)} AND \"buildingNumber\" IN (${inList(buildings.map((row) => text(row.building_number)))});`) : [];
  const existingFloors = merge ? query<{ buildingId: string; name: string; level: number }>(`SELECT \"buildingId\" AS buildingId, name, level FROM \"BuildingFloor\" WHERE \"buildingId\" IN (${inList(existingBuildings.map((building) => building.id))});`) : [];
  const existingInventory = merge ? query<{ inventoryCode: string; buildingId: string }>(`SELECT \"inventoryCode\" AS inventoryCode, \"buildingId\" AS buildingId FROM \"InventoryItem\" WHERE \"organizationId\" = ${quote(organizationId)} AND \"inventoryCode\" IN (${inList(inventoryCodes)});`) : [];
  const existingClientsByCode = new Map(existingClients.map((client) => [client.clientNumber, client]));
  const existingFacilitiesByCode = new Map(existingFacilities.map((facility) => [facility.facilityId.toLowerCase(), facility]));
  const existingBuildingsByNumber = new Map(existingBuildings.map((building) => [building.buildingNumber, building]));
  const existingFloorsByKey = new Set(existingFloors.map((floor) => `${floor.buildingId}|${floor.name}|${floor.level}`));
  const existingInventoryByCode = new Map(existingInventory.map((item) => [item.inventoryCode, item]));
  // The D1 SQL endpoint rejects explicit BEGIN/COMMIT statements. The batch below
  // is fully preflighted (including duplicate and relationship checks) before any
  // write is submitted.
  const statements: string[] = [];
  for (const row of clients) {
    const sourceCode = text(row.client_number);
    const existingClient = existingClientsByCode.get(sourceCode);
    if (existingClient) { clientIds.set(sourceCode, existingClient.id); continue; }
    const clientId = id(); clientIds.set(sourceCode, clientId);
    statements.push(`INSERT INTO "Client" ("id","organizationId","name","clientNumber","primaryContact","primaryEmail","primaryPhone","secondaryContact","secondaryEmail","secondaryPhone","address","city","state","postalCode","notes","inspectionReqs","reportingReqs","photoPolicy","status","updatedAt") VALUES (${[clientId, organizationId, requireField(row, "name", "Client name"), requireField(row, "client_number", "Client number"), optional(row.primary_contact), optional(row.primary_email), optional(row.primary_phone), optional(row.secondary_contact), optional(row.secondary_email), optional(row.secondary_phone), optional(row.address), optional(row.city), optional(row.state), optional(row.postal_code), optional(row.notes), optional(row.inspection_reqs), optional(row.reporting_reqs), text(row.photo_policy) || "permitted", text(row.status) || "active"].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  }
  for (const row of facilities) {
    const sourceId = requireField(row, "facility_id", "Facility ID").toLowerCase();
    const expectedClientId = clientIds.get(requireField(row, "client_number", "Facility client number"))!;
    const existingFacility = existingFacilitiesByCode.get(sourceId);
    if (existingFacility) {
      if (existingFacility.clientId !== expectedClientId) throw new Error(`Facility ${text(row.facility_id)} belongs to a different client in production`);
      facilityIds.set(sourceId, existingFacility.id); continue;
    }
    const facilityId = id(); facilityIds.set(sourceId, facilityId);
    statements.push(`INSERT INTO "Facility" ("id","organizationId","clientId","name","facilityId","address","city","state","postalCode","latitude","longitude","primaryContact","environmentalContact","emergencyContact","notes","status","updatedAt") VALUES (${[facilityId, organizationId, expectedClientId, requireField(row, "name", "Facility name"), requireField(row, "facility_id", "Facility ID"), optional(row.address), optional(row.city), optional(row.state), optional(row.postal_code), number(row.latitude), number(row.longitude), optional(row.primary_contact), optional(row.environmental_contact), optional(row.emergency_contact), optional(row.notes), text(row.status) || "active"].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  }
  for (const row of buildings) {
    const buildingNumber = requireField(row, "building_number", "Building number");
    const facilitySourceId = requireField(row, "facility_id", "Building facility ID").toLowerCase();
    const expectedClientId = clientIds.get(requireField(row, "client_number", "Building client number"))!;
    const expectedFacilityId = facilityIds.get(facilitySourceId)!;
    const existingBuilding = existingBuildingsByNumber.get(buildingNumber);
    if (existingBuilding) {
      if (existingBuilding.clientId !== expectedClientId || existingBuilding.facilityId !== expectedFacilityId) throw new Error(`Building ${buildingNumber} has a different parent in production`);
      buildingIds.set(buildingNumber, existingBuilding.id); continue;
    }
    const buildingId = id(); buildingIds.set(buildingNumber, buildingId);
    statements.push(`INSERT INTO "Building" ("id","organizationId","clientId","facilityId","name","buildingNumber","address","yearConstructed","squareFootage","floorsCount","buildingUse","occupancyStatus","photoPolicy","surveyStatus","managementPlanStatus","inspectionIntervalDays","notes","updatedAt") VALUES (${[buildingId, organizationId, expectedClientId, expectedFacilityId, requireField(row, "name", "Building name"), buildingNumber, optional(row.address), number(row.year_constructed), number(row.square_footage), number(row.floors_count), optional(row.building_use), text(row.occupancy_status) || "occupied", text(row.photo_policy) || "permitted", text(row.survey_status) || "complete", text(row.management_plan_status) || "current", number(row.inspection_interval_days) ?? 365, optional(row.notes)].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  }
  let insertedClients = clients.length - existingClients.length;
  let insertedFacilities = 0, insertedBuildings = 0, insertedFloors = 0, insertedInventory = 0;
  for (const row of facilities) if (!existingFacilitiesByCode.has(text(row.facility_id).toLowerCase())) insertedFacilities += 1;
  for (const row of buildings) if (!existingBuildingsByNumber.has(text(row.building_number))) insertedBuildings += 1;
  for (const row of floors) {
    const buildingId = buildingIds.get(requireField(row, "building_number", "Floor building number"))!;
    const key = `${buildingId}|${requireField(row, "floor_name", "Floor name")}|${number(row.level) ?? 0}`;
    if (existingFloorsByKey.has(key)) continue;
    insertedFloors += 1;
    statements.push(`INSERT INTO "BuildingFloor" ("id","buildingId","name","level","occupancy","squareFootage","notes") VALUES (${[id(), buildingId, requireField(row, "floor_name", "Floor name"), number(row.level) ?? 0, optional(row.occupancy), number(row.square_footage), optional(row.notes)].map(quote).join(",")});`);
  }
  for (const row of inventory) {
    const building = buildingsByNumber.get(requireField(row, "building_number", "Inventory building number"))!;
    const buildingId = buildingIds.get(text(row.building_number))!;
    const clientId = clientIds.get(requireField(row, "client_number", "Inventory client number"))!;
    const facilityId = facilityIds.get(text(building.facility_id).toLowerCase())!;
    const existingItem = existingInventoryByCode.get(text(row.inventory_code));
    if (existingItem) {
      if (existingItem.buildingId !== buildingId) throw new Error(`Inventory ${text(row.inventory_code)} belongs to a different building in production`);
      continue;
    }
    insertedInventory += 1;
    statements.push(`INSERT INTO "InventoryItem" ("id","organizationId","clientId","facilityId","buildingId","inventoryCode","floor","room","area","specificLocation","materialCategory","materialDescription","acmClassification","asbestosDetected","fiberTypes","asbestosPercent","friable","materialClass","categoryIorII","analyticalMethod","originalQuantity","currentQuantity","quantityUnit","condition","accessibility","disturbancePotential","labelPresent","labelCondition","responseAction","isProvisional","recordStatus","notes","updatedAt") VALUES (${[id(), organizationId, clientId, facilityId, buildingId, requireField(row, "inventory_code", "Inventory code"), optional(row.floor), optional(row.room), optional(row.fa_code), optional(row.location), text(row.material_category) || "Miscellaneous", requireField(row, "material_description", "Material description"), text(row.acm_classification) || "unknown", bool(row.asbestos_detected), JSON.stringify(text(row.fiber_types).split(";").map((item) => item.trim()).filter(Boolean)), number(row.asbestos_percent), optional(row.friable), optional(row.material_class), optional(row.category_i_or_ii), optional(row.analytical_method), number(row.original_quantity), number(row.current_quantity), text(row.quantity_unit) || "SF", text(row.condition) || "good", optional(row.accessibility), optional(row.disturbance_potential), bool(row.label_present), optional(row.label_condition), optional(row.response_action), bool(row.provisional) ?? 0, text(row.record_status) || "active", optional(row.notes)].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  }
  const summary = JSON.stringify({ merge, clients: insertedClients, facilities: insertedFacilities, buildings: insertedBuildings, floors: insertedFloors, inventory: insertedInventory, skipped: { clients: clients.length - insertedClients, facilities: facilities.length - insertedFacilities, buildings: buildings.length - insertedBuildings, floors: floors.length - insertedFloors, inventory: inventory.length - insertedInventory }, sourceExceptions: rows(workbook, "Import Exceptions").length });
  statements.push(`INSERT INTO "ImportJob" ("id","organizationId","kind","status","filename","summary") VALUES (${[id(), organizationId, "dow_corporate_xlsx", "completed", input.split("/").at(-1)!, summary].map(quote).join(",")});`);
  const directory = await mkdtemp(join(tmpdir(), "strata-import-"));
  const sqlFile = join(directory, "import.sql");
  try {
    await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 });
    command(["--file", sqlFile]);
  } finally { await rm(directory, { recursive: true, force: true }); }
  console.log(`Imported ${insertedClients} clients, ${insertedFacilities} facilities, ${insertedBuildings} buildings, ${insertedFloors} floors, and ${insertedInventory} inventory items into ${organizationSlug}.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
