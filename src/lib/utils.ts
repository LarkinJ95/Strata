import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(value?: Date | string | null, fallback = "—") {
  if (!value) return fallback;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value?: Date | string | null, fallback = "—") {
  if (!value) return fallback;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatNumber(n?: number | null, digits = 0) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatQty(n?: number | null, unit?: string | null) {
  if (n === null || n === undefined) return "—";
  return `${formatNumber(n, n % 1 === 0 ? 0 : 1)} ${unit ?? ""}`.trim();
}

export function daysFromNow(date?: Date | string | null) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const ACM_LABELS: Record<string, string> = {
  confirmed_acm: "Confirmed ACM",
  assumed_acm: "Assumed ACM",
  pacm: "PACM",
  non_acm: "Non-ACM",
  unknown: "Unknown",
  removed: "Previously Removed",
};

export const CONDITION_LABELS: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
  significantly_damaged: "Significantly Damaged",
  needs_repair: "Needs Repair",
  removed: "Removed",
  inaccessible: "Inaccessible",
  unable_to_inspect: "Unable to Inspect",
};

export const INSPECTION_TYPES: Record<string, string> = {
  initial_survey: "Initial Survey",
  periodic_surveillance: "Periodic Surveillance",
  annual_inspection: "Annual Inspection",
  reinspection: "Reinspection",
  repair_inspection: "Repair Inspection",
  post_repair_verification: "Post-Repair Verification",
  pre_renovation: "Pre-Renovation Survey",
  pre_demolition: "Pre-Demolition Survey",
  limited_survey: "Limited Survey",
  supplemental_survey: "Supplemental Survey",
  custom: "Custom Inspection",
};

export const REPAIR_STATUSES: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  awaiting_verification: "Awaiting Verification",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const SAMPLE_STATUSES: Record<string, string> = {
  collected: "Collected",
  submitted: "Submitted",
  at_lab: "At Laboratory",
  results_received: "Results Received",
  reviewed: "Reviewed",
  reconciled: "Reconciled",
  no_entry: "No Inventory Entry",
};

export const RESPONSE_ACTIONS = [
  "No action",
  "Continue surveillance",
  "Repair",
  "Encapsulate",
  "Enclose",
  "Remove",
  "Restrict access",
  "Further sampling",
  "Engineering evaluation",
  "Other",
];

export const MATERIAL_CATEGORIES = [
  "Thermal System Insulation",
  "Surfacing",
  "Miscellaneous",
];

export const UNITS = ["SF", "LF", "CF", "EA", "Units"];

export function acmTone(cls: string) {
  switch (cls) {
    case "confirmed_acm":
      return "acm";
    case "assumed_acm":
      return "assumed";
    case "pacm":
      return "pacm";
    case "non_acm":
      return "nonacm";
    case "removed":
      return "removed";
    default:
      return "unknown";
  }
}

export function conditionTone(c: string) {
  if (c === "good") return "ok";
  if (c === "fair") return "fair";
  if (c === "damaged" || c === "needs_repair") return "warn";
  if (c === "significantly_damaged") return "danger";
  if (c === "removed") return "removed";
  return "muted";
}

/** Severity ranking so summaries can report the worst condition rather than the first one. */
export const CONDITION_SEVERITY: Record<string, number> = {
  significantly_damaged: 6,
  damaged: 5,
  needs_repair: 4,
  inaccessible: 3,
  unable_to_inspect: 3,
  fair: 2,
  good: 1,
  removed: 0,
};

export function worstCondition(conditions: string[]): string | null {
  let worst: string | null = null;
  for (const condition of conditions) {
    if (worst === null || (CONDITION_SEVERITY[condition] ?? 0) > (CONDITION_SEVERITY[worst] ?? 0)) worst = condition;
  }
  return worst;
}

/** A consistent, explainable triage score for inventory views and summaries. */
export function riskScore(item: {
  acmClassification: string;
  condition: string;
  accessibility?: string | null;
  disturbancePotential?: string | null;
  friable?: string | null;
}): number {
  const classification = { confirmed_acm: 45, assumed_acm: 36, pacm: 28, unknown: 16, non_acm: 0, removed: 0 }[item.acmClassification] ?? 12;
  const condition = { significantly_damaged: 42, damaged: 32, needs_repair: 27, fair: 15, good: 4, inaccessible: 12, unable_to_inspect: 12, removed: 0 }[item.condition] ?? 10;
  const accessible = /high|public|occupied|unrestricted/i.test(item.accessibility ?? "") ? 7 : /medium/i.test(item.accessibility ?? "") ? 4 : 0;
  const disturbance = /high/i.test(item.disturbancePotential ?? "") ? 6 : /medium/i.test(item.disturbancePotential ?? "") ? 3 : 0;
  const friable = /friable|yes/i.test(item.friable ?? "") ? 5 : 0;
  return Math.max(0, Math.min(100, classification + condition + accessible + disturbance + friable));
}

export function riskTone(score: number): "danger" | "warn" | "info" | "muted" {
  if (score >= 65) return "danger";
  if (score >= 40) return "warn";
  if (score >= 15) return "info";
  return "muted";
}

export function complianceTone(s: string) {
  if (s === "current") return "ok";
  if (s === "attention") return "warn";
  return "danger";
}

export function photoPolicyMessage(policy: string) {
  switch (policy) {
    case "prohibited":
      return "PHOTOGRAPHY NOT PERMITTED FOR THIS BUILDING";
    case "approval_required":
      return "Photography requires prior approval";
    case "limited":
      return "Limited photography — follow building restrictions";
    default:
      return null;
  }
}
