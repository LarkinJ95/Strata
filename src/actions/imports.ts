"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sessionFromToken } from "@/lib/auth";

type Row = Record<string, string>;
const REQUIRED_FILES = ["clients", "facilities", "buildings", "floors", "functional-areas", "inventory"] as const;

function csv(text: string): Row[] {
  const rows: string[][] = [[]];
  let value = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted;
    } else if (c === "," && !quoted) { rows.at(-1)!.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      rows.at(-1)!.push(value); value = "";
      if (rows.at(-1)!.some((v) => v.length)) rows.push([]);
    } else value += c;
  }
  rows.at(-1)!.push(value);
  const [headers, ...data] = rows.filter((r) => r.some((v) => v.trim()));
  if (!headers?.length) return [];
  return data.map((line) => Object.fromEntries(headers.map((h, i) => [h.trim(), (line[i] || "").trim()])));
}

function number(value: string) { return value === "" ? null : Number(value); }
function date(value: string) { return value ? new Date(`${value}T00:00:00.000Z`) : null; }
function bool(value: string) { return value === "" ? null : value.toLowerCase() === "yes"; }
function required(row: Row, key: string, label: string) { if (!row[key]) throw new Error(`${label} is required`); return row[key]; }

async function filesFrom(form: FormData) {
  const files = {} as Record<(typeof REQUIRED_FILES)[number], File>;
  for (const name of REQUIRED_FILES) {
    const file = form.get(name);
    if (!(file instanceof File) || !file.size || !file.name.toLowerCase().endsWith(".csv")) throw new Error(`Attach ${name}.csv`);
    files[name] = file;
  }
  return Object.fromEntries(await Promise.all(REQUIRED_FILES.map(async (name) => [name, csv(await files[name].text())]))) as Record<(typeof REQUIRED_FILES)[number], Row[]>;
}

