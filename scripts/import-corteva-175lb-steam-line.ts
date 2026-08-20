import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";

const workbookPath = process.argv[2];
const apply = process.argv.includes("--apply");
const buildingId = "dec8b019-b10c-43f5-abca-4a03362e8d98";
const quote = (v: string | number | null) => v == null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replaceAll("'", "''")}'`;
const text = (v: unknown) => String(v ?? "").trim();
const d1 = (args: string[]) => execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", ...args], { encoding: "utf8" });
const query = <T>(sql: string) => (JSON.parse(d1(["--command", sql, "--json"])) as { results: T[] }[])[0]?.results ?? [];
type Circuit = { code: string; location: string; material: string; lineSize: string; notes: string };
type History = { inspector: string; findings: string; action: string; date: string; next: string; notes: string };

function parse(wb: XLSX.WorkBook) {
  const q = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Estimated Quantities"], { header: 1, defval: "", raw: false });
  const h = q.findIndex((r) => text(r[2]).toUpperCase() === "CIRCUIT #");
  if (h < 0) throw new Error("Estimated Quantities header not found");
  const circuits = q.slice(h + 1).flatMap((r): Circuit[] => /^\d+$/.test(text(r[2])) ? [{ code: text(r[2]).padStart(2, "0"), location: text(r[5]), material: text(r[6]), lineSize: text(r[7]), notes: text(r[11]) }] : []);
  if (circuits.length !== 45 || circuits.some((c) => !c.location || !c.material) || new Set(circuits.map((c) => c.code)).size !== circuits.length) throw new Error("Expected 45 unique, located quantity records");
  const ih = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Inspection History"], { header: 1, defval: "", raw: false });
  const histories = ih.flatMap((r): History[] => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text(r[5])) ? [{ inspector: text(r[1]), findings: text(r[2]), action: text(r[4]), date: text(r[5]), next: text(r[6]), notes: text(r[7]) }] : []);
  return { circuits, histories };
}

