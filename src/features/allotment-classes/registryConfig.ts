/**
 * Per-class differences between the allotment-class (registry) screens, taken
 * from each class's mockups. Classes without an entry use the original page.
 */
export interface RegistryConfig {
  /** "sections": Allotments/Obligations/... tabs (RAOPS). "status": status tabs with UACS column (RAOMO). */
  listVariant: "sections" | "status" | "overview" | "raofe";
  /** Effectivity/validity dates, summary and workflow preview on the form. */
  scheduleFields: boolean;
  /** Approve / Return / Cancel action buttons and an approval history table on approval screens. */
  actionButtons: boolean;
  /** New allotment entered as a 4-step wizard with a separate total amount (RAOCO). */
  wizard: boolean;
  /** RAOFE: single-page-per-step wizard with a submit modal; details are view-only (no approval actions). */
  viewOnly?: boolean;
}

export const REGISTRY_CONFIG: Record<string, RegistryConfig> = {
  raop: { listVariant: "sections", scheduleFields: false, actionButtons: false, wizard: false },
  raomo: { listVariant: "status", scheduleFields: true, actionButtons: true, wizard: false },
  raoco: { listVariant: "overview", scheduleFields: false, actionButtons: true, wizard: true },
  raofe: { listVariant: "raofe", scheduleFields: false, actionButtons: false, wizard: true, viewOnly: true },
};

export const registryConfig = (slug: string): RegistryConfig => REGISTRY_CONFIG[slug] ?? REGISTRY_CONFIG.raop;