export async function importStructuredCsv(form: FormData) {
  const user = await sessionFromToken(String(form.get("access") || ""));
  if (!user || user.isClient || user.isContractor) throw new Error("Not allowed");
  const data = await filesFrom(form);
  if (data.clients.some((r) => !r.client_number || !r.name) || data.inventory.some((r) => !r.inventory_code || !r.building_number)) {
    throw new Error("Client number/name and inventory code/building number are required");
  }
  const duplicateCodes = data.inventory.map((r) => r.inventory_code).filter((code, i, all) => all.indexOf(code) !== i);
  if (duplicateCodes.length) throw new Error(`Duplicate inventory code: ${duplicateCodes[0]}`);

  const org = user.organizationId;
  const clientNumbers = data.clients.map((r) => r.client_number);
  const existingClients = await db.client.findMany({ where: { organizationId: org, clientNumber: { in: clientNumbers } }, select: { clientNumber: true } });
  if (existingClients.length) throw new Error(`Client already exists: ${existingClients[0].clientNumber}. Imports never merge existing records.`);
  const existingInventory = await db.inventoryItem.findMany({ where: { organizationId: org, inventoryCode: { in: data.inventory.map((r) => r.inventory_code) } }, select: { inventoryCode: true } });
  if (existingInventory.length) throw new Error(`Inventory code already exists: ${existingInventory[0].inventoryCode}`);

  await db.$transaction(async (tx) => {
    const clients = new Map<string, { id: string }>();
    for (const row of data.clients) {
      const created = await tx.client.create({ data: {
        organizationId: org, clientNumber: required(row, "client_number", "Client number"), name: required(row, "name", "Client name"),
        primaryContact: row.primary_contact || null, primaryEmail: row.primary_email || null, primaryPhone: row.primary_phone || null,
        secondaryContact: row.secondary_contact || null, secondaryEmail: row.secondary_email || null, secondaryPhone: row.secondary_phone || null,
        address: row.address || null, city: row.city || null, state: row.state || null, postalCode: row.postal_code || null,
        photoPolicy: row.photo_policy || "permitted", inspectionReqs: row.inspection_reqs || null, reportingReqs: row.reporting_reqs || null,
        notes: row.notes || null, status: row.status || "active",
      }});
      clients.set(row.client_number, created);
    }
    const facilities = new Map<string, { id: string; clientId: string }>();
    for (const row of data.facilities) {
      const client = clients.get(required(row, "client_number", "Facility client number"));
      if (!client) throw new Error(`Facility references missing client ${row.client_number}`);
      const created = await tx.facility.create({ data: {
        organizationId: org, clientId: client.id, facilityId: required(row, "facility_id", "Facility ID"), name: required(row, "name", "Facility name"),
        address: row.address || null, city: row.city || null, state: row.state || null, postalCode: row.postal_code || null,
        latitude: number(row.latitude), longitude: number(row.longitude), primaryContact: row.primary_contact || null,
        environmentalContact: row.environmental_contact || null, emergencyContact: row.emergency_contact || null, notes: row.notes || null, status: row.status || "active",
      }});
      facilities.set(row.facility_id, { id: created.id, clientId: client.id });
    }
    const buildings = new Map<string, { id: string; clientId: string; facilityId: string }>();
    for (const row of data.buildings) {
      const facility = facilities.get(required(row, "facility_id", "Building facility ID"));
      if (!facility || row.client_number !== data.facilities.find((f) => f.facility_id === row.facility_id)?.client_number) throw new Error(`Building references an invalid facility ${row.facility_id}`);
      const created = await tx.building.create({ data: {
        organizationId: org, clientId: facility.clientId, facilityId: facility.id, buildingNumber: required(row, "building_number", "Building number"), name: required(row, "name", "Building name"),
        address: row.address || null, yearConstructed: number(row.year_constructed), squareFootage: number(row.square_footage), floorsCount: number(row.floors_count),
        buildingUse: row.building_use || null, occupancyStatus: row.occupancy_status || "occupied", photoPolicy: row.photo_policy || "permitted",
        surveyStatus: row.survey_status || "complete", managementPlanStatus: row.management_plan_status || "current", lastInspectionAt: date(row.last_inspection_at),
        nextInspectionAt: date(row.next_inspection_at), inspectionIntervalDays: number(row.inspection_interval_days) ?? 365, notes: row.notes || null,
      }});
      buildings.set(row.building_number, { id: created.id, clientId: facility.clientId, facilityId: facility.id });
    }
    const floors = new Map<string, string>();
    for (const row of data.floors) {
      const building = buildings.get(required(row, "building_number", "Floor building number"));
      if (!building) throw new Error(`Floor references missing building ${row.building_number}`);
      const created = await tx.buildingFloor.create({ data: { buildingId: building.id, name: required(row, "floor_name", "Floor name"), level: number(row.level) ?? 0, occupancy: row.occupancy || null, squareFootage: number(row.square_footage), notes: row.notes || null } });
      floors.set(`${row.building_number}|${row.floor_name}`, created.id);
    }
    for (const row of data["functional-areas"]) {
      const building = buildings.get(required(row, "building_number", "Functional-area building number"));
      if (!building) throw new Error(`Functional area references missing building ${row.building_number}`);
      await tx.buildingArea.create({ data: { buildingId: building.id, floorId: floors.get(`${row.building_number}|${row.floor_name}`) || null, faCode: row.fa_code || null, name: required(row, "name", "Functional-area name"), areaType: row.area_type || null, useDescription: row.use_description || null, notes: row.notes || null } });
    }
    const homogeneousAreas = new Map<string, string>();
    for (const row of data.inventory) {
      const building = buildings.get(required(row, "building_number", "Inventory building number"));
      if (!building || !clients.has(row.client_number)) throw new Error(`Inventory references an invalid client or building`);
      let homogeneousAreaId: string | undefined;
      if (row.homogeneous_area) {
        const key = `${row.building_number}|${row.homogeneous_area}`;
        homogeneousAreaId = homogeneousAreas.get(key);
        if (!homogeneousAreaId) {
          const area = await tx.homogeneousArea.create({ data: { organizationId: org, buildingId: building.id, haCode: row.homogeneous_area, material: row.material_description || "Unspecified material", materialDescription: row.material_description || null } });
          homogeneousAreaId = area.id; homogeneousAreas.set(key, area.id);
        }
      }
      await tx.inventoryItem.create({ data: {
        organizationId: org, clientId: building.clientId, facilityId: building.facilityId, buildingId: building.id, homogeneousAreaId,
        inventoryCode: required(row, "inventory_code", "Inventory code"), floor: row.floor || null, room: row.room || null, area: row.fa_code || null,
        specificLocation: row.location || null, materialCategory: row.material_category || "Miscellaneous", materialDescription: required(row, "material_description", "Material description"),
        acmClassification: row.acm_classification || "unknown", asbestosDetected: bool(row.asbestos_detected), asbestosPercent: number(row.asbestos_percent),
        fiberTypes: JSON.stringify((row.fiber_types || "").split(";").map((v) => v.trim()).filter(Boolean)), friable: row.friable || null, materialClass: row.material_class || null,
        categoryIorII: row.category_i_or_ii || null, analyticalMethod: row.analytical_method || null, originalQuantity: number(row.original_quantity), currentQuantity: number(row.current_quantity),
        quantityUnit: row.quantity_unit || "SF", condition: row.condition || "good", accessibility: row.accessibility || null, disturbancePotential: row.disturbance_potential || null,
        labelPresent: bool(row.label_present), labelCondition: row.label_condition || null, responseAction: row.response_action || null, isProvisional: bool(row.provisional) ?? false, recordStatus: row.record_status || "active", notes: row.notes || null,
      }});
    }
    await tx.importJob.create({ data: { organizationId: org, kind: "structured_csv", status: "completed", filename: "STRATA structured CSV import", createdById: user.id, summary: JSON.stringify(Object.fromEntries(REQUIRED_FILES.map((name) => [name, data[name].length]))) } });
  });
  revalidatePath("/"); revalidatePath("/clients"); revalidatePath("/buildings"); revalidatePath("/inventory");
  return { clients: data.clients.length, facilities: data.facilities.length, buildings: data.buildings.length, inventory: data.inventory.length };
}
