import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";

const input = process.argv[2];
const apply = process.argv.includes("--apply");
const sourceName = "2026 Inspections.xlsx";
const sourceSheet = "Dow";
const organizationSlug = "bierlein";
const clientName = "Dow Chemical";
const quote = (value: string | number | null) => value == null ? "NULL" : typeof value === "number" ? String(value) : `'${value.replaceAll("'", "''")}'`;
const text = (value: unknown) => String(value ?? "").trim();
const d1 = (args: string[]) => execFileSync("npx", ["wrangler", "d1", "execute", "strata", "--remote", ...args], { encoding: "utf8" });
const query = <T>(sql: string) => (JSON.parse(d1(["--command", sql, "--json"])) as { results: T[] }[])[0]?.results ?? [];

type SourceRow = { row: number; building: string; dueMonth: string; pmo: string; complete: boolean; closed: boolean; notes: string };
type Building = { id: string; organizationId: string; clientId: string; facilityId: string; buildingNumber: string; name: string; facilityName: string };
type Existing = { id: string; buildingId: string; poNumber: string | null; workNumber: string; title: string; description: string | null };

function parse() {
  if (!input) throw new Error("Usage: tsx scripts/import-dow-2026-pmos.ts <2026 Inspections.xlsx> [--apply]");
  const workbook = XLSX.readFile(input, { cellDates: true });
  const sheet = workbook.Sheets[sourceSheet];
  if (!sheet) throw new Error(`Missing required sheet: ${sourceSheet}`);
  const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headers = values[0].map(text);
  const expected = ["Building", "Client", "Due Month", "PMO", "Hours", "Printed", "Complete", "Closed", "Notes"];
  if (expected.some((name, index) => headers[index] !== name)) throw new Error(`Unexpected ${sourceSheet} headers: ${headers.slice(0, 9).join(" | ")}`);
  const rows = values.slice(1).flatMap((row, index): SourceRow[] => {
    const building = text(row[0]); const client = text(row[1]); const pmo = text(row[3]);
    if (!building || !pmo) return [];
    if (client !== "Dow") throw new Error(`Source row ${index + 2} has unexpected client: ${client}`);
    return [{ row: index + 2, building, dueMonth: text(row[2]), pmo, complete: text(row[6]).toUpperCase() === "TRUE", closed: text(row[7]).toUpperCase() === "TRUE", notes: text(row[8]) }];
  });
  const duplicate = rows.find((row, index) => rows.findIndex((candidate) => candidate.building === row.building && candidate.pmo === row.pmo && candidate.dueMonth === row.dueMonth) !== index);
  if (duplicate) throw new Error(`Duplicate source identity at row ${duplicate.row}: ${duplicate.building} / ${duplicate.pmo} / ${duplicate.dueMonth}`);
  return { headers, rows };
}

function matchingCandidates(source: SourceRow, buildings: Building[]) {
  const targetName = `building ${source.building}`.toLowerCase();
  const targetNumber = source.building.toLowerCase();
  return buildings.filter((building) => building.name.trim().toLowerCase() === targetName || building.buildingNumber.trim().toLowerCase() === targetNumber);
}

