// Inventory rows carry `floor` as free text, so packets cannot sort on it — "Basement"
// sorts before "First Floor" and "Fourth Floor" before "Second Floor". BuildingFloor.level
// is the authoritative order; these helpers resolve an item to that level, falling back to
// the floor name only when a building has no floor records yet.

export type FloorRef = { id: string; name: string; level: number };

/** Items with no resolvable floor sort last, never interleaved and never silently first. */
export const UNASSIGNED_LEVEL = Number.MAX_SAFE_INTEGER;
export const UNASSIGNED_LABEL = "Unassigned level";

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Best-effort level for a free-text floor name. Returns null when nothing can be inferred. */
export function inferFloorLevel(name: string | null | undefined): number | null {
  const s = normalize(name ?? "");
  if (!s) return null;
  if (/\broof\b/.test(s)) return 1000;
  if (/\bpenthouse\b/.test(s)) return 900;
  if (/\battic\b/.test(s)) return 800;
  if (/\b(exterior|outside|site|grounds|yard)\b/.test(s)) return 2000;
  if (/\b(crawl ?space|tunnel|pit)\b/.test(s)) return -50;
  const sub = s.match(/sub[- ]?basement\s*(\d+)?/);
  if (sub) return -(1 + (Number(sub[1]) || 1));
  if (/\bbasement\b|\blower level\b|^b$|^b[- ]?\d+$/.test(s)) {
    const numbered = s.match(/^b[- ]?(\d+)$/);
    return numbered ? -Number(numbered[1]) : -1;
  }
  if (/\b(ground|lobby|main)\b/.test(s)) return 1;
  if (/\bmezzanine\b/.test(s)) {
    const near = s.match(/(\d+)/);
    return (near ? Number(near[1]) : 1) + 0.5;
  }
  for (const [word, level] of Object.entries(ORDINALS)) {
    if (new RegExp(`\\b${word}\\b`).test(s)) return level;
  }
  const numeric = s.match(/\b(?:l|lvl|level|fl|floor)\s*[-_ ]?(\d+)\b|\b(\d+)(?:st|nd|rd|th)\b|^(\d+)$/);
  return numeric ? Number(numeric[1] ?? numeric[2] ?? numeric[3]) : null;
}

export type ResolvedFloor = { floorLevel: number; floorLabel: string };

/**
 * Resolution order: the functional area's floor record, then a name match against the
 * building's floors, then an inferred level. Matching through BuildingFloor also gives a
 * canonical label, so "1st Floor" and "First Floor" collapse into one printed group.
 */
export function makeFloorResolver(floors: FloorRef[]) {
  const byId = new Map(floors.map((floor) => [floor.id, floor]));
  const byName = new Map(floors.map((floor) => [normalize(floor.name), floor]));
  return function resolveFloor(input: { floor?: string | null; floorId?: string | null }): ResolvedFloor {
    const viaArea = input.floorId ? byId.get(input.floorId) : undefined;
    if (viaArea) return { floorLevel: viaArea.level, floorLabel: viaArea.name };
    const viaName = input.floor ? byName.get(normalize(input.floor)) : undefined;
    if (viaName) return { floorLevel: viaName.level, floorLabel: viaName.name };
    const inferred = inferFloorLevel(input.floor);
    const label = input.floor?.trim();
    if (inferred !== null && label) return { floorLevel: inferred, floorLabel: label };
    return { floorLevel: UNASSIGNED_LEVEL, floorLabel: label || UNASSIGNED_LABEL };
  };
}
