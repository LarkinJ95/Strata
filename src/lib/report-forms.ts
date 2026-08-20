export const REPORT_FORM_OPTIONS = [
  { value: "annual_inspection_report", label: "Annual Inspection Report (Corteva / SC Johnson workbook)" },
  { value: "dow_corporate_audit", label: "Dow Corporate Audit" },
  { value: "miops_annual_asbestos_visual_evaluation", label: "MIOPS Annual Asbestos Visual Evaluation Procedure" },
] as const;

export type ReportFormCode = (typeof REPORT_FORM_OPTIONS)[number]["value"];

/** Policy-derived form used only when a building does not carry an override. */
export function defaultReportForm(clientName: string, facilityName: string) {
  if (["Corteva", "SC Johnson"].includes(clientName)) return "annual_inspection_report" as const;
  if (clientName === "Dow Chemical" && facilityName === "Corporate") return "dow_corporate_audit" as const;
  return "miops_annual_asbestos_visual_evaluation" as const;
}
