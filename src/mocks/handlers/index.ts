import type { MockRoute } from "../services/http";
import { allotmentHandlers } from "./allotments";
import { appropriationHandlers } from "./appropriations";
import { authHandlers } from "./auth";
import { budgetHandlers } from "./budget";
import { gaaHandlers } from "./gaa";
import { obligationHandlers } from "./obligations";
import { reportGenerationHandlers } from "./report-generation";
import { reportingHandlers } from "./reporting";

/** Every mock route, matched in order by src/mocks/mock-api.ts. */
export const mockRoutes: MockRoute[] = [
  ...authHandlers,
  ...appropriationHandlers,
  ...allotmentHandlers,
  ...obligationHandlers,
  ...budgetHandlers,
  ...gaaHandlers,
  ...reportGenerationHandlers,
  ...reportingHandlers,
];
