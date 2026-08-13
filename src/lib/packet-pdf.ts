// The standalone build carries its font data in-memory and does not depend on
// Node's filesystem, which makes it safe in the Cloudflare Worker runtime.
// @ts-expect-error PDFKit does not publish types for its standalone entrypoint.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import { CONDITION_LABELS, formatQty } from "@/lib/utils";
import { canReadStorageKey, getStoredObject } from "@/lib/storage";
import { UNASSIGNED_LABEL, UNASSIGNED_LEVEL } from "@/lib/floor-order";

export type PacketOptions = { paper?: "letter" | "legal" | "a4" | "a3"; orientation?: "portrait" | "landscape"; density?: "standard" | "compact"; nestLayers?: boolean; groupRepeated?: boolean; includeFloorPlans?: boolean; includeRemoved?: boolean; floor?: string; functionalAreaId?: string; floorOrder?: "ascending" | "descending" };
export type PacketItem = { id?: string; inventoryCode: string; materialDescription: string; materialCategory?: string | null; floor: string | null; floorLevel?: number; floorLabel?: string; room: string | null; specificLocation: string | null; currentQuantity: number | null; quantityUnit: string; condition: string; labelCondition: string | null; acmClassification: string; functionalArea?: { id: string; name: string; faCode: string | null } | null; homogeneousAreaId?: string | null; sampleLinks?: { sample: { sampleNumber: string } }[]; inspectionItems?: { previousCondition: string | null; inspection: { completedAt: Date | null } }[]; recordStatus?: string; hasOpenRepair?: boolean };
type PacketBuilding = { organizationId: string; id?: string; name: string; buildingNumber: string; address: string | null; yearConstructed: number | null; squareFootage: number | null; buildingUse: string | null; lastInspectionAt: Date | null; nextInspectionAt: Date | null; photoPolicy: string; notes: string | null; client: { name: string; clientNumber: string }; facility: { name: string; facilityId: string }; organizationName: string; organizationAddress?: string | null; inventoryItems: PacketItem[]; floorPlans: { name: string; storageKey: string; mimeType: string }[]; ppe?: { item: string; required: boolean }[]; openRepairs?: { repairCode: string; problem: string }[] };
type Row = { item: PacketItem; members: PacketItem[]; group: string; layer: boolean; sample: string; location: string; previous: string; height: number };
export type PacketPage = { group?: string; rows: Row[]; first: boolean };
const SIZES: Record<string, [number, number]> = { letter: [612, 792], legal: [612, 1008], a4: [595, 842], a3: [842, 1191] };
const conditionKey = [["OK", "No change since last inspection"], ["F", CONDITION_LABELS.fair], ["D", CONDITION_LABELS.damaged], ["S", CONDITION_LABELS.significantly_damaged], ["R", CONDITION_LABELS.needs_repair], ["X", CONDITION_LABELS.removed], ["N", `${CONDITION_LABELS.inaccessible} — cannot reach`]];
// N is deliberately the same mnemonic as the condition code, so "cannot reach" is one
// letter to remember across both write-in cells rather than two.
const labelKey = [["OK", "Label present, legible"], ["R", "Replaced — you applied a new label"], ["M", "Missing — could not replace"], ["N", "Cannot reach to check or re-tag"], ["–", "Not required — concealed"]];

// Shared vertical metrics so pagination and rendering can never drift apart.
const TABLE_TOP = 52, COL_HEADER = 14, GROUP_HEADER = 14, FOOT_RESERVE = 44, CELL_PAD = 5;
export const COLUMN_HEADERS = ["COND.", "LABEL", "ITEM #", "SAMPLE #", "LOCATION", "MATERIAL", "EST. QTY."];
const LOCATION_COL = 4;
const MATERIAL_COL = 5;
// Location gets first claim on available width so it stays on one line whenever the
// printable sheet can accommodate it. Material wraps only when both cannot fit.
const SIZED = [
  { col: 2, min: 26, max: 90, floor: 26 },
  { col: 3, min: 32, max: 110, floor: 32 },
  { col: 5, min: 70, max: 220, floor: 70 },
  { col: 6, min: 36, max: 96, floor: 36 },
];
const MIN_LOCATION = 110;

