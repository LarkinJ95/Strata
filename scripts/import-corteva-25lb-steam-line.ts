import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";

const workbookPath = process.argv[2];
const apply = process.argv.includes("--apply");
if (!workbookPath) throw new Error("Usage: tsx scripts/import-corteva-25lb-steam-line.ts <workbook.xlsx> [--apply]");

const clientName = "Corteva";
const facilityName = "I-Park Steam Lines";
const facilityCode = "I-Park Steam";
const buildingNumber = "25 lb Steam";
const floorName = "Exterior Steam Lines";

const text = (value: unknown) => String(value ?? "").trim();
const quote = (value: string | number | null) => value == null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
const id = () => crypto.randomUUID();
const command = (args: string[]) => execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", ...args], { encoding: "utf8" });
const query = <T>(sql: string) => (JSON.parse(command(["--command", sql, "--json"])) as Array<{ results: T[] }>)[0]?.results ?? [];

type Circuit = { number: string; location: string; material: string; lineSize: string };

function circuits(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["Estimated Quantities"];
  if (!sheet) throw new Error("Missing Estimated Quantities sheet");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headerIndex = rows.findIndex((row) => text(row[0]).toUpperCase() === "CIRCUIT #");
  if (headerIndex < 0) throw new Error("Estimated Quantities does not contain a CIRCUIT # header");
  const parsed = rows.slice(headerIndex + 1).flatMap((row): Circuit[] => {
    const rawNumber = text(row[0]);
    if (!/^\d+$/.test(rawNumber)) return [];
    const location = text(row[1]);
    const material = text(row[2]);
    const lineSize = text(row[3]);
    if (!location || !material) throw new Error(`Circuit ${rawNumber} is missing a location or material`);
    return [{ number: rawNumber.padStart(2, "0"), location, material, lineSize }];
  });
  if (!parsed.length) throw new Error("No circuit inventory rows found");
  const duplicates = parsed.filter((circuit, index) => parsed.findIndex((candidate) => candidate.number === circuit.number) !== index);
  if (duplicates.length) throw new Error(`Duplicate circuit number ${duplicates[0].number}`);
  return parsed;
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const expectedSheets = ["Positive Samples", "Estimated Quantities", "Annual Inspection Report"];
  const missingSheets = expectedSheets.filter((name) => !workbook.SheetNames.includes(name));
  if (missingSheets.length) throw new Error(`Missing required sheet(s): ${missingSheets.join(", ")}`);
  const inventory = circuits(workbook);

  const client = query<{ id: string; organizationId: string }>(`SELECT id,"organizationId" AS organizationId FROM "Client" WHERE name=${quote(clientName)} LIMIT 2;`);
  if (client.length !== 1) throw new Error(`Expected exactly one ${clientName} client; found ${client.length}`);
  const facility = query<{ id: string; clientId: string }>(`SELECT id,"clientId" AS clientId FROM "Facility" WHERE name=${quote(facilityName)} AND "facilityId"=${quote(facilityCode)} LIMIT 2;`);
  if (facility.length !== 1 || facility[0].clientId !== client[0].id) throw new Error(`Expected ${facilityName} (${facilityCode}) to belong to ${clientName}`);
  const buildings = query<{ id: string; clientId: string; facilityId: string }>(`SELECT id,"clientId" AS clientId,"facilityId" AS facilityId FROM "Building" WHERE "organizationId"=${quote(client[0].organizationId)} AND "buildingNumber"=${quote(buildingNumber)} LIMIT 2;`);
  if (buildings.length > 1) throw new Error(`More than one building uses number ${buildingNumber}`);
  if (buildings.length && (buildings[0].clientId !== client[0].id || buildings[0].facilityId !== facility[0].id)) throw new Error(`Building ${buildingNumber} already belongs to another client or facility`);

  const buildingId = buildings[0]?.id ?? id();
  const existingFloors = buildings.length ? query<{ id: string; name: string }>(`SELECT id,name FROM "BuildingFloor" WHERE "buildingId"=${quote(buildingId)};`) : [];
  const existingFloor = existingFloors.find((floor) => floor.name === floorName);
  const floorId = existingFloor?.id ?? id();
  const existingAreas = buildings.length ? query<{ id: string; faCode: string | null }>(`SELECT id,"faCode" AS faCode FROM "BuildingArea" WHERE "buildingId"=${quote(buildingId)};`) : [];
  const existingAreasByCode = new Map(existingAreas.filter((area) => area.faCode).map((area) => [area.faCode!, area]));
  const existingInventory = buildings.length ? query<{ id: string; inventoryCode: string; internalCode: string | null }>(`SELECT id,"inventoryCode" AS inventoryCode,"internalCode" AS internalCode FROM "InventoryItem" WHERE "buildingId"=${quote(buildingId)};`) : [];
  const existingInventoryByCode = new Map(existingInventory.map((item) => [item.inventoryCode, item]));
  const internalCodes = inventory.map((circuit) => `${buildingNumber}-${circuit.number}`);
  const collisions = query<{ internalCode: string; buildingId: string }>(`SELECT "internalCode" AS internalCode,"buildingId" AS buildingId FROM "InventoryItem" WHERE "internalCode" IN (${internalCodes.map(quote).join(",")});`).filter((item) => item.buildingId !== buildingId);
  if (collisions.length) throw new Error(`Internal inventory code collision: ${collisions[0].internalCode}`);

  const statements: string[] = [];
  if (!buildings.length) statements.push(`INSERT INTO "Building" ("id","organizationId","clientId","facilityId",name,"buildingNumber","floorsCount","buildingUse","occupancyStatus","photoPolicy","surveyStatus","managementPlanStatus","inspectionIntervalDays",notes,"updatedAt") VALUES (${[buildingId, client[0].organizationId, client[0].id, facility[0].id, buildingNumber, buildingNumber, 1, "Exterior steam distribution", "occupied", "permitted", "partial", "attention", 365, `Imported from ${workbookPath.split("/").at(-1)}; source inspection conditions and labels were blank.`].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  if (!existingFloor) statements.push(`INSERT INTO "BuildingFloor" (id,"buildingId",name,level,occupancy,notes) VALUES (${[floorId, buildingId, floorName, 0, "exterior", "Created for the 25 lb steam-line circuit inventory."].map(quote).join(",")});`);

  let createdAreas = 0;
  let createdInventory = 0;
  for (const circuit of inventory) {
    const faCode = `C-${circuit.number}`;
    const existingArea = existingAreasByCode.get(faCode);
    const areaId = existingArea?.id ?? id();
    if (!existingArea) {
      createdAreas += 1;
      statements.push(`INSERT INTO "BuildingArea" (id,"buildingId","floorId","faCode",name,"areaType","useDescription",notes) VALUES (${[areaId, buildingId, floorId, faCode, circuit.location, "exterior", "Steam-line circuit", `Circuit ${circuit.number}; line size: ${circuit.lineSize || "not provided"}.`].map(quote).join(",")});`);
    }
    if (existingInventoryByCode.has(circuit.number)) continue;
    createdInventory += 1;
    statements.push(`INSERT INTO "InventoryItem" (id,"organizationId","clientId","facilityId","buildingId","functionalAreaId","inventoryCode","internalCode",floor,area,"specificLocation","materialCategory","materialDescription","acmClassification","fiberTypes",friable,"quantityUnit",condition,accessibility,"disturbancePotential","responseAction","isProvisional","recordStatus",notes,"updatedAt") VALUES (${[id(), client[0].organizationId, client[0].id, facility[0].id, buildingId, areaId, circuit.number, `${buildingNumber}-${circuit.number}`, floorName, faCode, circuit.location, "Thermal System Insulation", circuit.material, "assumed_acm", "[]", "non_friable", "EA", "unable_to_inspect", "accessible", "low", "Further sampling", 1, "active", `Circuit ${circuit.number}; line size: ${circuit.lineSize || "not provided"}; source quantity and UOM not populated; annual condition and labeling fields blank. Imported from ${workbookPath.split("/").at(-1)}.`].map(quote).join(",")},CURRENT_TIMESTAMP);`);
  }

  const summary = JSON.stringify({ mode: apply ? "apply" : "dry-run", building: buildings.length ? "reused" : "created", floors: existingFloor ? 0 : 1, functionalAreas: createdAreas, inventory: createdInventory, skippedInventory: inventory.length - createdInventory, source: { circuits: inventory.length, positiveSamples: 0, annualConditionsReported: 0, importExceptionsSheet: workbook.SheetNames.includes("Import Exceptions") } });
  if (apply) {
    statements.push(`INSERT INTO "ImportJob" (id,"organizationId",kind,status,filename,summary) VALUES (${[id(), client[0].organizationId, "corteva_25lb_steam_line_xlsx", "completed", workbookPath.split("/").at(-1)!, summary].map(quote).join(",")});`);
    const directory = await mkdtemp(join(tmpdir(), "strata-corteva-25lb-"));
    const sqlFile = join(directory, "import.sql");
    try {
      await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 });
      command(["--file", sqlFile]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  console.log(JSON.stringify({ ...JSON.parse(summary), statements: statements.length }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
