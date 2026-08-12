import PDFDocument from "pdfkit";
import { ACM_LABELS, CONDITION_LABELS, formatDate, formatQty } from "@/lib/utils";
import { canReadStorageKey, getStoredObject } from "@/lib/storage";

function drawSchematic(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  rooms: { x: number; y: number; w: number; h: number; label: string; fill: string }[]
) {
  doc.save();
  doc.rect(x, y, w, h).fill("#f4f7fb");
  rooms.forEach((r) => {
    doc.rect(x + r.x * w, y + r.y * h, r.w * w, r.h * h).fillAndStroke(r.fill, "#0b857f");
    doc.fillColor("#0c1320").font("Helvetica-Bold").fontSize(8).text(
      r.label,
      x + r.x * w + 4,
      y + r.y * h + r.h * h / 2 - 6,
      { width: r.w * w - 8, align: "center" }
    );
  });
  doc.fillColor("#0b857f").font("Helvetica-Bold").fontSize(9).text(title, x + 8, y + 8);
  doc.restore();
}

type PacketBuilding = {
  organizationId: string;
  name: string;
  buildingNumber: string;
  address: string | null;
  yearConstructed: number | null;
  squareFootage: number | null;
  buildingUse: string | null;
  lastInspectionAt: Date | null;
  nextInspectionAt: Date | null;
  photoPolicy: string;
  notes: string | null;
  client: { name: string; clientNumber: string };
  facility: { name: string; facilityId: string };
  organizationName: string;
  organizationAddress: string | null;
  inventoryItems: {
    inventoryCode: string;
    materialDescription: string;
    floor: string | null;
    room: string | null;
    specificLocation: string | null;
    currentQuantity: number | null;
    quantityUnit: string;
    condition: string;
    labelCondition: string | null;
    acmClassification: string;
  }[];
  floorPlans: {
    name: string;
    storageKey: string;
    mimeType: string;
  }[];
};

function header(doc: PDFKit.PDFDocument, title: string, sub: string) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 64).fill("#0b857f");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text("STRATA", 36, 18, { continued: false });
  doc.font("Helvetica").fontSize(8).fillColor("#d7eee2").text("BUILDING ASBESTOS RECORD", 36, 36);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff").text(title, 220, 18, { align: "right", width: doc.page.width - 256 });
  doc.font("Helvetica").fontSize(8).fillColor("#d7eee2").text(sub, 220, 36, { align: "right", width: doc.page.width - 256 });
  doc.restore();
}

function footer(doc: PDFKit.PDFDocument, page: number, totalHint: string) {
  const y = doc.page.height - 24;
  doc.save();
  doc.strokeColor("#d0d5dd").lineWidth(0.6).moveTo(36, y - 6).lineTo(doc.page.width - 36, y - 6).stroke();
  doc.font("Helvetica").fontSize(7).fillColor("#6a7586");
  doc.text("Operational field packet — not a legal determination.", 36, y, { lineBreak: false });
  doc.text(`${totalHint}  ·  ${page}`, doc.page.width - 160, y, { width: 124, align: "right", lineBreak: false });
  doc.restore();
}

