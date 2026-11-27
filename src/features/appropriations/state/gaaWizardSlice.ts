import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppropriationLevel, GaaCellField, GaaCells, GaaValidationReport } from "../types/lines";

export const GAA_STEPS = ["upload", "validate", "map", "import"] as const;
export type GaaStep = (typeof GAA_STEPS)[number];

/** Settings the template doesn't carry; they apply to every line (POST /appropriations/imports). */
export interface GaaImportConfig {
  level: AppropriationLevel;
  legal_reference: string;
  title: string;
  effectivity_date: string;
  expiry_date: string;
}

/**
 * The GAA upload against the backend: Upload (validate the workbook, nothing
 * saved) → Validate & correct the cells → Configure → Import (queued, polled).
 * Kept in Redux so the report and the user's corrections survive navigating
 * away and back.
 */
export interface GaaWizardState {
  step: GaaStep;
  fileName: string | null;
  report: GaaValidationReport | null;
  /** The user's cell values per sheet row (starts as the report's `cells`). */
  cells: Record<number, GaaCells>;
  /** Rows left out of the import. */
  excluded: number[];
  /** Errors per row and field from the import (422 or a failed job), shown on the cells. */
  importErrors: Record<number, Partial<Record<GaaCellField | "row", string>>>;
  config: GaaImportConfig;
  importId: string | null;
}

const initialConfig: GaaImportConfig = { level: "agency", legal_reference: "", title: "", effectivity_date: "", expiry_date: "" };
const initialState: GaaWizardState = { step: "upload", fileName: null, report: null, cells: {}, excluded: [], importErrors: {}, config: initialConfig, importId: null };

const gaaWizardSlice = createSlice({
  name: "gaaWizard",
  initialState,
  reducers: {
    reportReceived: (_state, action: PayloadAction<{ fileName: string; report: GaaValidationReport }>) => ({
      ...initialState,
      step: "validate",
      fileName: action.payload.fileName,
      report: action.payload.report,
      cells: Object.fromEntries(action.payload.report.lines.map((l) => [l.row, { ...l.cells }])),
    }),
    cellEdited: (state, action: PayloadAction<{ row: number; field: GaaCellField; value: string }>) => {
      const { row, field, value } = action.payload;
      state.cells[row] = { ...state.cells[row], [field]: value.trim() === "" ? null : value };
      if (state.importErrors[row]) delete state.importErrors[row][field];
    },
    rowExcluded: (state, action: PayloadAction<{ row: number; excluded: boolean }>) => {
      const set = new Set(state.excluded);
      if (action.payload.excluded) set.add(action.payload.row);
      else set.delete(action.payload.row);
      state.excluded = [...set];
    },
    configChanged: (state, action: PayloadAction<Partial<GaaImportConfig>>) => {
      state.config = { ...state.config, ...action.payload };
    },
    importErrorsReceived: (state, action: PayloadAction<GaaWizardState["importErrors"]>) => {
      state.importErrors = action.payload;
      state.importId = null;
      state.step = "validate";
    },
    importQueued: (state, action: PayloadAction<string>) => {
      state.importId = action.payload;
      state.importErrors = {};
      state.step = "import";
    },
    stepChanged: (state, action: PayloadAction<GaaStep>) => {
      state.step = action.payload;
    },
    wizardReset: () => initialState,
  },
  selectors: {
    selectGaaWizard: (state) => state,
  },
});

export const { reportReceived, cellEdited, rowExcluded, configChanged, importErrorsReceived, importQueued, stepChanged, wizardReset } = gaaWizardSlice.actions;
export const { selectGaaWizard } = gaaWizardSlice.selectors;
export default gaaWizardSlice;