async function main() {
  const { headers, rows } = parse();
  const organization = query<{ id: string }>(`SELECT id FROM "Organization" WHERE slug=${quote(organizationSlug)};`)[0];
  if (!organization) throw new Error("Expected bierlein organization was not found");
  const client = query<{ id: string }>(`SELECT id FROM "Client" WHERE "organizationId"=${quote(organization.id)} AND name=${quote(clientName)};`)[0];
  if (!client) throw new Error("Expected Dow Chemical production client was not found");
  const buildings = query<Building>(`SELECT b.id AS id,b."organizationId" AS organizationId,b."clientId" AS clientId,b."facilityId" AS facilityId,b."buildingNumber" AS buildingNumber,b.name AS name,f.name AS facilityName FROM "Building" b JOIN "Facility" f ON f.id=b."facilityId" WHERE b."clientId"=${quote(client.id)};`);
  const existing = query<Existing>(`SELECT id,"buildingId" AS buildingId,"poNumber" AS poNumber,"workNumber" AS workNumber,title,description FROM "WorkRecord" WHERE "organizationId"=${quote(organization.id)} AND "workType"='PMO';`);

  const exceptions: { row: number; building: string; pmo: string; reason: string; candidates?: string[] }[] = [];
  const accepted: { source: SourceRow; building: Building; status: "open" | "completed"; workNumber: string; description: string }[] = [];
  for (const source of rows) {
    if (!/\d/.test(source.pmo)) {
      exceptions.push({ row: source.row, building: source.building, pmo: source.pmo, reason: "PMO column contains non-reference text" });
      continue;
    }
    const candidates = matchingCandidates(source, buildings);
    if (candidates.length !== 1) {
      exceptions.push({ row: source.row, building: source.building, pmo: source.pmo, reason: candidates.length ? "ambiguous building match" : "no matching building", candidates: candidates.map((candidate) => `${candidate.facilityName} / ${candidate.buildingNumber}`) });
      continue;
    }
    const building = candidates[0];
    const workNumber = `PMO-2026-R${String(source.row).padStart(3, "0")}`;
    const status = source.complete || source.closed ? "completed" : "open";
    const description = [`Imported from ${sourceName} · sheet ${sourceSheet} · row ${source.row}.`, `Source PMO: ${source.pmo}.`, `Due month: ${source.dueMonth || "not stated"}.`, `Complete: ${source.complete ? "TRUE" : "FALSE"}; Closed: ${source.closed ? "TRUE" : "FALSE"}.`, source.notes ? `Source notes: ${source.notes}` : ""].filter(Boolean).join(" ");
    const conflictingNumber = existing.find((record) => record.workNumber === workNumber && !(record.buildingId === building.id && record.poNumber === source.pmo));
    if (conflictingNumber) { exceptions.push({ row: source.row, building: source.building, pmo: source.pmo, reason: `work number collision with ${conflictingNumber.id}` }); continue; }
    accepted.push({ source, building, status, workNumber, description });
  }

  const reused = accepted.filter((record) => existing.some((current) => current.buildingId === record.building.id && current.poNumber === record.source.pmo && current.title === "2026 Annual Inspection PMO" && current.description?.includes(`sheet ${sourceSheet} · row ${record.source.row}`)));
  const created = accepted.filter((record) => !reused.includes(record));
  const summary = { source: { file: sourceName, sheet: sourceSheet, headers: headers.slice(0, 9), pmoRows: rows.length, completedByExplicitSourceFlag: rows.filter((row) => row.complete || row.closed).length, openByExplicitSourceFlag: rows.filter((row) => !row.complete && !row.closed).length }, preflight: { accepted: accepted.length, created: created.length, reused: reused.length, exceptions }, dates: "The source has due month only; dueDate, completedAt, and completedById are intentionally NULL.", references: "Source PMO is stored in poNumber; source workbook/sheet/row and notes are retained in description." };
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }, null, 2));
  if (!apply) return;
  if (!created.length) return;
  const statements = created.map((record) => `INSERT INTO "WorkRecord" (id,"organizationId","clientId","facilityId","buildingId","workNumber","workType",title,description,status,priority,"dueDate","completedAt","vendorName","contractorId","assignedUserId","poNumber","costEstimate","actualCost","createdById","completedById","createdAt","updatedAt") VALUES (${[randomUUID(), record.building.organizationId, record.building.clientId, record.building.facilityId, record.building.id, record.workNumber, "PMO", "2026 Annual Inspection PMO", record.description, record.status, "medium", null, null, null, null, null, record.source.pmo, null, null, null, null].map(quote).join(",")},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);`);
  statements.push(`INSERT INTO "ImportJob" (id,"organizationId",kind,status,filename,summary) VALUES (${[randomUUID(), organization.id, "dow_2026_pmo_xlsx", "completed", sourceName, JSON.stringify(summary)].map(quote).join(",")});`);
  const directory = await mkdtemp(join(tmpdir(), "strata-dow-pmo-")); const sqlFile = join(directory, "import.sql");
  try { await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 }); d1(["--file", sqlFile]); } finally { await rm(directory, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