function geometry(options: PacketOptions) { const portrait = (options.orientation ?? "portrait") === "portrait"; const [w, h] = SIZES[options.paper ?? "letter"]; const width = portrait ? w : h; const height = portrait ? h : w; const compact = options.density === "compact"; const font = { body: compact ? 6.5 : 7, head: compact ? 6 : 6.5, group: compact ? 7 : 7.5 }; return { width, height, portrait, font, margin: 22, row: compact ? 12.5 : 14, band: 92 }; }

// PDFKit measures text exactly; a character-count estimate over-allocated by ~40%, which
// cost a whole page on a building the size of 1707.
let metrics: PDFKit.PDFDocument | null = null;
function measurer(): PDFKit.PDFDocument { return (metrics ??= new PDFDocument({ size: [612, 792], margin: 0 })); }
function textHeight(text: string, width: number, size: number) { if (!text) return 0; const doc = measurer(); doc.font("Helvetica").fontSize(size); return doc.heightOfString(text, { width }) as number; }
function textWidth(text: string, size: number, bold = false) { if (!text) return 0; const doc = measurer(); doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size); return doc.widthOfString(text) as number; }

type RowText = { code: string; sample: string; location: string; material: string; quantity: string };

/** Column widths sized to this building's content, with Location receiving first priority. */
function columnWidths(text: RowText[], g: ReturnType<typeof geometry>): number[] {
  // Write-in cells are sized to hold a handwritten code, but never narrower than their
  // own column label — a wrapped "LABEL" header reads as two broken words.
  const mark = Math.ceil(Math.max(g.portrait ? 24 : 26, textWidth(COLUMN_HEADERS[0], g.font.head, true) + 7, textWidth(COLUMN_HEADERS[1], g.font.head, true) + 7));
  const cols = [mark, mark, 0, 0, MIN_LOCATION, 0, 0];
  const values: Record<number, string[]> = { 2: text.map((t) => t.code), 3: text.map((t) => t.sample), 5: text.map((t) => t.material), 6: text.map((t) => t.quantity) };
  const desired: Record<number, number> = {};
  for (const { col, min, max } of SIZED) {
    const widest = Math.max(textWidth(COLUMN_HEADERS[col], g.font.head, true), ...values[col].map((value) => textWidth(value, g.font.body)));
    desired[col] = Math.ceil(Math.min(max, Math.max(min, widest + 7)));
    cols[col] = Math.ceil(Math.min(max, Math.max(min, textWidth(COLUMN_HEADERS[col], g.font.head, true) + 7)));
  }
  const available = g.width - g.margin * 2;
  let remaining = available - cols.reduce((sum, width) => sum + width, 0);
  const locationDesired = Math.ceil(Math.max(MIN_LOCATION, textWidth(COLUMN_HEADERS[LOCATION_COL], g.font.head, true) + 7, ...text.map((value) => textWidth(value.location, g.font.body) + 7)));
  const locationExtra = Math.min(remaining, locationDesired - MIN_LOCATION);
  cols[LOCATION_COL] += locationExtra;
  remaining -= locationExtra;
  // Preserve exact identifiers and quantities next, then give remaining width to Material.
  for (const col of [2, 3, 6, MATERIAL_COL]) {
    const extra = Math.min(remaining, desired[col] - cols[col]);
    cols[col] += extra;
    remaining -= extra;
  }
  cols[LOCATION_COL] += remaining;
  return cols;
}

export type PacketLayout = { cols: number[]; pages: PacketPage[] };