async function main() {
  if (!workbookPath) throw new Error("Usage: tsx scripts/import-corteva-175lb-steam-line.ts <workbook.xlsx> [--apply]");
  const wb = XLSX.readFile(workbookPath, { cellDates: true });
  for (const name of ["Estimated Quantities", "Sample Results", "Annual Inspection Report", "Inspection History"]) if (!wb.Sheets[name]) throw new Error(`Missing ${name}`);
  const { circuits, histories } = parse(wb);
  const building = query<{ organizationId: string; clientId: string; facilityId: string; buildingNumber: string }>(`SELECT "organizationId" AS organizationId,"clientId" AS clientId,"facilityId" AS facilityId,"buildingNumber" AS buildingNumber FROM "Building" WHERE id=${quote(buildingId)};`)[0];
  if (!building || building.buildingNumber !== "175lb Steam") throw new Error("Target building identity mismatch");
  const existing = query<{ id: string; inventoryCode: string }>(`SELECT id,"inventoryCode" AS inventoryCode FROM "InventoryItem" WHERE "buildingId"=${quote(buildingId)};`);
  const floors = query<{ id: string; name: string }>(`SELECT id,name FROM "BuildingFloor" WHERE "buildingId"=${quote(buildingId)};`);
  const areas = query<{ id: string; faCode: string | null }>(`SELECT id,"faCode" AS faCode FROM "BuildingArea" WHERE "buildingId"=${quote(buildingId)};`);
  const inspections = query<{ id: string; completedAt: string | null; notes: string | null }>(`SELECT id,"completedAt" AS completedAt,notes FROM "Inspection" WHERE "buildingId"=${quote(buildingId)};`);
  const statements: string[] = []; const floorName = "Exterior Steam Lines"; let floorId = floors.find((f) => f.name === floorName)?.id;
  if (!floorId) { floorId = randomUUID(); statements.push(`INSERT INTO "BuildingFloor" (id,"buildingId",name,level,occupancy,notes) VALUES (${[floorId, buildingId, floorName, 0, "exterior", "Created from 175 lb Steam source workbook."].map(quote).join(",")});`); }
  const byArea = new Map(areas.filter((a) => a.faCode).map((a) => [a.faCode!, a.id])); const byItem = new Map(existing.map((i) => [i.inventoryCode, i.id])); let createdAreas=0, createdItems=0, createdInspections=0;
  for (const c of circuits) { const fa=`C-${c.code}`; let areaId=byArea.get(fa); if(!areaId){areaId=randomUUID();byArea.set(fa,areaId);createdAreas++;statements.push(`INSERT INTO "BuildingArea" (id,"buildingId","floorId","faCode",name,"areaType",notes) VALUES (${[areaId,buildingId,floorId,fa,c.location,"exterior",`Circuit ${c.code}; line size: ${c.lineSize||"not provided"}.`].map(quote).join(",")});`);} if(!byItem.has(c.code)){createdItems++;statements.push(`INSERT INTO "InventoryItem" (id,"organizationId","clientId","facilityId","buildingId","functionalAreaId","inventoryCode","internalCode",floor,area,"specificLocation","materialCategory","materialDescription","acmClassification","fiberTypes",friable,"quantityUnit",condition,accessibility,"disturbancePotential","responseAction","isProvisional","recordStatus",notes,"updatedAt") VALUES (${[randomUUID(),building.organizationId,building.clientId,building.facilityId,buildingId,areaId,c.code,`175lb Steam-${c.code}`,floorName,fa,c.location,"Thermal System Insulation",c.material,"assumed_acm","[]","non_friable","EA","unable_to_inspect","accessible","low","Further sampling",1,"active",`Circuit ${c.code}; line size: ${c.lineSize||"not provided"}; ${c.notes||""} Imported from ${workbookPath.split("/").at(-1)}.`].map(quote).join(",")},CURRENT_TIMESTAMP);`);}}
  for(const h of histories){const [month,day,year]=h.date.split("/").map(Number); const iso=new Date(Date.UTC(year,month-1,day,12)).toISOString(); if(inspections.some((i)=>i.completedAt===iso && i.notes?.includes("175 lb Steam Inspection History"))) continue; createdInspections++; statements.push(`INSERT INTO "Inspection" (id,"organizationId","clientId","buildingId","inspectionType","scheduledDate","startedAt","completedAt",status,"completionPct",notes,findings,"signedAt") VALUES (${[randomUUID(),building.organizationId,building.clientId,buildingId,"annual_inspection",iso,iso,iso,"completed",0,`175 lb Steam Inspection History; action: ${h.action||"not stated"}; next due: ${h.next||"not stated"}; ${h.notes||""}`,h.findings,iso].map(quote).join(",")});`);}
  const report={mode:apply?"apply":"dry-run",target:buildingId,source:{quantityRecords:circuits.length,sampleRecords:0,annualReportItemConditions:0,historicalInspections:histories.length},created:{floor:floors.some((f)=>f.name===floorName)?0:1,functionalAreas:createdAreas,materials:createdItems,inspections:createdInspections},skipped:{materials:circuits.length-createdItems,inspections:histories.length-createdInspections}}; console.log(JSON.stringify(report,null,2)); if(!apply)return;
  statements.push(`INSERT INTO "ImportJob" (id,"organizationId",kind,status,filename,summary) VALUES (${[randomUUID(),building.organizationId,"corteva_175lb_steam_line_xlsx","completed",workbookPath.split("/").at(-1)!,JSON.stringify(report)].map(quote).join(",")});`);
  const dir=await mkdtemp(join(tmpdir(),"strata-175lb-")); const file=join(dir,"import.sql"); try{await writeFile(file,statements.join("\n"),{mode:0o600});d1(["--file",file]);}finally{await rm(dir,{recursive:true,force:true});}
}
main().catch((e)=>{console.error(e instanceof Error?e.message:e);process.exit(1);});
