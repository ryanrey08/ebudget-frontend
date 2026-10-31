import type { MockRoute } from "../services/http";
import { allotmentHandlers } from "./allotments";
import { appropriationHandlers } from "./appropriations";
import { authHandlers } from "./auth";
import { budgetHandlers } from "./budget";
import { gaaHandlers } from "./gaa";
import { obligationHandlers } from "./obligations";
import { reportingHandlers } from "./reporting";

export const mockRoutes: MockRoute[] = [...authHandlers, ...appropriationHandlers, ...allotmentHandlers, ...obligationHandlers, ...budgetHandlers, ...gaaHandlers, ...reportingHandlers];
