/**
 * Services for the eBudget backend's own endpoints (backend-api `main`).
 * They need NEXT_PUBLIC_API_MODE=real. The services in src/services/*.ts are
 * the demo modules the backend has no endpoints for yet.
 */
export { backend, compact } from "./http";
export { masterDataService } from "./master-data.service";
export { appropriationLinesService } from "./appropriations.service";
export { allotmentRecordsService } from "./allotments.service";
export { approvalWorkflowsService, approvalRequestsService } from "./approvals.service";
export { agencyProfileService, signatoriesService } from "./administration.service";
export { accessService, reportSharingService } from "./access.service";