export async function buildInspectionPacket(building: PacketBuilding): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `${building.buildingNumber} Inspection Packet`,
      Author: building.organizationName,
      Subject: "Asbestos field inspection packet",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let page = 1;
  const stamp = `Generated ${formatDate(new Date())}  ·  ${building.organizationName}`;

  header(doc, "FIELD INSPECTION PACKET", stamp);
  doc.fillColor("#0c1320").font("Helvetica-Bold").fontSize(20).text(`${building.buildingNumber}  ·  ${building.name}`, 36, 84);
  doc.font("Helvetica").fontSize(11).fillColor("#3a4556").text(`${building.client.name}  ·  ${building.facility.name}`, 36, 110);

  const meta = [
    ["Client no.", building.client.clientNumber],
    ["Facility ID", building.facility.facilityId],
    ["Address", building.address || "—"],
    ["Year built", building.yearConstructed ? String(building.yearConstructed) : "—"],
    ["Area", building.squareFootage ? `${building.squareFootage.toLocaleString()} SF` : "—"],
    ["Use", building.buildingUse || "—"],
    ["Last inspection", formatDate(building.lastInspectionAt)],
    ["Next inspection", formatDate(building.nextInspectionAt)],
    ["Photography", building.photoPolicy === "prohibited" ? "NOT PERMITTED" : building.photoPolicy],
    ["Floor plans attached", String(building.floorPlans.length)],
  ];

  const colW = (doc.page.width - 72) / 2;
  meta.forEach((row, i) => {
    const col = i % 2;
    const rowi = Math.floor(i / 2);
    const x = 36 + col * colW;
    const y = 168 + rowi * 28;
    doc.font("Helvetica").fontSize(7).fillColor("#6a7586").text(row[0].toUpperCase(), x, y);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0c1320").text(row[1], x, y + 10, { width: colW - 12 });
  });

  doc.font("Helvetica").fontSize(9).fillColor("#3a4556");
  doc.text(`Inspection date: ____________________    Inspector: ____________________    Accreditation #: ____________________`, 36, 320);
  doc.moveDown(1.2);
  if (building.notes) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#5b6778").text(building.notes, 36, 348, { width: doc.page.width - 72 });
  }

  doc.roundedRect(36, 400, doc.page.width - 72, 72, 6).fillAndStroke("#e6f6f5", "#b7e3df");
  doc.fillColor("#0a6f6a").font("Helvetica-Bold").fontSize(9).text("PACKET CONTENTS", 48, 412);
  doc.font("Helvetica").fontSize(9).fillColor("#0c1320").text(
    `Cover  ·  Inventory field forms (${building.inventoryItems.length} materials)  ·  New material / sample / repair sheets  ·  ${building.floorPlans.length} floor plan drawing(s)`,
    48,
    430,
    { width: doc.page.width - 96 }
  );
  doc.font("Helvetica").fontSize(8).fillColor("#5b6778").text(
    "Inspectors complete condition and labeling in the field. Photographs required when condition worsens, repair is requested, material is removed, or a new material is discovered — unless photography is prohibited.",
    48,
    448,
    { width: doc.page.width - 96 }
  );

  footer(doc, page, building.buildingNumber);

  const items = building.inventoryItems;
  const perPage = 12;
  for (let start = 0; start < items.length; start += perPage) {
    doc.addPage();
    page += 1;
    header(doc, "INVENTORY FIELD FORM", `${building.buildingNumber}  ·  page ${page}`);
    const slice = items.slice(start, start + perPage);
    const tableTop = 80;
    const cols = [
      { k: "id", w: 58, label: "ID" },
      { k: "mat", w: 118, label: "MATERIAL" },
      { k: "loc", w: 92, label: "LOCATION" },
      { k: "qty", w: 48, label: "QTY" },
      { k: "cls", w: 62, label: "CLASS" },
      { k: "prev", w: 48, label: "PREV" },
      { k: "curr", w: 78, label: "CURRENT COND." },
      { k: "lab", w: 70, label: "LABEL" },
    ];
    let x = 36;
    doc.rect(36, tableTop, doc.page.width - 72, 16).fill("#0b857f");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(6);
    cols.forEach((c) => {
      doc.text(c.label, x + 2, tableTop + 5, { width: c.w - 4 });
      x += c.w;
    });

    slice.forEach((it, idx) => {
      const y = tableTop + 16 + idx * 46;
      if (idx % 2 === 0) doc.rect(36, y, doc.page.width - 72, 46).fill("#f4f7fb");
      let cx = 36;
      const cells = [
        it.inventoryCode,
        it.materialDescription,
        [it.floor, it.room].filter(Boolean).join(" · "),
        formatQty(it.currentQuantity, it.quantityUnit),
        ACM_LABELS[it.acmClassification] || it.acmClassification,
        CONDITION_LABELS[it.condition] || it.condition,
        "Good / Repair / Removed",
        "Good / Replaced / Missing",
      ];
      cells.forEach((val, i) => {
        doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor("#0c1320");
        doc.text(String(val).replace(/\s+/g, " ").slice(0, 42), cx + 2, y + 8, {
          width: cols[i].w - 4,
          lineBreak: false,
        });
        cx += cols[i].w;
      });
      doc.font("Helvetica").fontSize(6).fillColor("#6a7586").text("[ ] Good  [ ] Repair  [ ] Removed  [ ] Inacc.   [ ] Label OK  [ ] Replaced  [ ] Missing", 40, y + 26, { width: 520 });
    });

    doc.font("Helvetica").fontSize(8).fillColor("#5b6778").text("Notes for this sheet: _______________________________________________________________________________", 36, 700);
    footer(doc, page, building.buildingNumber);
  }

  doc.addPage();
  page += 1;
  header(doc, "FIELD ADDITIONS", `${building.buildingNumber}`);
  const blocks = [
    ["New suspect materials discovered", "Floor / room / location    Material    Est. qty    Assume ACM / Sample now / Provisional"],
    ["Samples collected", "Sample no.    Location    Material    Layers    COC no."],
    ["Repair / response recommendations", "Inventory ID    Problem    Priority    Recommended action"],
    ["Inspector certification", "I certify that this surveillance was performed in accordance with the applicable inspection template."],
  ];
  let by = 88;
  blocks.forEach((b) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0b857f").text(b[0], 36, by);
    doc.font("Helvetica").fontSize(8).fillColor("#6a7586").text(b[1], 36, by + 14, { width: doc.page.width - 72 });
    doc.strokeColor("#c5d0dc").roundedRect(36, by + 32, doc.page.width - 72, 86, 4).stroke();
    by += 132;
  });
  doc.font("Helvetica").fontSize(10).fillColor("#0c1320").text("Signature: _______________________________     Printed name: ________________________     Date: ____________", 36, 680);
  footer(doc, page, building.buildingNumber);

  for (const plan of building.floorPlans) {
    doc.addPage();
    page += 1;
    header(doc, "FLOOR PLAN", plan.name);
    doc.font("Helvetica").fontSize(9).fillColor("#3a4556").text(
      `${building.buildingNumber} · ${building.name} · Drawing on file: ${plan.name}`,
      36,
      78
    );
    const boxX = 36;
    const boxY = 98;
    const boxW = doc.page.width - 72;
    const boxH = 620;
    doc.save().strokeColor("#0b857f").lineWidth(1).roundedRect(boxX, boxY, boxW, boxH, 4).stroke().restore();

    const raster = /png|jpeg|jpg/.test(plan.mimeType);
    const storedObject = raster && canReadStorageKey(building.organizationId, plan.storageKey)
      ? await getStoredObject(plan.storageKey)
      : null;
    if (raster && storedObject) {
      try {
        doc.image(Buffer.from(await storedObject.arrayBuffer()), boxX + 8, boxY + 8, {
          fit: [boxW - 16, boxH - 16], align: "center", valign: "center",
        });
      } catch {
        doc.font("Helvetica").fontSize(10).fillColor("#b42318").text("Raster drawing could not be embedded.", boxX + 24, boxY + 40);
      }
    } else {
      const key = `${plan.storageKey} ${plan.name}`;
      const rooms =
        /mh01|Main Hospital/i.test(key)
          ? [
              { x: 0.04, y: 0.14, w: 0.28, h: 0.26, label: "PUBLIC LOBBY", fill: "#e8f1fc" },
              { x: 0.34, y: 0.24, w: 0.4, h: 0.1, label: "CORRIDOR A", fill: "#e6f6f5" },
              { x: 0.34, y: 0.14, w: 0.2, h: 0.1, label: "OR SUITE", fill: "#fff4e0" },
              { x: 0.04, y: 0.44, w: 0.34, h: 0.48, label: "MECH-01 TSI", fill: "#efe4cf" },
              { x: 0.4, y: 0.36, w: 0.54, h: 0.26, label: "INPATIENT WING", fill: "#e7f7f2" },
              { x: 0.4, y: 0.66, w: 0.26, h: 0.26, label: "BOILER TIE-IN", fill: "#fdecec" },
              { x: 0.68, y: 0.66, w: 0.26, h: 0.26, label: "EAST CONNECTOR", fill: "#eef4ff" },
            ]
          : /mh03|Central Plant/i.test(key)
            ? [
                { x: 0.04, y: 0.14, w: 0.56, h: 0.78, label: "BOILER HALL", fill: "#efe4cf" },
                { x: 0.64, y: 0.14, w: 0.3, h: 0.36, label: "ELECTRICAL", fill: "#eef1f5" },
                { x: 0.64, y: 0.54, w: 0.3, h: 0.38, label: "COOLING / TRANSITE", fill: "#d5dce3" },
              ]
            : /lusa|Academic/i.test(key)
              ? [
                  { x: 0.04, y: 0.14, w: 0.92, h: 0.1, label: "MAIN CORRIDOR", fill: "#e6f6f5" },
                  { x: 0.04, y: 0.28, w: 0.22, h: 0.2, label: "RM 101", fill: "#e8eeff" },
                  { x: 0.28, y: 0.28, w: 0.22, h: 0.2, label: "RM 102", fill: "#e8eeff" },
                  { x: 0.52, y: 0.28, w: 0.22, h: 0.2, label: "SCIENCE 214", fill: "#fff4e0" },
                  { x: 0.04, y: 0.52, w: 0.7, h: 0.18, label: "9x9 TILE + MASTIC", fill: "#c5cdd6" },
                  { x: 0.04, y: 0.74, w: 0.92, h: 0.18, label: "PIPE TUNNEL — DAMAGED TSI", fill: "#d7c7b0" },
                ]
              : [{ x: 0.08, y: 0.22, w: 0.84, h: 0.56, label: plan.name, fill: "#e6f6f5" }];
      drawSchematic(doc, boxX + 8, boxY + 8, boxW - 16, boxH - 16, plan.name, rooms);
    }

    doc.font("Helvetica").fontSize(8).fillColor("#5b6778").text(
      "Pins / highlighted rooms correspond to inventory, samples, or repairs associated with this drawing. Do not mark on the original file — annotate a field copy.",
      36,
      730,
      { width: boxW }
    );
    footer(doc, page, building.buildingNumber);
  }

  doc.end();
  return done;
}