/** Pure pagination and column sizing, shared by the PDF and the packet preview. */
export function packetLayout(items: PacketItem[], options: PacketOptions = {}): PacketLayout {
  const g = geometry(options); const visible = items.filter((item) => (options.includeRemoved || item.recordStatus !== "removed") && (!options.floor || item.floor === options.floor) && (!options.functionalAreaId || item.functionalArea?.id === options.functionalAreaId));
  // Sort on BuildingFloor.level, not the free-text floor name, then functional area, room, code.
  const collate = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const direction = options.floorOrder === "descending" ? -1 : 1;
  const decorated = visible.map((item) => ({ item, level: item.floorLevel ?? UNASSIGNED_LEVEL, label: item.floorLabel || item.floor || UNASSIGNED_LABEL, area: item.functionalArea?.name ?? "" }));
  decorated.sort((a, b) => {
    const unplaced = Number(a.level === UNASSIGNED_LEVEL) - Number(b.level === UNASSIGNED_LEVEL);
    return unplaced || (a.level - b.level) * direction || collate.compare(a.label, b.label) || collate.compare(a.area, b.area) || collate.compare(a.item.room ?? "", b.item.room ?? "") || collate.compare(a.item.inventoryCode, b.item.inventoryCode);
  });
  const draft: { entry: (typeof decorated)[number]; group: string; layer: boolean; text: RowText }[] = []; let prior = "";
  for (const entry of decorated) { const item = entry.item; const group = entry.label; const sample = item.sampleLinks?.[0]?.sample.sampleNumber || (item.acmClassification === "pacm" ? "PACM" : ""); const location = [entry.label, entry.area, item.room, item.specificLocation].filter(Boolean).join(" · "); const stem = sample.replace(/[A-Za-z]+$/, ""); const layer = Boolean(options.nestLayers && stem && prior === `${group}|${stem}|${location}`); prior = `${group}|${stem}|${location}`; draft.push({ entry, group, layer, text: { code: item.inventoryCode, sample, location, material: `${item.materialDescription}${layer ? " (layer)" : ""}`, quantity: layer ? "-" : formatQty(item.currentQuantity, item.quantityUnit) } }); }
  const cols = columnWidths(draft.map((row) => row.text), g);
  const rows: Row[] = draft.map(({ entry, group, layer, text }) => ({ item: entry.item, members: [entry.item], group, layer, sample: text.sample, location: text.location, previous: entry.item.inspectionItems?.[0]?.previousCondition || entry.item.condition, height: Math.max(g.row, textHeight(text.location, cols[LOCATION_COL] - 4, g.font.body) + CELL_PAD, textHeight(text.material, cols[MATERIAL_COL] - 4, g.font.body) + CELL_PAD) }));
  const pages: PacketPage[] = []; let page: PacketPage = { rows: [], first: true }; let y = TABLE_TOP + g.band + COL_HEADER; const usable = g.height - FOOT_RESERVE;
  for (const row of rows) { const newGroup = page.rows.length === 0 || page.group !== row.group; const needed = row.height + (newGroup ? GROUP_HEADER : 0); if (y + needed > usable && page.rows.length) { pages.push(page); page = { rows: [], first: false }; y = TABLE_TOP + COL_HEADER; } if (newGroup) { page.group = row.group; y += GROUP_HEADER; } page.rows.push(row); y += row.height; }
  if (page.rows.length || !pages.length) pages.push(page); return { cols, pages };
}

/** Pure pagination shared by the PDF and packet preview. */
export function layoutRows(items: PacketItem[], options: PacketOptions = {}): PacketPage[] { return packetLayout(items, options).pages; }

/** Exact packet page count used by both the generated PDF and preview. */
export function packetPageCount(items: PacketItem[], options: PacketOptions = {}, floorPlanCount = 0) { return layoutRows(items, options).length + (options.includeFloorPlans === false ? 0 : floorPlanCount) + 1; }

