/**
 * Service layer: one object per management module. Pages and components use
 * the RTK Query hooks in src/features/<feature>/services (which call these
 * services), so they never talk to the API client or mock data directly.
 *
 * Every service goes through src/lib/api/api-client.ts, which answers from the
 * mock API or the real backend depending on NEXT_PUBLIC_API_MODE.
 */
export { authService } from "./auth.service";
export { dashboardService } from "./dashboard.service";
export { appropriationsService, gaaService } from "./appropriations.service";
export { allotmentsService, allotmentClassesService } from "./allotments.service";
export { obligationsService } from "./obligations.service";
export { bfarsService, describeBfarsPeriod, toHistoryFormat } from "./bfars.service";
export { reportsService } from "./reports.service";
export { settingsService, notificationsService } from "./settings.service";
