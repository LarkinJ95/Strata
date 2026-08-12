import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const b = await db.building.findFirst({ where: { buildingNumber: "MH-01" }, include: { floors: true } });
  if (!b) {
    console.log("no MH-01");
    return;
  }
  let basement = b.floors.find((f) => f.level < 0 || /base/i.test(f.name));
  let l1 = b.floors.find((f) => f.level === 1);
  if (!basement) {
    basement = await db.buildingFloor.create({
      data: { buildingId: b.id, name: "Basement", level: -1, occupancy: "Mechanical / restricted" },
    });
  }
  if (!l1) {
    l1 = await db.buildingFloor.create({
      data: { buildingId: b.id, name: "Level 1", level: 1, occupancy: "Public / clinical" },
    });
  }
  if ((await db.buildingArea.count({ where: { buildingId: b.id } })) === 0) {
    await db.buildingArea.createMany({
      data: [
        { buildingId: b.id, floorId: basement.id, faCode: "FA-B-MECH", name: "Mech-01 steam plant", areaType: "mechanical", useDescription: "Steam mains and boiler tie-in" },
        { buildingId: b.id, floorId: l1.id, faCode: "FA-1-CORA", name: "Corridor A", areaType: "corridor", useDescription: "Main east-west public corridor" },
        { buildingId: b.id, floorId: l1.id, faCode: "FA-1-OR", name: "OR suite", areaType: "room", useDescription: "Operating rooms 1-4" },
        { buildingId: b.id, floorId: l1.id, faCode: "FA-1-LOB", name: "Public lobby", areaType: "room" },
      ],
    });
  }
  const areas = await db.buildingArea.findMany({ where: { buildingId: b.id } });
  const lobby = areas.find((a) => /lobby/i.test(a.name));
  const mech = areas.find((a) => /mech/i.test(a.name));
  if ((await db.paintSample.count({ where: { buildingId: b.id } })) === 0) {
    await db.paintSample.createMany({
      data: [
        { organizationId: b.organizationId, buildingId: b.id, floorId: l1.id, areaId: lobby?.id, sampleNumber: "PB-001", floor: "1", room: "Lobby", location: "North wall at entry", component: "wall", color: "cream", substrate: "Plaster", method: "XRF", leadDetected: true, leadMgCm2: 1.4, resultSummary: "Positive — above 1.0 mg/cm2", status: "results_received", laboratory: "Great Lakes Fiber Laboratory" },
        { organizationId: b.organizationId, buildingId: b.id, floorId: l1.id, sampleNumber: "PB-002", floor: "1", room: "Corridor A", location: "Window sash, south", component: "window", color: "white", substrate: "Wood", method: "XRF", leadDetected: true, leadMgCm2: 2.1, asbestosPaint: false, resultSummary: "Positive lead; asbestos in paint ND", status: "results_received" },
        { organizationId: b.organizationId, buildingId: b.id, floorId: basement.id, areaId: mech?.id, sampleNumber: "PB-003", floor: "Basement", room: "Mech-01", location: "Equipment room wall", component: "wall", color: "gray", substrate: "CMU", method: "Paint chip", leadDetected: false, leadPpm: 40, resultSummary: "Below HUD/EPA threshold", status: "results_received" },
      ],
    });
  }
  if ((await db.buildingPpe.count({ where: { buildingId: b.id } })) === 0) {
    await db.buildingPpe.createMany({
      data: [
        { buildingId: b.id, item: "Half-face respirator (P100)", required: true, appliesTo: "Mechanical rooms / TSI work", notes: "Required when disturbing confirmed TSI." },
        { buildingId: b.id, item: "Tyvek / disposable coveralls", required: true, appliesTo: "TSI and damaged ACM areas" },
        { buildingId: b.id, item: "Gloves (nitrile)", required: true, appliesTo: "Entire building — sampling and repair" },
        { buildingId: b.id, item: "Eye protection", required: true, appliesTo: "Entire building" },
        { buildingId: b.id, item: "PAPR", required: false, appliesTo: "Significantly damaged TSI / chase work", notes: "Recommended for MH01-013 5th-floor chase." },
      ],
    });
  }
  console.log("seeded", b.buildingNumber);
}

main().finally(() => db.$disconnect());