function header(doc: PDFKit.PDFDocument, building: PacketBuilding, page: number, total: number) { const w = doc.page.width; doc.fillColor("#101828").font("Helvetica-Bold").fontSize(11).text("ANNUAL ASBESTOS VISUAL EVALUATION", 0, 20, { width: w, align: "center" }); doc.font("Helvetica").fontSize(7).fillColor("#546273").text(`${building.buildingNumber} · ${building.name} · ${building.client.name}`, 0, 34, { width: w, align: "center" }); doc.strokeColor("#c8d1db").lineWidth(.5).moveTo(22, 47).lineTo(w - 22, 47).stroke(); const fy = doc.page.height - 20; doc.moveTo(22, fy - 5).lineTo(w - 22, fy - 5).stroke(); doc.fillColor("#546273").fontSize(6.5).text(`${building.buildingNumber} · PAGE ${page} OF ${total}`, 0, fy, { width: w, align: "center" }); }
type CellStyle = { size: number; bold?: boolean; white?: boolean; wrap?: boolean; align?: "left" | "center" | "right" };
/** Draws one cell with its text vertically centred; only wrapping columns break lines. */
function cell(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, h: number, style: CellStyle) {
  if (style.white) doc.rect(x, y, w, h).fill("#fff");
  doc.strokeColor("#b8c4d0").lineWidth(style.white ? 1 : .5).rect(x, y, w, h).stroke();
  if (!text) return;
  const inner = w - 4;
  doc.fillColor("#142033").font(style.bold ? "Helvetica-Bold" : "Helvetica").fontSize(style.size);
  const height = doc.heightOfString(text, { width: inner, lineBreak: style.wrap ?? false }) as number;
  doc.text(text, x + 2, y + Math.max(1.5, (h - height) / 2), { width: inner, align: style.align ?? "left", lineBreak: style.wrap ?? false, ellipsis: false });
}
function briefBand(doc: PDFKit.PDFDocument, _building: PacketBuilding, g: ReturnType<typeof geometry>) {
  const x = g.margin; const top = 57; const w = g.width - x * 2; const half = w / 2;
  const line = 8.6; const codeW = 17;
  const column = (label: string, entries: string[][], cx: number) => {
    doc.font("Helvetica-Bold").fontSize(g.font.head).fillColor("#0a5f5b").text(label, cx, top, { width: half - 8 });
    entries.forEach(([code, gloss], index) => {
      const y = top + 11 + index * line;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#101828").text(code, cx, y, { width: codeW, lineBreak: false });
      doc.font("Helvetica").fontSize(7).fillColor("#33415a").text(gloss, cx + codeW + 3, y, { width: half - codeW - 12, lineBreak: false });
    });
  };
  column("CONDITION — WRITE ONE CODE IN THE CELL", conditionKey, x);
  column("LABELING — WRITE ONE CODE IN THE CELL", labelKey, x + half);
  doc.font("Helvetica").fontSize(6.5).fillColor("#546273").text("Any code other than OK requires a note. A blank cell is recorded as not inspected, not as good.", x, top + 11 + Math.max(conditionKey.length, labelKey.length) * line + 3, { width: w });
}

function fieldNotesPage(doc: PDFKit.PDFDocument, building: PacketBuilding, g: ReturnType<typeof geometry>, page: number, total: number) {
  doc.addPage({ size: [g.width, g.height], margin: 0 });
  header(doc, building, page, total);
  const x = g.margin; const tableWidth = g.width - x * 2;
  doc.fillColor("#101828").font("Helvetica-Bold").fontSize(11).text("FIELD NOTES · ADDITIONS · CORRECTIONS", x, 61, { width: tableWidth });
  doc.fillColor("#546273").font("Helvetica").fontSize(6.5).text("Type: A = addition · U = update · N = note · C = correction", x, 77, { width: tableWidth });
  const weights = [.12, .09, .12, .31, .25, .11];
  const cols = weights.map((weight, index) => index === weights.length - 1 ? 0 : Math.floor(tableWidth * weight));
  cols[cols.length - 1] = tableWidth - cols.reduce((sum, width) => sum + width, 0);
  const headers = ["TYPE", "ITEM #", "SAMPLE #", "LOCATION", "MATERIAL", "EST. QTY."];
  const top = 91; const headHeight = 17; const rowHeight = 24;
  let cx = x;
  headers.forEach((title, index) => { doc.rect(cx, top, cols[index], headHeight).fill("#33415a"); doc.fillColor("white").font("Helvetica-Bold").fontSize(g.font.head); const height = doc.heightOfString(title, { width: cols[index] - 4 }) as number; doc.text(title, cx + 2, top + Math.max(1.5, (headHeight - height) / 2), { width: cols[index] - 4, align: "center", lineBreak: false }); cx += cols[index]; });
  const rowCount = Math.max(12, Math.floor((g.height - FOOT_RESERVE - top - headHeight) / rowHeight));
  for (let row = 0; row < rowCount; row++) { let cellX = x; for (const width of cols) { doc.rect(cellX, top + headHeight + row * rowHeight, width, rowHeight).strokeColor("#b8c4d0").lineWidth(.5).stroke(); cellX += width; } }
}

