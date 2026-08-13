const FIELD_SAMPLE_CLASSIFICATIONS = new Set(["assumed_acm", "pacm"]);
const FIELD_SAMPLE_CONDITIONS = new Set(["damaged", "significantly_damaged", "needs_repair"]);

export function requiresFieldSample(classification?: string | null, condition?: string | null) {
  return FIELD_SAMPLE_CLASSIFICATIONS.has(classification ?? "") && FIELD_SAMPLE_CONDITIONS.has(condition ?? "");
}
