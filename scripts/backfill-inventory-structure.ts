import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const quote = (value: string | number | null) => value == null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
const command = (args: string[]) => execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", ...args], { encoding: "utf8" });
const query = <T>(sql: string) => (JSON.parse(command(["--command", sql, "--json"])) as Array<{ results: T[] }>)[0]?.results ?? [];

type Item = { id: string; buildingId: string; floor: string | null; area: string | null; specificLocation: string | null };
type Floor = { id: string; buildingId: string; name: string; level: number };
type Area = { id: string; buildingId: string; floorId: string | null; name: string };

const normalized = (value: string | null) => value?.trim() || "Unspecified";
const key = (...values: string[]) => values.map((value) => value.trim().toLocaleLowerCase()).join("\u0000");
const levelFor = (name: string) => /basement/i.test(name) ? -1 : /(?:^|\s)(?:first|1st|1)(?:\s|$)/i.test(name) ? 1 : 0;

async function main() {
  const organization = query<{ id: string }>(`SELECT id FROM "Organization" WHERE slug='bierlein';`)[0];
  if (!organization) throw new Error("Organization bierlein was not found");
  const items = query<Item>(`SELECT id,"buildingId" AS buildingId,floor,area,"specificLocation" AS specificLocation FROM "InventoryItem" WHERE "organizationId"=${quote(organization.id)} AND "functionalAreaId" IS NULL;`);
  const floors = query<Floor>(`SELECT f.id,f."buildingId" AS buildingId,f.name,f.level FROM "BuildingFloor" f JOIN "Building" b ON b.id=f."buildingId" WHERE b."organizationId"=${quote(organization.id)};`);
  const areas = query<Area>(`SELECT a.id,a."buildingId" AS buildingId,a."floorId" AS floorId,a.name FROM "BuildingArea" a JOIN "Building" b ON b.id=a."buildingId" WHERE b."organizationId"=${quote(organization.id)};`);

  const missingLocation = items.filter((item) => !(item.specificLocation || item.area)?.trim());
  if (missingLocation.length) throw new Error(`${missingLocation.length} unassigned materials have no source location or area text; no writes were made.`);

  const floorIds = new Map(floors.map((floor) => [key(floor.buildingId, floor.name), floor.id]));
  const areaIds = new Map(areas.map((area) => [key(area.buildingId, area.floorId ?? "", area.name), area.id]));
  const statements: string[] = [];
  let floorsCreated = 0;
  let areasCreated = 0;
  for (const item of items) {
    const floorName = normalized(item.floor);
    const floorKey = key(item.buildingId, floorName);
    let floorId = floorIds.get(floorKey);
    if (!floorId) {
      floorId = randomUUID();
      floorIds.set(floorKey, floorId);
      floorsCreated += 1;
      statements.push(`INSERT INTO "BuildingFloor" (id,"buildingId",name,level,notes) VALUES (${[floorId, item.buildingId, floorName, levelFor(floorName), "Created from imported inventory floor text during structure backfill."].map(quote).join(",")});`);
    }
    // The master imports contain no structured FunctionalAreas rows. Reuse the exact
    // source location text as the per-building FA name; never alter the inventory's
    // detailed location fields and never share an area across buildings.
    const areaName = normalized(item.area) === "Unspecified" ? normalized(item.specificLocation) : normalized(item.area);
    const areaKey = key(item.buildingId, floorId, areaName);
    let areaId = areaIds.get(areaKey);
    if (!areaId) {
      areaId = randomUUID();
      areaIds.set(areaKey, areaId);
      areasCreated += 1;
      statements.push(`INSERT INTO "BuildingArea" (id,"buildingId","floorId",name,"areaType",notes) VALUES (${[areaId, item.buildingId, floorId, areaName, "source_location", "Created from exact imported inventory location text during structure backfill."].map(quote).join(",")});`);
    }
    statements.push(`UPDATE "InventoryItem" SET "functionalAreaId"=${quote(areaId)},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${quote(item.id)} AND "functionalAreaId" IS NULL;`);
  }
  const report = { mode: apply ? "apply" : "dry-run", unassignedBefore: items.length, floorsCreated, functionalAreasCreated: areasCreated, assignmentsPlanned: items.length, sourceExceptions: { missingStructuredFunctionalAreas: true, materialsUsingExactLocationFallback: items.length, missingLocation: missingLocation.length } };
  console.log(JSON.stringify(report, null, 2));
  if (!apply || !statements.length) return;
  const directory = await mkdtemp(join(tmpdir(), "strata-structure-backfill-"));
  const sqlFile = join(directory, "backfill.sql");
  try {
    await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 });
    command(["--file", sqlFile]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