export async function buildInspectionPacket(building: PacketBuilding, options: PacketOptions = {}): Promise<Buffer> {
  const g = geometry(options);
  const { cols, pages } = packetLayout(building.inventoryItems, options);
  const tableWidth = cols.reduce((sum, width) => sum + width, 0);
  const planAssets: Array<
    | { kind: "pdf"; document: PDFLibDocument }
    | { kind: "png" | "jpg"; bytes: Uint8Array }
  > = [];

  if (options.includeFloorPlans !== false) {
    for (const plan of building.floorPlans) {
      if (!canReadStorageKey(building.organizationId, plan.storageKey)) continue;
      const object = await getStoredObject(plan.storageKey);
      if (!object) continue;
      const bytes = new Uint8Array(await object.arrayBuffer());
      const key = `${plan.mimeType} ${plan.storageKey}`.toLowerCase();
      try {
        if (key.includes("pdf") || key.endsWith(".pdf")) {
          planAssets.push({ kind: "pdf", document: await PDFLibDocument.load(bytes) });
        } else if (key.includes("png") || key.endsWith(".png")) {
          planAssets.push({ kind: "png", bytes });
        } else if (/jpe?g/.test(key)) {
          planAssets.push({ kind: "jpg", bytes });
        }
      } catch (error) {
        console.error("Floor plan could not be loaded into inspection packet", { plan: plan.name, error });
      }
    }
  }

  const planPageCount = planAssets.reduce((sum, asset) => sum + (asset.kind === "pdf" ? asset.document.getPageCount() : 1), 0);
  const total = pages.length + planPageCount + 1;
  const doc: PDFKit.PDFDocument = new PDFDocument({ size: [g.width, g.height], margin: 0, info: { Title: `${building.buildingNumber} Inspection Packet`, Author: building.organizationName } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  pages.forEach((page, index) => { if (index) doc.addPage({ size: [g.width, g.height], margin: 0 }); header(doc, building, index + 1, total); if (page.first) briefBand(doc, building, g); let y = page.first ? TABLE_TOP + g.band : TABLE_TOP; let x = g.margin; COLUMN_HEADERS.forEach((title, col) => { doc.rect(x, y, cols[col], COL_HEADER).fill("#33415a"); doc.fillColor("white").font("Helvetica-Bold").fontSize(g.font.head); const labelHeight = doc.heightOfString(title, { width: cols[col] - 4 }) as number; doc.text(title, x + 2, y + Math.max(1.5, (COL_HEADER - labelHeight) / 2), { width: cols[col] - 4, align: "center", lineBreak: false }); x += cols[col]; }); y += COL_HEADER; let lastGroup = ""; page.rows.forEach((row) => { if (row.group !== lastGroup) { doc.rect(g.margin, y, tableWidth, GROUP_HEADER).fill("#e4e9ef"); doc.fillColor("#142033").font("Helvetica-Bold").fontSize(g.font.group); doc.text(row.group, g.margin + 3, y + Math.max(1.5, (GROUP_HEADER - (doc.currentLineHeight() as number)) / 2), { width: tableWidth - 6, lineBreak: false }); y += GROUP_HEADER; lastGroup = row.group; } let cx = g.margin; const data = ["", "", row.item.inventoryCode, row.sample, row.location, `${row.item.materialDescription}${row.layer ? " (layer)" : ""}`, row.layer ? "-" : formatQty(row.item.currentQuantity, row.item.quantityUnit)]; data.forEach((value, col) => { cell(doc, value, cx, y, cols[col], row.height, { size: g.font.body, bold: col === 2, white: col < 2, wrap: col === LOCATION_COL || col === MATERIAL_COL, align: col <= 3 ? "center" : "left" }); cx += cols[col]; }); if (row.item.recordStatus === "removed") doc.moveTo(g.margin + cols[0] + cols[1] + cols[2] + cols[3], y + row.height / 2).lineTo(g.margin + tableWidth, y + row.height / 2).strokeColor("#8a94a3").stroke(); y += row.height; }); });
  fieldNotesPage(doc, building, g, pages.length + 1, total);
  doc.end();
  const packet = await done;
  if (!planAssets.length) return packet;

  const merged = await PDFLibDocument.load(new Uint8Array(packet));
  for (const asset of planAssets) {
    if (asset.kind === "pdf") {
      const copiedPages = await merged.copyPages(asset.document, asset.document.getPageIndices());
      copiedPages.forEach((page) => merged.addPage(page));
      continue;
    }
    const page = merged.addPage([g.width, g.height]);
    const image = asset.kind === "png" ? await merged.embedPng(asset.bytes) : await merged.embedJpg(asset.bytes);
    const margin = 12;
    const scale = Math.min((g.width - margin * 2) / image.width, (g.height - margin * 2) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: (g.width - width) / 2, y: (g.height - height) / 2, width, height });
  }
  return Buffer.from(await merged.save());
}
