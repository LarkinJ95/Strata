import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { ROLE_PRESETS } from "../src/lib/permissions";

const db = new PrismaClient();

function days(offset: number, hour = 10) {
  const d = new Date("2026-08-12T12:00:00");
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 15, 0, 0);
  return d;
}

function svg(kind: string, title: string, sub: string) {
  const palettes: Record<string, [string, string, string]> = {
    tsi: ["#c9b08a", "#8a6a3d", "#efe4cf"],
    damaged: ["#c07a4a", "#6b2f1c", "#f0d2bc"],
    tile: ["#9aa3ad", "#5d6670", "#d5dbe1"],
    mastic: ["#3d342c", "#1c1713", "#6b5a4a"],
    ceiling: ["#e7e0d2", "#b7ad99", "#f6f1e6"],
    plaster: ["#ddd4c4", "#a89a84", "#f3eee4"],
    fire: ["#c9c2b0", "#7d7563", "#ece7d8"],
    transite: ["#8f9aa0", "#4d575c", "#d5 rec".replace(" rec", "dce3")],
    glaze: ["#9bb8c9", "#3d6d82", "#d7eaf2"],
    caulk: ["#cfc6b4", "#7a7262", "#efe9db"],
    boiler: ["#b9a078", "#5a4324", "#e6d5b3"],
    roof: ["#4b4f55", "#23262a", "#8b9098"],
    label: ["#d9a017", "#6b4a00", "#ffe08a"],
    sample: ["#d7dee8", "#6b7789", "#f4f7fb"],
    repair: ["#8fbfa4", "#2f6b4f", "#d7eee2"],
    hospital: ["#b7c4d4", "#5b6d82", "#e4ebf3"],
    school: ["#cbb99a", "#7a6546", "#efe4cf"],
    plant: ["#9aa3a0", "#4c5553", "#dbe1df"],
  };
  const [a, b, c] = palettes[kind] ?? palettes.tile;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="920" viewBox="0 0 1400 920">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${a}"/>
    </linearGradient>
    <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="${b}" stroke-opacity=".18" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1400" height="920" fill="url(#g)"/>
  <rect width="1400" height="920" fill="url(#p)"/>
  <rect x="70" y="70" width="1260" height="780" rx="18" fill="rgba(12,19,32,.18)"/>
  <rect x="90" y="88" width="1220" height="744" rx="14" fill="rgba(255,255,255,.12)"/>
  <circle cx="220" cy="240" r="90" fill="${b}" opacity=".35"/>
  <circle cx="1180" cy="680" r="140" fill="${b}" opacity=".2"/>
  <rect x="160" y="620" width="520" height="140" rx="12" fill="rgba(12,19,32,.55)"/>
  <text x="184" y="668" fill="#e8eef6" font-family="ui-monospace,monospace" font-size="18" letter-spacing="3">FIELD RECORD</text>
  <text x="184" y="708" fill="#ffffff" font-family="ui-sans-serif,system-ui" font-size="34" font-weight="600">${title}</text>
  <text x="184" y="742" fill="#c9d4e2" font-family="ui-sans-serif,system-ui" font-size="18">${sub}</text>
</svg>`;
}

async function writeDemo(rel: string, contents: string) {
  const full = path.join(process.cwd(), "public", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

async function main() {
  console.log("Seeding STRATA…");
  const passwordHash = await bcrypt.hash("Strata2026!", 10);

  const photos: { key: string; title: string; kind: string; sub: string }[] = [
    { key: "demo/photos/tsi-pipe.svg", title: "Pipe insulation", kind: "tsi", sub: "Basement mechanical · TSI" },
    { key: "demo/photos/tsi-fitting.svg", title: "Fitting mud", kind: "tsi", sub: "Elbow · thermal system insulation" },
    { key: "demo/photos/damaged-tsi.svg", title: "Damaged TSI", kind: "damaged", sub: "Exposed fibers · needs repair" },
    { key: "demo/photos/floor-tile.svg", title: "9×9 floor tile", kind: "tile", sub: "Corridor finish · miscellaneous" },
    { key: "demo/photos/mastic.svg", title: "Black mastic", kind: "mastic", sub: "Beneath 9×9 tile" },
    { key: "demo/photos/ceiling.svg", title: "2×4 ceiling tile", kind: "ceiling", sub: "Lay-in acoustic panel" },
    { key: "demo/photos/plaster.svg", title: "Wall plaster", kind: "plaster", sub: "Original 1970s finish" },
    { key: "demo/photos/fireproof.svg", title: "Spray fireproofing", kind: "fire", sub: "Structural steel" },
    { key: "demo/photos/transite.svg", title: "Transite panel", kind: "transite", sub: "Cementitious board" },
    { key: "demo/photos/glazing.svg", title: "Window glazing", kind: "glaze", sub: "Original steel sash" },
    { key: "demo/photos/caulk.svg", title: "Perimeter caulk", kind: "caulk", sub: "Window / door joint" },
    { key: "demo/photos/boiler.svg", title: "Boiler insulation", kind: "boiler", sub: "Breeching and shell" },
    { key: "demo/photos/roof.svg", title: "Built-up roofing", kind: "roof", sub: "Category I nonfriable" },
    { key: "demo/photos/label.svg", title: "ACM warning label", kind: "label", sub: "Mechanical room door" },
    { key: "demo/photos/sample-bag.svg", title: "Sample after collection", kind: "sample", sub: "Chain-of-custody bag" },
    { key: "demo/photos/repair-after.svg", title: "Post-repair wrap", kind: "repair", sub: "Encapsulated fitting" },
    { key: "demo/photos/hospital.svg", title: "Main Hospital", kind: "hospital", sub: "MetroHealth Central Campus" },
    { key: "demo/photos/school.svg", title: "Lakeside High", kind: "school", sub: "Academic building" },
    { key: "demo/photos/plant.svg", title: "Central Plant", kind: "plant", sub: "Steam generation" },
  ];
  for (const p of photos) await writeDemo(p.key, svg(p.kind, p.title, p.sub));

  const org = await db.organization.create({
    data: {
      name: "Northline Environmental",
      slug: "northline",
      legalName: "Northline Environmental Associates, LLC",
      address: "410 Woodward Ave, Detroit, MI 48226",
      phone: "(313) 555-0140",
      email: "records@northline.env",
      website: "https://northline.env",
      settings: JSON.stringify({
        reportHeader: "Northline Environmental — Asbestos Building Records",
        photoRules: { damaged: true, removed: true, sample: true, goodOptional: true },
      }),
    },
  });

  const roles: Record<string, string> = {};
  for (const [slug, perms] of Object.entries(ROLE_PRESETS)) {
    const names: Record<string, string> = {
      org_admin: "Organization Administrator",
      environmental_manager: "Environmental Manager",
      inspector: "Inspector",
      technician: "Technician",
      client_admin: "Client Administrator",
      client_viewer: "Client Viewer",
      contractor: "Contractor",
    };
    const r = await db.role.create({
      data: {
        organizationId: org.id,
        slug,
        name: names[slug],
        isSystem: true,
        permissions: JSON.stringify(perms),
        description: names[slug],
      },
    });
    roles[slug] = r.id;
  }

  const lab = await db.laboratory.create({
    data: {
      organizationId: org.id,
      name: "Great Lakes Fiber Laboratory",
      accreditation: "NVLAP 101234-0",
      address: "88 Laboratory Dr, Ann Arbor, MI",
      phone: "(734) 555-0199",
      email: "intake@glfiber.lab",
    },
  });

  const contractor = await db.contractor.create({
    data: {
      organizationId: org.id,
      name: "AbatePro Restoration",
      license: "MI-ASB-44120",
      contactName: "Renee Vale",
      phone: "(248) 555-0177",
      email: "renee.vale@abatepro.com",
    },
  });

  const metro = await db.client.create({
    data: {
      organizationId: org.id,
      name: "MetroHealth System",
      clientNumber: "MH-100",
      primaryContact: "Patricia Holm",
      primaryEmail: "patricia.holm@metrohealth.org",
      primaryPhone: "(313) 555-2200",
      secondaryContact: "Facilities Control Desk",
      secondaryEmail: "ehs@metrohealth.org",
      address: "3990 John R St",
      city: "Detroit",
      state: "MI",
      postalCode: "48201",
      notes: "Photography restricted in Imaging Annex. Annual surveillance required for all pre-1981 buildings.",
      contractInfo: "MSA 2024–2027 · asbestos O&M and inspection",
      inspectionReqs: "Annual surveillance of all confirmed/assumed ACM. Three-year reinspection of TSI and surfacing.",
      reportingReqs: "Building inventory PDF + XLSX after each inspection.",
      documentReqs: "Management plan current within 12 months.",
      photoPolicy: "permitted",
    },
  });

  const lusd = await db.client.create({
    data: {
      organizationId: org.id,
      name: "Lakeside Unified School District",
      clientNumber: "LUSD-40",
      primaryContact: "Andre Pell",
      primaryEmail: "apell@lakeside.k12.mi.us",
      primaryPhone: "(586) 555-4410",
      address: "1200 Lakeshore Dr",
      city: "St. Clair Shores",
      state: "MI",
      postalCode: "48080",
      notes: "AHERA three-year reinspections. Six-month periodic surveillance.",
      inspectionReqs: "AHERA periodic surveillance every 6 months; reinspection every 3 years.",
      reportingReqs: "AHERA management plan updates after any response action.",
      photoPolicy: "permitted",
    },
  });

  const users = {
    emma: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.org_admin,
        email: "emma.wright@northline.env",
        passwordHash,
        name: "Emma Wright",
        title: "Principal / Organization Administrator",
        phone: "(313) 555-0141",
      },
    }),
    marcus: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.environmental_manager,
        email: "marcus.chen@northline.env",
        passwordHash,
        name: "Marcus Chen",
        title: "Senior Environmental Manager",
        phone: "(313) 555-0144",
      },
    }),
    sofia: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.inspector,
        email: "sofia.reyes@northline.env",
        passwordHash,
        name: "Sofia Reyes",
        title: "Accredited Building Inspector",
        phone: "(313) 555-0148",
      },
    }),
    james: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.technician,
        email: "james.okafor@northline.env",
        passwordHash,
        name: "James Okafor",
        title: "Field Technician",
      },
    }),
    patricia: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.client_admin,
        clientId: metro.id,
        email: "patricia.holm@metrohealth.org",
        passwordHash,
        name: "Patricia Holm",
        title: "Director, Environmental Health",
      },
    }),
    david: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.client_viewer,
        clientId: metro.id,
        email: "david.kim@metrohealth.org",
        passwordHash,
        name: "David Kim",
        title: "Facilities Coordinator",
      },
    }),
    renee: await db.user.create({
      data: {
        organizationId: org.id,
        roleId: roles.contractor,
        contractorId: contractor.id,
        email: "renee.vale@abatepro.com",
        passwordHash,
        name: "Renee Vale",
        title: "Project Supervisor, AbatePro",
      },
    }),
  };

  const facCentral = await db.facility.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      name: "Central Campus",
      facilityId: "MH-CC",
      address: "3990 John R St",
      city: "Detroit",
      state: "MI",
      postalCode: "48201",
      latitude: 42.351,
      longitude: -83.057,
      primaryContact: "Campus Engineering",
      environmentalContact: "Patricia Holm",
      emergencyContact: "Security 313-555-2911",
    },
  });
  const facWest = await db.facility.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      name: "West Pavilion Campus",
      facilityId: "MH-WP",
      address: "7800 W Outer Dr",
      city: "Detroit",
      state: "MI",
      postalCode: "48235",
      latitude: 42.425,
      longitude: -83.195,
      environmentalContact: "Patricia Holm",
    },
  });
  const facHigh = await db.facility.create({
    data: {
      organizationId: org.id,
      clientId: lusd.id,
      name: "Lakeside High Campus",
      facilityId: "LUSD-HS",
      address: "8800 Jefferson Ave",
      city: "St. Clair Shores",
      state: "MI",
      postalCode: "48080",
      latitude: 42.497,
      longitude: -82.896,
      environmentalContact: "Andre Pell",
    },
  });

  type BDef = {
    key: string;
    client: string;
    fac: string;
    name: string;
    no: string;
    year: number;
    sf: number;
    floors: number;
    use: string;
    last: number;
    next: number;
    photo: string;
    interval: number;
    notes: string;
  };
  const bdefs: BDef[] = [
    { key: "mh01", client: "metro", fac: "cc", name: "Main Hospital", no: "MH-01", year: 1972, sf: 428000, floors: 8, use: "Acute care hospital", last: -40, next: 18, photo: "permitted", interval: 365, notes: "Original tower plus 1988 connector. TSI and 9×9 tile remain in service areas." },
    { key: "mh02", client: "metro", fac: "cc", name: "Diagnostic Tower", no: "MH-02", year: 1984, sf: 186000, floors: 6, use: "Diagnostics / outpatient", last: -80, next: 40, photo: "permitted", interval: 365, notes: "Most interior finishes post-1984; isolated ACM in mechanical chases." },
    { key: "mh03", client: "metro", fac: "cc", name: "Central Plant", no: "MH-03", year: 1968, sf: 42000, floors: 2, use: "Central utility plant", last: -400, next: -18, photo: "permitted", interval: 365, notes: "High concentration of TSI. Inspection overdue." },
    { key: "mh04", client: "metro", fac: "cc", name: "East Wing", no: "MH-04", year: 1991, sf: 98000, floors: 4, use: "Inpatient / support", last: -120, next: 90, photo: "permitted", interval: 365, notes: "Limited ACM. Partial duct wrap removal 2025." },
    { key: "mhw1", client: "metro", fac: "west", name: "West Clinic", no: "MH-W1", year: 1978, sf: 64000, floors: 3, use: "Ambulatory clinic", last: -70, next: 50, photo: "permitted", interval: 365, notes: "Occupied clinic. Coordinate after-hours access." },
    { key: "mhw2", client: "metro", fac: "west", name: "Imaging Annex", no: "MH-W2", year: 1986, sf: 22000, floors: 2, use: "Imaging", last: -20, next: 25, photo: "prohibited", interval: 365, notes: "PHOTOGRAPHY PROHIBITED. MRI / nuclear medicine." },
    { key: "lusa", client: "lusd", fac: "hs", name: "Academic Building", no: "LUSD-A", year: 1959, sf: 156000, floors: 3, use: "Secondary school", last: -220, next: -12, photo: "permitted", interval: 180, notes: "AHERA building. Periodic surveillance overdue." },
    { key: "lusg", client: "lusd", fac: "hs", name: "Gymnasium", no: "LUSD-G", year: 1964, sf: 48000, floors: 2, use: "Athletics", last: -30, next: 150, photo: "permitted", interval: 180, notes: "Locker rooms and boiler mezzanine contain ACM." },
  ];

  const facMap = { cc: facCentral, west: facWest, hs: facHigh };
  const clientMap = { metro, lusd };
  const buildings: Record<string, { id: string; clientId: string; facilityId: string; name: string; buildingNumber: string }> = {};

  for (const b of bdefs) {
    const cl = clientMap[b.client as keyof typeof clientMap];
    const fac = facMap[b.fac as keyof typeof facMap];
    const rec = await db.building.create({
      data: {
        organizationId: org.id,
        clientId: cl.id,
        facilityId: fac.id,
        name: b.name,
        buildingNumber: b.no,
        address: fac.address,
        latitude: fac.latitude ?? undefined,
        longitude: fac.longitude ?? undefined,
        yearConstructed: b.year,
        squareFootage: b.sf,
        floorsCount: b.floors,
        buildingUse: b.use,
        lastInspectionAt: days(b.last),
        nextInspectionAt: days(b.next),
        inspectionIntervalDays: b.interval,
        responsibleManagerId: users.marcus.id,
        photoPolicy: b.photo,
        notes: b.notes,
        qrCode: `BLDG-${b.no}`,
        surveyStatus: "complete",
        managementPlanStatus: b.next < 0 ? "attention" : "current",
      },
    });
    buildings[b.key] = rec;
    for (let i = b.key === "mh03" || b.key === "lusg" ? 0 : 1; i <= b.floors; i++) {
      await db.buildingFloor.create({
        data: {
          buildingId: rec.id,
          name: i === 0 ? "Basement" : i === b.floors && b.key === "mh01" ? "Penthouse" : `Level ${i}`,
          level: i === 0 ? -1 : i,
        },
      });
    }
  }

  await db.userBuildingAccess.createMany({
    data: [
      { userId: users.renee.id, buildingId: buildings.mh01.id },
      { userId: users.renee.id, buildingId: buildings.mh03.id },
    ],
  });

  type Inv = {
    b: string;
    code: string;
    floor: string;
    room: string;
    loc: string;
    cat: string;
    desc: string;
    ha: string;
    acm: string;
    det?: boolean;
    fibers?: string[];
    pct?: number;
    friable?: string;
    mclass?: string;
    cat12?: string;
    method?: string;
    orig: number;
    curr: number;
    repaired?: number;
    removed?: number;
    unit: string;
    cond: string;
    access?: string;
    disturb?: string;
    label?: boolean;
    labelCond?: string;
    response?: string;
    provisional?: boolean;
    status?: string;
    notes?: string;
    photo?: string;
  };

  const invs: Inv[] = [
    { b: "mh01", code: "MH01-001", floor: "Basement", room: "Mech-01", loc: "Steam mains, south wall", cat: "Thermal System Insulation", desc: "Pipe insulation, aircell on 6-inch steam", ha: "HA-TSI-01", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 40, friable: "friable", mclass: "TSI", method: "PLM", orig: 320, curr: 320, unit: "LF", cond: "good", access: "mechanical_space", disturb: "low", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/tsi-pipe.svg" },
    { b: "mh01", code: "MH01-002", floor: "Basement", room: "Mech-01", loc: "Elbows on steam mains", cat: "Thermal System Insulation", desc: "Pipe fitting insulation (mudded elbows)", ha: "HA-TSI-02", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 55, friable: "friable", mclass: "TSI", method: "PLM", orig: 18, curr: 18, unit: "EA", cond: "damaged", access: "mechanical_space", disturb: "moderate", label: true, labelCond: "fair", response: "Repair", notes: "Two elbows with exposed ends.", photo: "demo/photos/tsi-fitting.svg" },
    { b: "mh01", code: "MH01-003", floor: "1", room: "Corridor A", loc: "Main corridor, east-west", cat: "Miscellaneous", desc: "9×9 vinyl floor tile, beige mottled", ha: "HA-FT-01", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 4, friable: "non_friable", mclass: "Miscellaneous", cat12: "I", method: "PLM", orig: 4200, curr: 4200, unit: "SF", cond: "fair", access: "accessible", disturb: "moderate", label: false, labelCond: "missing", response: "Continue surveillance", photo: "demo/photos/floor-tile.svg" },
    { b: "mh01", code: "MH01-004", floor: "1", room: "Corridor A", loc: "Beneath 9×9 tile", cat: "Miscellaneous", desc: "Black asphaltic mastic", ha: "HA-FT-01", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 8, friable: "non_friable", mclass: "Miscellaneous", cat12: "I", method: "PLM", orig: 4200, curr: 4200, unit: "SF", cond: "fair", access: "accessible", disturb: "low", response: "Continue surveillance", photo: "demo/photos/mastic.svg" },
    { b: "mh01", code: "MH01-005", floor: "2", room: "Admin suite", loc: "Offices 210–218", cat: "Miscellaneous", desc: "2×4 mineral fiber ceiling tile", ha: "HA-CT-01", acm: "non_acm", det: false, fibers: [], pct: 0, friable: "friable", mclass: "Miscellaneous", method: "PLM", orig: 8600, curr: 8600, unit: "SF", cond: "good", access: "accessible", disturb: "low", response: "No action", photo: "demo/photos/ceiling.svg" },
    { b: "mh01", code: "MH01-006", floor: "3", room: "Patient wing", loc: "Rooms 301–328 walls", cat: "Surfacing", desc: "Hard wall plaster, original", ha: "HA-PL-01", acm: "assumed_acm", friable: "non_friable", mclass: "Surfacing", orig: 12000, curr: 12000, unit: "SF", cond: "good", access: "accessible", disturb: "low", response: "Continue surveillance", notes: "Assumed pending destructive sampling.", photo: "demo/photos/plaster.svg" },
    { b: "mh01", code: "MH01-007", floor: "4", room: "Structural", loc: "Beams above ceiling, west", cat: "Surfacing", desc: "Spray-applied fireproofing", ha: "HA-FP-01", acm: "confirmed_acm", det: true, fibers: ["Amosite", "Chrysotile"], pct: 18, friable: "friable", mclass: "Surfacing", method: "PLM Point Count", orig: 2400, curr: 2400, unit: "SF", cond: "fair", access: "above_ceiling", disturb: "low", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/fireproof.svg" },
    { b: "mh01", code: "MH01-008", floor: "Penthouse", room: "PH-Mech", loc: "Exterior louver surrounds", cat: "Miscellaneous", desc: "Transite panels", ha: "HA-TR-01", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 20, friable: "non_friable", mclass: "Miscellaneous", cat12: "II", method: "PLM", orig: 180, curr: 180, unit: "SF", cond: "good", access: "restricted", disturb: "low", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/transite.svg" },
    { b: "mh01", code: "MH01-009", floor: "2", room: "Perimeter", loc: "Original steel sash, south", cat: "Miscellaneous", desc: "Window glazing compound", ha: "HA-GL-01", acm: "assumed_acm", friable: "non_friable", mclass: "Miscellaneous", cat12: "II", orig: 240, curr: 240, unit: "LF", cond: "good", access: "accessible", disturb: "low", response: "Continue surveillance", photo: "demo/photos/glazing.svg" },
    { b: "mh01", code: "MH01-010", floor: "1–8", room: "Perimeter", loc: "Window/door perimeters", cat: "Miscellaneous", desc: "Exterior / interior caulk", ha: "HA-CK-01", acm: "unknown", friable: "non_friable", mclass: "Miscellaneous", orig: 800, curr: 800, unit: "LF", cond: "fair", access: "accessible", disturb: "low", response: "Further sampling", photo: "demo/photos/caulk.svg" },
    { b: "mh01", code: "MH01-011", floor: "Basement", room: "Boiler tie-in", loc: "Abandoned boiler breeching stub", cat: "Thermal System Insulation", desc: "Boiler insulation remnant", ha: "HA-TSI-03", acm: "confirmed_acm", det: true, fibers: ["Chrysotile", "Amosite"], pct: 60, friable: "friable", mclass: "TSI", method: "PLM", orig: 40, curr: 40, unit: "SF", cond: "needs_repair", access: "mechanical_space", disturb: "high", label: true, labelCond: "fair", response: "Repair", photo: "demo/photos/boiler.svg" },
    { b: "mh01", code: "MH01-012", floor: "1", room: "OR suite", loc: "Operating rooms 1–4", cat: "Miscellaneous", desc: "Sheet vinyl flooring", ha: "HA-SV-01", acm: "non_acm", det: false, pct: 0, method: "PLM", orig: 2100, curr: 2100, unit: "SF", cond: "good", response: "No action" },
    { b: "mh01", code: "MH01-013", floor: "5", room: "Chase 5-W", loc: "Hot water elbows, west chase", cat: "Thermal System Insulation", desc: "Mudded pipe elbows", ha: "HA-TSI-02", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 55, friable: "friable", mclass: "TSI", method: "PLM", orig: 9, curr: 9, unit: "EA", cond: "significantly_damaged", access: "restricted", disturb: "high", label: false, labelCond: "missing", response: "Repair", notes: "High-priority damaged ACM. Restrict access.", photo: "demo/photos/damaged-tsi.svg" },
    { b: "mh01", code: "MH01-014", floor: "6", room: "Nursing 6", loc: "Nurse station and alcoves", cat: "Miscellaneous", desc: "12×12 vinyl floor tile, grey", ha: "HA-FT-02", acm: "non_acm", det: false, pct: 0, method: "PLM", orig: 6400, curr: 6400, unit: "SF", cond: "good", response: "No action" },
    { b: "mh01", code: "MH01-015", floor: "Roof", room: "Roof", loc: "Original built-up roof field", cat: "Miscellaneous", desc: "Built-up roofing felts", ha: "HA-RF-01", acm: "assumed_acm", friable: "non_friable", mclass: "Miscellaneous", cat12: "I", orig: 18000, curr: 18000, unit: "SF", cond: "fair", access: "restricted", disturb: "low", response: "Continue surveillance", photo: "demo/photos/roof.svg" },
    { b: "mh02", code: "MH02-001", floor: "1", room: "Lobby", loc: "Public lobby field", cat: "Miscellaneous", desc: "9×9 floor tile under carpet", ha: "HA-FT-L", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 3, friable: "non_friable", cat12: "I", method: "PLM", orig: 2800, curr: 2800, unit: "SF", cond: "good", access: "accessible", disturb: "low", response: "Continue surveillance", photo: "demo/photos/floor-tile.svg" },
    { b: "mh02", code: "MH02-002", floor: "1", room: "Lobby", loc: "Beneath tile", cat: "Miscellaneous", desc: "Black mastic", ha: "HA-FT-L", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 6, method: "PLM", orig: 2800, curr: 2800, unit: "SF", cond: "good", response: "Continue surveillance", photo: "demo/photos/mastic.svg" },
    { b: "mh02", code: "MH02-003", floor: "2", room: "Chase 2", loc: "Vertical pipe chase", cat: "Thermal System Insulation", desc: "Pipe insulation, fiberglass over residual ACM", ha: "HA-TSI-D", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 15, friable: "friable", mclass: "TSI", method: "PLM", orig: 90, curr: 90, unit: "LF", cond: "fair", access: "restricted", disturb: "low", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/tsi-pipe.svg" },
    { b: "mh02", code: "MH02-004", floor: "3", room: "Radiology", loc: "Procedure rooms 3A–3C", cat: "Surfacing", desc: "Ceiling plaster", ha: "HA-PL-D", acm: "assumed_acm", mclass: "Surfacing", orig: 3600, curr: 3600, unit: "SF", cond: "good", response: "Continue surveillance", photo: "demo/photos/plaster.svg" },
    { b: "mh02", code: "MH02-005", floor: "1–6", room: "Egress", loc: "Rated door cores", cat: "Miscellaneous", desc: "Fire door insulation", ha: "HA-FD-01", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 25, friable: "non_friable", method: "PLM", orig: 22, curr: 22, unit: "EA", cond: "good", response: "Continue surveillance" },
    { b: "mh03", code: "MH03-001", floor: "1", room: "Boiler hall", loc: "Boiler No. 2 breeching", cat: "Thermal System Insulation", desc: "Breeching insulation", ha: "HA-BR-01", acm: "confirmed_acm", det: true, fibers: ["Amosite", "Chrysotile"], pct: 70, friable: "friable", mclass: "TSI", method: "PLM", orig: 220, curr: 220, unit: "SF", cond: "damaged", access: "mechanical_space", disturb: "high", label: true, labelCond: "fair", response: "Repair", notes: "Jacket torn at expansion joint.", photo: "demo/photos/damaged-tsi.svg" },
    { b: "mh03", code: "MH03-002", floor: "1", room: "Boiler hall", loc: "Condensate tank", cat: "Thermal System Insulation", desc: "Tank insulation", ha: "HA-TK-01", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 35, friable: "friable", mclass: "TSI", method: "PLM", orig: 160, curr: 160, unit: "SF", cond: "fair", access: "mechanical_space", disturb: "moderate", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/boiler.svg" },
    { b: "mh03", code: "MH03-003", floor: "1", room: "Boiler hall", loc: "Flange sets, steam header", cat: "Miscellaneous", desc: "Flange gaskets", ha: "HA-GK-01", acm: "assumed_acm", friable: "non_friable", orig: 34, curr: 34, unit: "EA", cond: "good", response: "Continue surveillance" },
    { b: "mh03", code: "MH03-004", floor: "Roof", room: "Cooling", loc: "Abandoned cooling tower fill panels", cat: "Miscellaneous", desc: "Transite fill / panels", ha: "HA-TR-P", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 22, friable: "non_friable", cat12: "II", method: "PLM", orig: 96, curr: 96, unit: "SF", cond: "fair", access: "restricted", disturb: "low", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/transite.svg" },
    { b: "mh03", code: "MH03-005", floor: "Basement", room: "Electrical", loc: "Historic cloth wiring remnants", cat: "Miscellaneous", desc: "Electrical cloth insulation", ha: "HA-EL-01", acm: "unknown", orig: 40, curr: 40, unit: "LF", cond: "inaccessible", access: "inaccessible", response: "Further sampling" },
    { b: "mh04", code: "MH04-001", floor: "1", room: "Clinic", loc: "Waiting and corridors", cat: "Miscellaneous", desc: "12×12 floor tile", ha: "HA-FT-E", acm: "non_acm", det: false, pct: 0, method: "PLM", orig: 9200, curr: 9200, unit: "SF", cond: "good", response: "No action" },
    { b: "mh04", code: "MH04-002", floor: "2", room: "Inpatient", loc: "Gypsum joints, 2nd floor", cat: "Miscellaneous", desc: "Joint compound", ha: "HA-JC-01", acm: "assumed_acm", orig: 14000, curr: 14000, unit: "SF", cond: "good", response: "Continue surveillance" },
    { b: "mh04", code: "MH04-003", floor: "3", room: "Offices", loc: "Open office", cat: "Miscellaneous", desc: "2×2 ceiling tile", ha: "HA-CT-E", acm: "non_acm", det: false, method: "PLM", orig: 7800, curr: 7800, unit: "SF", cond: "good", response: "No action", photo: "demo/photos/ceiling.svg" },
    { b: "mh04", code: "MH04-004", floor: "1", room: "Mech 1", loc: "Supply duct, original wrap remnant", cat: "Thermal System Insulation", desc: "Duct wrap (residual after 2025 project)", ha: "HA-DW-01", acm: "removed", det: true, fibers: ["Chrysotile"], pct: 15, friable: "friable", mclass: "TSI", method: "PLM", orig: 400, curr: 0, removed: 400, unit: "SF", cond: "removed", status: "removed", response: "No action", notes: "Completely removed July 2025. Record retained." },
    { b: "mhw1", code: "MHW1-001", floor: "1", room: "Clinic corridor", loc: "Public corridor", cat: "Miscellaneous", desc: "9×9 floor tile", ha: "HA-FT-W", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 5, method: "PLM", orig: 3100, curr: 3100, unit: "SF", cond: "fair", response: "Continue surveillance", photo: "demo/photos/floor-tile.svg" },
    { b: "mhw1", code: "MHW1-002", floor: "Basement", room: "Mech", loc: "HW piping", cat: "Thermal System Insulation", desc: "Pipe insulation", ha: "HA-TSI-W", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 30, friable: "friable", mclass: "TSI", method: "PLM", orig: 140, curr: 140, unit: "LF", cond: "good", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/tsi-pipe.svg" },
    { b: "mhw1", code: "MHW1-003", floor: "2", room: "Exam 12–20", loc: "Window perimeters", cat: "Miscellaneous", desc: "Window caulk", ha: "HA-CK-W", acm: "unknown", orig: 260, curr: 260, unit: "LF", cond: "fair", response: "Further sampling", photo: "demo/photos/caulk.svg" },
    { b: "mhw1", code: "MHW1-004", floor: "3", room: "Conference", loc: "Conference 301 ceiling", cat: "Surfacing", desc: "Ceiling texture", ha: "HA-TX-W", acm: "assumed_acm", mclass: "Surfacing", orig: 480, curr: 480, unit: "SF", cond: "good", response: "Continue surveillance" },
    { b: "mhw2", code: "MHW2-001", floor: "1", room: "Waiting", loc: "Waiting room", cat: "Miscellaneous", desc: "12×12 floor tile", ha: "HA-FT-I", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 2, method: "PLM", orig: 1600, curr: 1600, unit: "SF", cond: "good", response: "Continue surveillance" },
    { b: "mhw2", code: "MHW2-002", floor: "1", room: "MRI hold", loc: "West wall, original", cat: "Surfacing", desc: "Plaster wall", ha: "HA-PL-I", acm: "assumed_acm", orig: 900, curr: 900, unit: "SF", cond: "good", response: "Continue surveillance" },
    { b: "mhw2", code: "MHW2-003", floor: "2", room: "Above ceiling", loc: "HW lines above imaging", cat: "Thermal System Insulation", desc: "Pipe insulation", ha: "HA-TSI-I", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 28, friable: "friable", mclass: "TSI", method: "PLM", orig: 75, curr: 75, unit: "LF", cond: "inaccessible", access: "above_ceiling", disturb: "low", response: "Continue surveillance" },
    { b: "lusa", code: "LUSA-001", floor: "1", room: "Classrooms 101–112", loc: "Classroom floors", cat: "Miscellaneous", desc: "9×9 floor tile, green", ha: "HA-FT-S", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 5, friable: "non_friable", cat12: "I", method: "PLM", orig: 9800, curr: 9800, unit: "SF", cond: "fair", access: "accessible", disturb: "moderate", response: "Continue surveillance", photo: "demo/photos/floor-tile.svg" },
    { b: "lusa", code: "LUSA-002", floor: "1", room: "Classrooms 101–112", loc: "Beneath tile", cat: "Miscellaneous", desc: "Black mastic", ha: "HA-FT-S", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 7, method: "PLM", orig: 9800, curr: 9800, unit: "SF", cond: "fair", response: "Continue surveillance", photo: "demo/photos/mastic.svg" },
    { b: "lusa", code: "LUSA-003", floor: "Basement", room: "Pipe tunnel", loc: "Tunnel north run", cat: "Thermal System Insulation", desc: "Pipe insulation", ha: "HA-TSI-S", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 45, friable: "friable", mclass: "TSI", method: "PLM", orig: 410, curr: 410, unit: "LF", cond: "damaged", access: "confined_area", disturb: "moderate", label: true, labelCond: "missing", response: "Repair", photo: "demo/photos/damaged-tsi.svg" },
    { b: "lusa", code: "LUSA-004", floor: "1–3", room: "Corridors", loc: "Corridor walls", cat: "Surfacing", desc: "Plaster walls", ha: "HA-PL-S", acm: "assumed_acm", mclass: "Surfacing", orig: 22000, curr: 22000, unit: "SF", cond: "good", response: "Continue surveillance", photo: "demo/photos/plaster.svg" },
    { b: "lusa", code: "LUSA-005", floor: "2", room: "Rooms 201–208", loc: "Chalkboard mounts", cat: "Miscellaneous", desc: "Chalkboard mastic", ha: "HA-CB-01", acm: "assumed_acm", orig: 48, curr: 48, unit: "EA", cond: "good", response: "Continue surveillance" },
    { b: "lusa", code: "LUSA-006", floor: "2", room: "Classrooms", loc: "Lay-in ceilings", cat: "Miscellaneous", desc: "2×4 ceiling tile", ha: "HA-CT-S", acm: "non_acm", det: false, method: "PLM", orig: 16000, curr: 16000, unit: "SF", cond: "good", response: "No action", photo: "demo/photos/ceiling.svg" },
    { b: "lusa", code: "LUSA-007", floor: "1–3", room: "Perimeter", loc: "Original wood sash", cat: "Miscellaneous", desc: "Window glazing", ha: "HA-GL-S", acm: "assumed_acm", cat12: "II", orig: 620, curr: 620, unit: "LF", cond: "fair", response: "Continue surveillance", photo: "demo/photos/glazing.svg" },
    { b: "lusa", code: "LUSA-008", floor: "2", room: "Science 214", loc: "Abandoned hood base", cat: "Miscellaneous", desc: "Transite fume-hood remnant", ha: "HA-TR-S", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 18, friable: "non_friable", cat12: "II", method: "PLM", orig: 12, curr: 12, unit: "SF", cond: "good", access: "restricted", disturb: "low", label: true, labelCond: "good", response: "Restrict access", photo: "demo/photos/transite.svg" },
    { b: "lusa", code: "LUSA-009", floor: "3", room: "Storage 318", loc: "Above ceiling, east", cat: "Miscellaneous", desc: "Suspect debris / paper wrap", ha: "HA-NEW-01", acm: "unknown", orig: 6, curr: 6, unit: "SF", cond: "fair", provisional: true, response: "Further sampling", notes: "Discovered during 2026 surveillance. Provisional record.", photo: "demo/photos/sample-bag.svg" },
    { b: "lusg", code: "LUSG-001", floor: "1", room: "Locker rooms", loc: "Boys / girls locker floors", cat: "Miscellaneous", desc: "9×9 floor tile", ha: "HA-FT-G", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 4, method: "PLM", orig: 2400, curr: 2000, removed: 400, unit: "SF", cond: "fair", response: "Continue surveillance", notes: "400 SF removed during 2026 locker renovation.", photo: "demo/photos/floor-tile.svg" },
    { b: "lusg", code: "LUSG-002", floor: "Mezzanine", room: "Boiler mezz", loc: "Heating piping", cat: "Thermal System Insulation", desc: "Pipe insulation", ha: "HA-TSI-G", acm: "confirmed_acm", det: true, fibers: ["Chrysotile"], pct: 50, friable: "friable", mclass: "TSI", method: "PLM", orig: 85, curr: 85, unit: "LF", cond: "needs_repair", label: true, labelCond: "replaced", response: "Repair", photo: "demo/photos/tsi-pipe.svg" },
    { b: "lusg", code: "LUSG-003", floor: "Roof", room: "Roof", loc: "Low-slope gym roof", cat: "Miscellaneous", desc: "Built-up roofing", ha: "HA-RF-G", acm: "assumed_acm", cat12: "I", orig: 22000, curr: 22000, unit: "SF", cond: "fair", response: "Continue surveillance", photo: "demo/photos/roof.svg" },
    { b: "lusg", code: "LUSG-004", floor: "1", room: "Gym", loc: "Original gymnasium walls", cat: "Surfacing", desc: "Plaster", ha: "HA-PL-G", acm: "assumed_acm", mclass: "Surfacing", orig: 11000, curr: 11000, unit: "SF", cond: "good", response: "Continue surveillance", photo: "demo/photos/plaster.svg" },
    { b: "lusg", code: "LUSG-005", floor: "1", room: "Gym floor", loc: "Under wood floor, perimeter", cat: "Miscellaneous", desc: "Gym floor mastic", ha: "HA-GM-01", acm: "non_acm", det: false, method: "PLM", orig: 800, curr: 800, unit: "SF", cond: "good", response: "No action" },
    { b: "lusg", code: "LUSG-006", floor: "Mezzanine", room: "Boiler mezz", loc: "Boiler shell", cat: "Thermal System Insulation", desc: "Boiler insulation", ha: "HA-BL-G", acm: "confirmed_acm", det: true, fibers: ["Amosite"], pct: 25, friable: "friable", mclass: "TSI", method: "PLM", orig: 70, curr: 70, unit: "SF", cond: "fair", label: true, labelCond: "good", response: "Continue surveillance", photo: "demo/photos/boiler.svg" },
  ];

  const haCache = new Map<string, string>();
  const invByCode: Record<string, string> = {};

  for (const item of invs) {
    const b = buildings[item.b];
    const haKey = `${item.b}:${item.ha}`;
    if (!haCache.has(haKey)) {
      const ha = await db.homogeneousArea.create({
        data: {
          organizationId: org.id,
          buildingId: b.id,
          haCode: item.ha,
          material: item.desc,
          materialDescription: item.desc,
          floors: item.floor,
          rooms: item.room,
          determination: item.acm,
          quantity: item.curr,
          quantityUnit: item.unit,
          condition: item.cond,
        },
      });
      haCache.set(haKey, ha.id);
    }
    const rec = await db.inventoryItem.create({
      data: {
        organizationId: org.id,
        clientId: b.clientId,
        facilityId: b.facilityId,
        buildingId: b.id,
        homogeneousAreaId: haCache.get(haKey),
        inventoryCode: item.code,
        floor: item.floor,
        room: item.room,
        specificLocation: item.loc,
        materialCategory: item.cat,
        materialDescription: item.desc,
        acmClassification: item.acm,
        asbestosDetected: item.det ?? null,
        fiberTypes: JSON.stringify(item.fibers ?? []),
        asbestosPercent: item.pct ?? null,
        friable: item.friable ?? null,
        materialClass: item.mclass ?? null,
        categoryIorII: item.cat12 ?? null,
        analyticalMethod: item.method ?? null,
        originalQuantity: item.orig,
        currentQuantity: item.curr,
        quantityRepaired: item.repaired ?? 0,
        quantityRemoved: item.removed ?? 0,
        quantityUnit: item.unit,
        quantitySource: "survey estimate",
        condition: item.cond,
        accessibility: item.access ?? "accessible",
        disturbancePotential: item.disturb ?? "low",
        labelPresent: item.label ?? null,
        labelCondition: item.labelCond ?? null,
        responseAction: item.response ?? null,
        isProvisional: item.provisional ?? false,
        recordStatus: item.status ?? "active",
        notes: item.notes ?? null,
      },
    });
    invByCode[item.code] = rec.id;

    await db.inventoryQuantityHistory.create({
      data: {
        inventoryItemId: rec.id,
        previousQty: null,
        newQty: item.orig,
        delta: item.orig,
        unit: item.unit,
        reason: "Original survey estimate",
        sourceType: "survey",
        changedById: users.sofia.id,
        changedAt: days(-800),
      },
    });
    await db.inventoryConditionHistory.create({
      data: {
        inventoryItemId: rec.id,
        previousCondition: null,
        newCondition: "good",
        inspectorId: users.sofia.id,
        notes: "Initial survey condition",
        changedAt: days(-800),
      },
    });
    if (item.cond !== "good" && item.cond !== "removed") {
      await db.inventoryConditionHistory.create({
        data: {
          inventoryItemId: rec.id,
          previousCondition: "good",
          newCondition: item.cond,
          inspectorId: users.sofia.id,
          notes: "Condition updated during surveillance",
          changedAt: days(-40),
        },
      });
    }
    if (item.removed) {
      await db.inventoryQuantityHistory.create({
        data: {
          inventoryItemId: rec.id,
          previousQty: item.orig,
          newQty: item.curr,
          delta: -item.removed,
          unit: item.unit,
          reason: item.code === "LUSG-001" ? "2026 locker renovation removal" : "2025 abatement project",
          sourceType: "removal",
          changedById: users.marcus.id,
          changedAt: item.code === "LUSG-001" ? days(-70) : days(-380),
        },
      });
    }
    if (item.labelCond) {
      await db.inventoryLabelHistory.create({
        data: {
          inventoryItemId: rec.id,
          labelPresent: item.label ?? false,
          labelCondition: item.labelCond,
          labelMissing: item.labelCond === "missing",
          labelReplaced: item.labelCond === "replaced",
          changedById: users.sofia.id,
          changedAt: days(-40),
        },
      });
    }
  }

  async function photo(storageKey: string, filename: string, clientId: string, buildingId: string, vis = "internal") {
    return db.photo.create({
      data: {
        organizationId: org.id,
        clientId,
        buildingId,
        storageKey,
        originalFilename: filename,
        mimeType: "image/svg+xml",
        size: 4200,
        width: 1400,
        height: 920,
        capturedAt: days(-40, 11),
        uploadedById: users.sofia.id,
        photographerId: users.sofia.id,
        visibility: vis,
      },
    });
  }

  for (const item of invs) {
    if (!item.photo) continue;
    const b = buildings[item.b];
    const p = await photo(item.photo, path.basename(item.photo), b.clientId, b.id, item.b === "mhw2" ? "internal" : "client");
    await db.photoLink.create({
      data: {
        photoId: p.id,
        recordType: "inventory",
        recordId: invByCode[item.code],
        category: item.cond.includes("damaged") || item.cond === "needs_repair" ? "damage" : "material",
        caption: item.desc,
        primaryPhoto: true,
        visibility: "client",
        inventoryItemId: invByCode[item.code],
      },
    });
  }

  // Layered sample 26-001 floor tile + mastic
  const s26001 = await db.sample.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      homogeneousAreaId: haCache.get("mh01:HA-FT-01"),
      sampleNumber: "26-001",
      clientSampleNumber: "MH-A-01",
      floor: "1",
      room: "Corridor A",
      location: "At column line 4, north side",
      material: "9×9 floor tile over black mastic",
      materialDescription: "Layered finish system",
      collectionDate: days(-90),
      collectionTime: "09:40",
      inspectorId: users.sofia.id,
      samplingMethod: "Modified ELAP 198.1",
      laboratoryId: lab.id,
      labSampleNumber: "GL-26-4410",
      analysisMethod: "PLM",
      dateReceived: days(-88),
      dateAnalyzed: days(-86),
      dateResultsReceived: days(-85),
      status: "reconciled",
    },
  });
  const l1 = await db.sampleLayer.create({
    data: { sampleId: s26001.id, layerNumber: 1, description: "Floor tile", asbestosDetected: true, asbestosPercent: 4, fiberTypes: JSON.stringify(["Chrysotile"]), classification: "confirmed_acm" },
  });
  const l2 = await db.sampleLayer.create({
    data: { sampleId: s26001.id, layerNumber: 2, description: "Black mastic", asbestosDetected: true, asbestosPercent: 8, fiberTypes: JSON.stringify(["Chrysotile"]), classification: "confirmed_acm" },
  });
  await db.sampleResult.create({ data: { sampleLayerId: l1.id, asbestosDetected: true, asbestosPercent: 4, fiberTypes: JSON.stringify(["Chrysotile"]), method: "PLM", reviewed: true, reviewedById: users.marcus.id, reviewedAt: days(-84) } });
  await db.sampleResult.create({ data: { sampleLayerId: l2.id, asbestosDetected: true, asbestosPercent: 8, fiberTypes: JSON.stringify(["Chrysotile"]), method: "PLM", reviewed: true, reviewedById: users.marcus.id, reviewedAt: days(-84) } });
  await db.sampleInventoryLink.create({ data: { sampleId: s26001.id, inventoryItemId: invByCode["MH01-003"], layerNumber: 1, linkType: "supporting" } });
  await db.sampleInventoryLink.create({ data: { sampleId: s26001.id, inventoryItemId: invByCode["MH01-004"], layerNumber: 2, linkType: "supporting" } });

  const moreSamples: {
    num: string; b: string; inv?: string; floor: string; room: string; loc: string; mat: string;
    status: string; det: boolean; pct: number; fibers: string[]; method: string; collected: number;
    layer?: string; client?: string;
  }[] = [
    { num: "26-002", b: "mh01", inv: "MH01-001", floor: "Basement", room: "Mech-01", loc: "Steam main mid-span", mat: "Pipe insulation", status: "reconciled", det: true, pct: 40, fibers: ["Chrysotile"], method: "PLM", collected: -800 },
    { num: "26-003", b: "mh01", inv: "MH01-005", floor: "2", room: "Admin", loc: "Office 214", mat: "Ceiling tile", status: "reconciled", det: false, pct: 0, fibers: [], method: "PLM", collected: -800 },
    { num: "26-014", b: "mh01", inv: "MH01-007", floor: "4", room: "Above ceiling", loc: "Beam F-12", mat: "Spray fireproofing", status: "reconciled", det: true, pct: 18, fibers: ["Amosite", "Chrysotile"], method: "PLM Point Count", collected: -400 },
    { num: "26-018", b: "mh03", inv: "MH03-001", floor: "1", room: "Boiler hall", loc: "Breeching east", mat: "Breeching insulation", status: "reconciled", det: true, pct: 70, fibers: ["Amosite", "Chrysotile"], method: "PLM", collected: -500 },
    { num: "26-104", b: "mh01", floor: "1", room: "Corridor B", loc: "Near elevator lobby", mat: "Suspect 12×12 tile", status: "at_lab", det: false, pct: 0, fibers: [], method: "PLM", collected: -2 },
    { num: "26-105", b: "lusa", inv: "LUSA-009", floor: "3", room: "Storage 318", loc: "Above ceiling east", mat: "Suspect paper wrap", status: "results_received", det: true, pct: 12, fibers: ["Chrysotile"], method: "PLM", collected: -8 },
    { num: "26-106", b: "mhw1", floor: "2", room: "Exam 16", loc: "Window head", mat: "Window caulk", status: "reviewed", det: false, pct: 0, fibers: [], method: "PLM", collected: -12 },
    { num: "26-090", b: "lusg", inv: "LUSG-001", floor: "1", room: "Boys locker", loc: "NE corner", mat: "9×9 floor tile", status: "reconciled", det: true, pct: 4, fibers: ["Chrysotile"], method: "PLM", collected: -100 },
  ];

  for (const s of moreSamples) {
    const b = buildings[s.b];
    const sample = await db.sample.create({
      data: {
        organizationId: org.id,
        clientId: b.clientId,
        buildingId: b.id,
        sampleNumber: s.num,
        clientSampleNumber: s.client,
        floor: s.floor,
        room: s.room,
        location: s.loc,
        material: s.mat,
        collectionDate: days(s.collected),
        inspectorId: users.sofia.id,
        laboratoryId: lab.id,
        analysisMethod: s.method,
        status: s.status,
        dateReceived: s.status === "at_lab" ? days(s.collected + 1) : days(s.collected + 2),
        dateAnalyzed: s.status === "at_lab" ? null : days(s.collected + 4),
        dateResultsReceived: ["results_received", "reviewed", "reconciled"].includes(s.status) ? days(s.collected + 5) : null,
      },
    });
    const layer = await db.sampleLayer.create({
      data: {
        sampleId: sample.id,
        layerNumber: 1,
        description: s.mat,
        asbestosDetected: s.status === "at_lab" ? null : s.det,
        asbestosPercent: s.status === "at_lab" ? null : s.pct,
        fiberTypes: JSON.stringify(s.fibers),
        classification: s.det ? "confirmed_acm" : "non_acm",
      },
    });
    if (s.status !== "at_lab") {
      await db.sampleResult.create({
        data: {
          sampleLayerId: layer.id,
          asbestosDetected: s.det,
          asbestosPercent: s.pct,
          fiberTypes: JSON.stringify(s.fibers),
          method: s.method,
          reviewed: s.status === "reviewed" || s.status === "reconciled",
          reviewedById: s.status === "reviewed" || s.status === "reconciled" ? users.marcus.id : null,
        },
      });
    }
    if (s.inv && s.status === "reconciled") {
      await db.sampleInventoryLink.create({
        data: { sampleId: sample.id, inventoryItemId: invByCode[s.inv], layerNumber: 1, linkType: "supporting" },
      });
    }
    const bag = await photo("demo/photos/sample-bag.svg", "sample-bag.svg", b.clientId, b.id, "client");
    await db.photoLink.create({
      data: {
        photoId: bag.id,
        recordType: "sample",
        recordId: sample.id,
        category: "sample_bag",
        caption: `Sample ${s.num}`,
        sampleId: sample.id,
      },
    });
  }

  const coc = await db.chainOfCustody.create({
    data: {
      organizationId: org.id,
      buildingId: buildings.mh01.id,
      projectName: "MH-01 2026 supplemental sampling",
      inspectorId: users.sofia.id,
      laboratoryId: lab.id,
      analysisRequested: "PLM",
      relinquishedBy: "Sofia Reyes",
      relinquishedAt: days(-2, 16),
      shippingMethod: "Courier",
      trackingNumber: "GL-COC-88421",
      status: "in_transit",
    },
  });
  await db.sample.updateMany({ where: { sampleNumber: "26-104" }, data: { cocId: coc.id, status: "at_lab" } });

  // Inspections
  const inspAnnual = await db.inspection.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      inspectionType: "annual_inspection",
      templateName: "Annual ACM Surveillance",
      scheduledDate: days(18),
      inspectorId: users.sofia.id,
      status: "scheduled",
    },
  });
  const inspPlant = await db.inspection.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh03.id,
      inspectionType: "annual_inspection",
      scheduledDate: days(-18),
      inspectorId: users.sofia.id,
      status: "scheduled",
      notes: "Overdue. Plant access coordinated with engineering.",
    },
  });
  const inspSchool = await db.inspection.create({
    data: {
      organizationId: org.id,
      clientId: lusd.id,
      buildingId: buildings.lusa.id,
      inspectionType: "periodic_surveillance",
      scheduledDate: days(-12),
      inspectorId: users.sofia.id,
      status: "in_progress",
      startedAt: days(-12, 8),
      completionPct: 62,
    },
  });
  const inspDone = await db.inspection.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      inspectionType: "annual_inspection",
      scheduledDate: days(-40),
      startedAt: days(-40, 7),
      completedAt: days(-40, 16),
      inspectorId: users.sofia.id,
      status: "completed",
      completionPct: 100,
      signedAt: days(-40, 16),
      findings: "Two damaged TSI fittings in basement. Significantly damaged elbows in 5th-floor chase. Labels missing on MH01-013.",
    },
  });
  await db.signature.create({
    data: {
      organizationId: org.id,
      inspectionId: inspDone.id,
      userId: users.sofia.id,
      signerName: "Sofia Reyes",
      signerRole: "Accredited Inspector",
      signatureData: "sofia-reyes",
      signedAt: days(-40, 16),
      meaning: "Inspection completion",
    },
  });

  const mh01Items = await db.inventoryItem.findMany({ where: { buildingId: buildings.mh01.id } });
  for (const it of mh01Items) {
    await db.inspectionItem.create({
      data: {
        inspectionId: inspDone.id,
        inventoryItemId: it.id,
        previousCondition: "good",
        currentCondition: it.condition,
        previousLabel: "good",
        currentLabel: it.labelCondition,
        inspected: true,
        inspectedAt: days(-40, 10),
        photoRequired: ["damaged", "significantly_damaged", "needs_repair"].includes(it.condition),
        photosSatisfied: true,
        notes: it.condition === "good" ? "No change." : "Condition change documented.",
      },
    });
  }
  const schoolItems = await db.inventoryItem.findMany({ where: { buildingId: buildings.lusa.id } });
  let i = 0;
  for (const it of schoolItems) {
    i += 1;
    await db.inspectionItem.create({
      data: {
        inspectionId: inspSchool.id,
        inventoryItemId: it.id,
        previousCondition: it.condition,
        currentCondition: i < 6 ? it.condition : null,
        inspected: i < 6,
        inspectedAt: i < 6 ? days(-12, 10) : null,
      },
    });
  }
  await db.suspectMaterial.create({
    data: {
      inspectionId: inspSchool.id,
      buildingId: buildings.lusa.id,
      inventoryItemId: invByCode["LUSA-009"],
      floor: "3",
      room: "Storage 318",
      location: "Above ceiling, east",
      material: "Suspect debris / paper wrap",
      estimatedQty: 6,
      unit: "SF",
      condition: "fair",
      friability: "friable",
      action: "Collect sample now",
      notes: "Newly discovered during surveillance.",
    },
  });

  await db.inspection.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mhw2.id,
      inspectionType: "annual_inspection",
      scheduledDate: days(25),
      inspectorId: users.sofia.id,
      status: "scheduled",
      notes: "Photography prohibited in this building.",
    },
  });
  await db.inspection.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh02.id,
      inspectionType: "annual_inspection",
      scheduledDate: days(40),
      inspectorId: users.sofia.id,
      status: "scheduled",
    },
  });

  // Repairs
  const r1 = await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      inventoryItemId: invByCode["MH01-002"],
      repairCode: "R-26-014",
      problem: "Two mudded elbows with exposed ends on steam mains.",
      condition: "damaged",
      identifiedAt: days(-40),
      inspectorId: users.sofia.id,
      priority: "high",
      recommendedResponse: "Repair / encapsulate",
      assignedContractorId: contractor.id,
      assignedUserId: users.renee.id,
      workOrderNumber: "WO-88411",
      poNumber: "PO-MH-22910",
      estimatedCost: 4800,
      scheduledDate: days(-5),
      status: "awaiting_verification",
      completionDate: days(-1),
      completionNotes: "Gloves and wrap applied. Awaiting Northline verification.",
    },
  });
  await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      inventoryItemId: invByCode["MH01-013"],
      repairCode: "R-26-015",
      problem: "Significantly damaged mudded elbows in 5th-floor west chase. Access unrestricted to facilities staff.",
      condition: "significantly_damaged",
      identifiedAt: days(-40),
      inspectorId: users.sofia.id,
      priority: "critical",
      recommendedResponse: "Restrict access and repair",
      assignedContractorId: contractor.id,
      workOrderNumber: "WO-88420",
      estimatedCost: 9200,
      scheduledDate: days(4),
      status: "scheduled",
    },
  });
  await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      inventoryItemId: invByCode["MH01-011"],
      repairCode: "R-26-016",
      problem: "Boiler insulation remnant deteriorating at abandoned breeching stub.",
      condition: "needs_repair",
      identifiedAt: days(-40),
      inspectorId: users.sofia.id,
      priority: "high",
      recommendedResponse: "Remove residual TSI",
      status: "open",
      scheduledDate: days(-10),
      estimatedCost: 6400,
    },
  });
  await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh03.id,
      inventoryItemId: invByCode["MH03-001"],
      repairCode: "R-26-021",
      problem: "Breeching jacket torn at expansion joint. Visible damaged TSI.",
      condition: "damaged",
      identifiedAt: days(-200),
      inspectorId: users.sofia.id,
      priority: "critical",
      recommendedResponse: "Repair",
      assignedContractorId: contractor.id,
      status: "open",
      scheduledDate: days(-20),
      estimatedCost: 18500,
    },
  });
  const rDone = await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: metro.id,
      buildingId: buildings.mh01.id,
      inventoryItemId: invByCode["MH01-001"],
      repairCode: "R-25-088",
      problem: "Small puncture in canvas jacket, mid-span steam main.",
      condition: "damaged",
      identifiedAt: days(-200),
      inspectorId: users.sofia.id,
      priority: "medium",
      recommendedResponse: "Repair",
      assignedContractorId: contractor.id,
      assignedUserId: users.renee.id,
      status: "closed",
      scheduledDate: days(-160),
      completionDate: days(-150),
      estimatedCost: 1200,
    },
  });
  await db.repairVerification.create({
    data: {
      repairId: rDone.id,
      verificationDate: days(-148),
      inspectorId: users.sofia.id,
      satisfactory: true,
      updatedCondition: "good",
      labelStatus: "good",
      notes: "Wrap intact. Label present.",
    },
  });
  await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: lusd.id,
      buildingId: buildings.lusa.id,
      inventoryItemId: invByCode["LUSA-003"],
      repairCode: "R-26-040",
      problem: "Damaged TSI in pipe tunnel, north run. Jacket missing on 8 LF.",
      condition: "damaged",
      identifiedAt: days(-30),
      inspectorId: users.sofia.id,
      priority: "high",
      recommendedResponse: "Repair",
      status: "open",
      scheduledDate: days(10),
      estimatedCost: 7600,
    },
  });
  await db.repair.create({
    data: {
      organizationId: org.id,
      clientId: lusd.id,
      buildingId: buildings.lusg.id,
      inventoryItemId: invByCode["LUSG-002"],
      repairCode: "R-26-041",
      problem: "Pipe insulation on mezzanine needs repair at hangers.",
      condition: "needs_repair",
      identifiedAt: days(-30),
      inspectorId: users.sofia.id,
      priority: "medium",
      recommendedResponse: "Repair",
      status: "assigned",
      assignedContractorId: contractor.id,
      scheduledDate: days(20),
    },
  });

  const before = await photo("demo/photos/damaged-tsi.svg", "before.svg", metro.id, buildings.mh01.id, "client");
  const after = await photo("demo/photos/repair-after.svg", "after.svg", metro.id, buildings.mh01.id, "client");
  await db.photoLink.create({ data: { photoId: before.id, recordType: "repair", recordId: r1.id, category: "before", caption: "Exposed elbow before wrap", repairId: r1.id, inventoryItemId: invByCode["MH01-002"] } });
  await db.photoLink.create({ data: { photoId: after.id, recordType: "repair", recordId: r1.id, category: "after", caption: "After encapsulation", repairId: r1.id, inventoryItemId: invByCode["MH01-002"] } });

  await db.removalEvent.create({
    data: {
      organizationId: org.id,
      buildingId: buildings.mh04.id,
      inventoryItemId: invByCode["MH04-004"],
      quantityBefore: 400,
      quantityRemoved: 400,
      quantityRemaining: 0,
      unit: "SF",
      removedAt: days(-380),
      contractorId: contractor.id,
      projectNumber: "ABT-25-118",
      workOrder: "WO-77102",
      notificationNumber: "MI-NESHAP-25-4410",
      wasteShipment: "WSR-25-99012",
      disposalFacility: "Wayne Disposal, Belleville MI",
      notes: "Complete removal of residual duct wrap during AHU replacement.",
    },
  });
  await db.removalEvent.create({
    data: {
      organizationId: org.id,
      buildingId: buildings.lusg.id,
      inventoryItemId: invByCode["LUSG-001"],
      quantityBefore: 2400,
      quantityRemoved: 400,
      quantityRemaining: 2000,
      unit: "SF",
      removedAt: days(-70),
      contractorId: contractor.id,
      projectNumber: "ABT-26-014",
      workOrder: "WO-88100",
      notificationNumber: "MI-NESHAP-26-1188",
      wasteShipment: "WSR-26-1104",
      disposalFacility: "Wayne Disposal, Belleville MI",
      notes: "Partial removal — boys locker renovation wet area.",
    },
  });

  // Documents
  const docs = [
    { name: "MH-01 Asbestos Management Plan", type: "management_plan", b: "mh01", vis: "client", rev: 3 },
    { name: "MH-01 2025 Annual Inspection Report", type: "inspection_report", b: "mh01", vis: "client", rev: 0 },
    { name: "GLFL Laboratory Report GL-26-4410", type: "laboratory_report", b: "mh01", vis: "client", rev: 0 },
    { name: "Chain of Custody GL-COC-88421", type: "chain_of_custody", b: "mh01", vis: "internal", rev: 0 },
    { name: "MH-03 Central Plant Survey (2018)", type: "survey_report", b: "mh03", vis: "client", rev: 1 },
    { name: "LUSD-A AHERA Management Plan", type: "management_plan", b: "lusa", vis: "client", rev: 6 },
    { name: "Abatement closeout ABT-25-118", type: "abatement_record", b: "mh04", vis: "client", rev: 0 },
    { name: "Waste shipment WSR-26-1104", type: "waste_manifest", b: "lusg", vis: "internal", rev: 0 },
  ];
  for (const d of docs) {
    const b = buildings[d.b];
    const storageKey = `demo/docs/${d.type}-${d.b}.txt`;
    await writeDemo(storageKey, `${d.name}\nNorthline Environmental\nConfidential compliance record\nRevision ${d.rev}\n`);
    await db.document.create({
      data: {
        organizationId: org.id,
        clientId: b.clientId,
        buildingId: b.id,
        name: d.name,
        docType: d.type,
        storageKey,
        originalFilename: `${d.name}.txt`,
        mimeType: "text/plain",
        size: 240,
        documentDate: days(-40),
        revision: d.rev,
        visibility: d.vis,
        uploadedById: users.marcus.id,
        description: d.name,
      },
    });
  }

  // Floor plans
  for (const [key, name] of [
    ["mh01", "Main Hospital L1"],
    ["mh03", "Central Plant"],
    ["lusa", "Academic L1"],
  ] as const) {
    const b = buildings[key];
    const storageKey = `demo/plans/${key}.svg`;
    await writeDemo(
      storageKey,
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#f4f7fb"/><rect x="80" y="80" width="1440" height="840" fill="none" stroke="#0b857f" stroke-width="3"/><text x="100" y="60" font-family="sans-serif" font-size="22" fill="#0c1320">${name}</text></svg>`
    );
    const fp = await db.floorPlan.create({
      data: {
        organizationId: org.id,
        buildingId: b.id,
        name,
        storageKey,
        mimeType: "image/svg+xml",
        originalFilename: `${key}.svg`,
      },
    });
    const firstInv = await db.inventoryItem.findFirst({ where: { buildingId: b.id } });
    if (firstInv) {
      await db.floorPlanMarker.create({
        data: { floorPlanId: fp.id, recordType: "inventory", recordId: firstInv.id, x: 0.28, y: 0.4, label: firstInv.inventoryCode },
      });
    }
  }

  await db.contractorAcknowledgement.create({
    data: {
      organizationId: org.id,
      contractorId: contractor.id,
      buildingId: buildings.mh01.id,
      employeeName: "Renee Vale",
      acknowledgedAt: days(-20),
      inventoryProvided: true,
      documentsProvided: "Current ACM inventory, mechanical room labels map",
      expiresAt: days(345),
    },
  });

  const notifs = [
    { user: users.emma.id, type: "inspection_overdue", title: "Central Plant inspection overdue", body: "MH-03 annual inspection is 18 days overdue.", href: "/buildings" },
    { user: users.marcus.id, type: "inspection_overdue", title: "Two inspections overdue", body: "MH-03 and LUSD-A require immediate scheduling.", href: "/queue" },
    { user: users.marcus.id, type: "repair_verify", title: "Repair R-26-014 awaits verification", body: "Basement steam elbows wrapped. Verify before close.", href: "/repairs" },
    { user: users.sofia.id, type: "sample_result", title: "Results ready for 26-105", body: "Positive PLM — reconcile with LUSA-009.", href: "/samples/reconcile" },
    { user: users.patricia.id, type: "repair_open", title: "High-priority ACM damage", body: "MH-01 5th-floor chase elbows remain significantly damaged.", href: "/portal" },
  ];
  for (const n of notifs) {
    await db.notification.create({
      data: { organizationId: org.id, userId: n.user, type: n.type, title: n.title, body: n.body, href: n.href },
    });
  }

  await db.task.createMany({
    data: [
      { organizationId: org.id, clientId: metro.id, buildingId: buildings.mh03.id, createdById: users.marcus.id, assignedToId: users.sofia.id, title: "Complete overdue Central Plant inspection", dueDate: days(3), priority: "critical", status: "open" },
      { organizationId: org.id, clientId: metro.id, buildingId: buildings.mh01.id, inventoryItemId: invByCode["MH01-002"], createdById: users.marcus.id, assignedToId: users.sofia.id, title: "Verify repair R-26-014", dueDate: days(1), priority: "high", status: "open" },
      { organizationId: org.id, clientId: lusd.id, buildingId: buildings.lusa.id, createdById: users.marcus.id, assignedToId: users.sofia.id, title: "Finish LUSD-A periodic surveillance", dueDate: days(2), priority: "high", status: "open" },
    ],
  });

  const acts = [
    { b: "mh01", type: "inspection", title: "Annual inspection completed", detail: "Sofia Reyes submitted MH-01 annual surveillance.", at: -40 },
    { b: "mh01", type: "repair", title: "Pipe insulation repair completed", detail: "R-25-088 closed after verification.", at: -148 },
    { b: "mh01", type: "sample", title: "Sample 26-104 collected", detail: "Suspect 12×12 tile, Corridor B.", at: -2 },
    { b: "mh04", type: "removal", title: "400 SF duct wrap removed", detail: "Complete removal, record retained as Removed.", at: -380 },
    { b: "lusg", type: "removal", title: "250 SF floor tile removed", detail: "Locker renovation — 400 SF actually removed.", at: -70 },
    { b: "lusa", type: "inventory", title: "New suspect material discovered", detail: "LUSA-009 provisional record created.", at: -12 },
    { b: "mh03", type: "inspection", title: "Annual inspection became overdue", detail: "No inspection since 2025.", at: -18 },
  ];
  for (const a of acts) {
    const b = buildings[a.b];
    await db.activityEvent.create({
      data: {
        organizationId: org.id,
        clientId: b.clientId,
        buildingId: b.id,
        actorId: users.sofia.id,
        eventType: a.type,
        title: a.title,
        detail: a.detail,
        createdAt: days(a.at),
      },
    });
  }

  await db.savedView.createMany({
    data: [
      { organizationId: org.id, userId: users.marcus.id, name: "Damaged ACM", entity: "inventory", filters: JSON.stringify({ acm: ["confirmed_acm", "assumed_acm"], condition: ["damaged", "significantly_damaged", "needs_repair"] }), shared: true },
      { organizationId: org.id, userId: users.marcus.id, name: "Samples awaiting results", entity: "samples", filters: JSON.stringify({ status: ["collected", "submitted", "at_lab"] }), shared: true },
      { organizationId: org.id, userId: users.sofia.id, name: "Inspections due", entity: "buildings", filters: JSON.stringify({ inspection: "due" }), shared: true },
      { organizationId: org.id, name: "TSI", entity: "inventory", filters: JSON.stringify({ category: "Thermal System Insulation" }), shared: true },
    ],
  });

  await db.regulatoryProfile.create({
    data: {
      organizationId: org.id,
      name: "Michigan / AHERA hybrid",
      jurisdiction: "MI",
      isDefault: true,
      config: JSON.stringify({
        inspectionFrequencyDays: 365,
        aheraSurveillanceDays: 180,
        classifications: ["confirmed_acm", "assumed_acm", "pacm", "non_acm", "unknown", "removed"],
        photoRequiredOn: ["damaged", "significantly_damaged", "needs_repair", "removed"],
      }),
    },
  });

  // persist compliance
  for (const b of Object.values(buildings)) {
    const now = new Date("2026-08-12T12:00:00");
    const building = await db.building.findUnique({ where: { id: b.id } });
    const damaged = await db.inventoryItem.count({
      where: { buildingId: b.id, recordStatus: "active", acmClassification: { in: ["confirmed_acm", "assumed_acm", "pacm"] }, condition: { in: ["damaged", "significantly_damaged", "needs_repair"] } },
    });
    const overdueRepair = await db.repair.count({
      where: { buildingId: b.id, status: { in: ["open", "assigned", "scheduled", "in_progress"] }, scheduledDate: { lt: now } },
    });
    const reasons: string[] = [];
    let status = "current";
    if (building?.nextInspectionAt && building.nextInspectionAt < now) {
      reasons.push("Inspection overdue");
      status = "action";
    } else if (building?.nextInspectionAt && building.nextInspectionAt < new Date(now.getTime() + 30 * 86400000)) {
      reasons.push("Inspection due within 30 days");
      status = "attention";
    }
    if (damaged) {
      reasons.push(`${damaged} damaged ACM material${damaged > 1 ? "s" : ""}`);
      status = "action";
    }
    if (overdueRepair) {
      reasons.push(`${overdueRepair} overdue repair${overdueRepair > 1 ? "s" : ""}`);
      status = "action";
    }
    if (!reasons.length) reasons.push("No identified outstanding actions");
    await db.building.update({ where: { id: b.id }, data: { complianceStatus: status, complianceReasons: JSON.stringify(reasons) } });
  }

  console.log("Seed complete.");
  console.log("  Admin:    emma.wright@northline.env / Strata2026!");
  console.log("  Manager:  marcus.chen@northline.env / Strata2026!");
  console.log("  Inspector:sofia.reyes@northline.env / Strata2026!");
  console.log("  Client:   patricia.holm@metrohealth.org / Strata2026!");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
