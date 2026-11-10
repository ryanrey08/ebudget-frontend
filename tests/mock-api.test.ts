import { beforeAll, describe, expect, it } from "vitest";
import { getApiSettings } from "@/lib/api/api-client";
import { toPlainApiError } from "@/lib/api/api-error";
import { BFARS_REPORTS } from "@/lib/constants/bfars";
import { ROLE_LABELS } from "@/features/auth/types";
import {
  allotmentClassesService,
  allotmentsService,
  appropriationsService,
  authService,
  bfarsService,
  dashboardService,
  gaaService,
  obligationsService,
  reportsService,
  settingsService,
} from "@/services";
import { BFARS_DATA_ENDPOINTS, type BfarsReportId } from "@/services/bfars.service";
import { db } from "@/mocks/services/db";
import { mockControls } from "@/mocks/mock-api";

const FY = 2026;

beforeAll(async () => {
  expect(getApiSettings().mode).toBe("mock");
  await authService.login({ email: "juan.delacruz@mpc.edu.ph", password: "eBudget@2026", remember: false });
});

describe("mock API: authentication and settings", () => {
  it("rejects a wrong password with the backend-style message", async () => {
    const error = await authService.login({ email: "juan.delacruz@mpc.edu.ph", password: "wrong", remember: false }).catch(toPlainApiError);
    expect(error).toMatchObject({ status: 401, message: "Invalid email or password." });
  });

  it("returns the signed-in user and profile", async () => {
    const me = await authService.me();
    expect(me.email).toBe("juan.delacruz@mpc.edu.ph");
    expect((await settingsService.getProfile()).id).toBe(me.id);
  });

  it("updates the profile in the mock store", async () => {
    const me = await settingsService.getProfile();
    const updated = await settingsService.updateProfile({ ...me, phone: "+63 917 000 0000" });
    expect(updated.phone).toBe("+63 917 000 0000");
    expect((await authService.me()).phone).toBe("+63 917 000 0000");
  });
});

describe("mock API: appropriations CRUD", () => {
  it("paginates and searches", async () => {
    const page1 = await appropriationsService.getAll({ fiscalYear: FY, page: 1, pageSize: 5 });
    expect(page1.items).toHaveLength(5);
    expect(page1.total).toBe(db.appropriations.filter((a) => a.fiscalYear === FY).length);
    const page2 = await appropriationsService.getAll({ fiscalYear: FY, page: 2, pageSize: 5 });
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
    const needle = page1.items[0].referenceNo;
    const found = await appropriationsService.getAll({ fiscalYear: FY, search: needle });
    expect(found.items.every((a) => a.referenceNo.includes(needle) || a.title.includes(needle) || a.program.includes(needle) || a.uacsCode.includes(needle) || a.objectOfExpenditure.includes(needle) || a.orgCode.includes(needle))).toBe(true);
  });

  it("validates required fields with field errors", async () => {
    const error = await appropriationsService.create({ fiscalYear: FY, title: "", draft: true } as never).catch(toPlainApiError);
    expect(error).toMatchObject({ status: 422, code: "VALIDATION", fieldErrors: { title: expect.any(String) } });
  });

  it("creates and deletes a record and the list reflects it", async () => {
    const before = (await appropriationsService.getAll({ fiscalYear: FY, pageSize: 1 })).total;
    const created = await appropriationsService.create({
      fiscalYear: FY, title: "Test draft appropriation", type: "Regular", orgCode: "", program: "", uacsCode: "",
      objectOfExpenditure: "", fundSource: "", allotmentClass: "MOOE", amount: 0, level: "", gaaReference: "",
      gaaPart: "", effectivityDate: "", remarks: "", documentIds: [], draft: true,
    } as never);
    expect(created.status).toBe("Draft");
    expect((await appropriationsService.getAll({ fiscalYear: FY, pageSize: 1 })).total).toBe(before + 1);
    await appropriationsService.delete(created.id);
    expect((await appropriationsService.getAll({ fiscalYear: FY, pageSize: 1 })).total).toBe(before);
  });

  it("refuses to delete appropriations that have allotments", async () => {
    const withAllotments = db.appropriations.find((a) => a.allotted > 0)!;
    const error = await appropriationsService.delete(withAllotments.id).catch(toPlainApiError);
    expect(error).toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("uploads supporting documents as FormData", async () => {
    const doc = await appropriationsService.uploadDocument(new File(["%PDF"], "saro.pdf", { type: "application/pdf" }));
    expect(doc.name).toContain("saro");
  });
});

describe("mock API: data relationships", () => {
  it("every allotment references an existing appropriation", () => {
    const refs = new Set(db.appropriations.map((a) => a.referenceNo));
    const orphans = db.allotments.filter((a) => !refs.has(a.appropriationRef));
    expect(orphans.map((a) => a.allotmentNo)).toEqual([]);
  });

  it("every obligation references an existing allotment of the same class", () => {
    const byNo = new Map(db.allotments.map((a) => [a.allotmentNo, a]));
    const bad = db.obligations.filter((o) => !byNo.has(o.allotmentRef) || byNo.get(o.allotmentRef)!.allotmentClass !== o.allotmentClass);
    expect(bad.map((o) => o.referenceNo)).toEqual([]);
  });

  it("appropriation and allotment balances follow the existing linking rules", () => {
    for (const app of db.appropriations) {
      const linked = db.allotments.filter((a) => a.appropriationRef === app.referenceNo && a.status !== "Draft" && a.status !== "Rejected");
      expect(app.allotted).toBe(linked.reduce((s, a) => s + a.amount, 0));
    }
    for (const allotment of db.allotments) {
      const linked = db.obligations.filter((o) => o.allotmentRef === allotment.allotmentNo && o.status !== "Cancelled" && o.status !== "Draft");
      expect(allotment.obligated).toBe(linked.reduce((s, o) => s + o.amount, 0));
    }
  });

  it("users have valid roles", () => {
    for (const { user } of db.users) expect(Object.keys(ROLE_LABELS)).toContain(user.role);
  });
});

describe("mock API: dashboard, allotments and obligations", () => {
  it("dashboard totals are derived from the same records", async () => {
    const { summary, utilization } = await dashboardService.getOverview({ fiscalYear: FY });
    expect(summary.availableBalance).toBe(summary.totalAllotments - summary.totalObligations);
    expect(utilization.reduce((s, u) => s + u.allotments, 0)).toBe(summary.totalAllotments);
    expect(utilization.reduce((s, u) => s + u.obligations, 0)).toBe(summary.totalObligations);
    const recent = await dashboardService.getRecentTransactions({ fiscalYear: FY, limit: 3 });
    expect(recent.length).toBeLessThanOrEqual(3);
  });

  it("lists allotments and returns details with the parent appropriation", async () => {
    const list = await allotmentsService.getAll({ fiscalYear: FY, page: 1, pageSize: 10 });
    expect(list.items.length).toBeGreaterThan(0);
    const detail = await allotmentsService.getById(list.items[0].id);
    expect(detail.allotment.appropriationRef).toBe(list.items[0].appropriationRef);
  });

  it.each(["RAOPS", "RAOMO", "RAOCO", "RAOFE"] as const)("loads the %s registry", async (code) => {
    const registry = await allotmentClassesService.getRegistry({ code: code as never, fiscalYear: FY });
    expect(registry).toBeTruthy();
  });

  it("returns obligation details with approval history and filters by status", async () => {
    const list = await obligationsService.getAll({ fiscalYear: FY, page: 1, pageSize: 50 });
    const detail = await obligationsService.getById(list.items[0].id);
    expect(detail.obligation.workflow.length).toBeGreaterThan(0);
    const status = list.items[0].status;
    const filtered = await obligationsService.getAll({ fiscalYear: FY, status } as never);
    expect(filtered.items.every((o) => o.status === status)).toBe(true);
  });

  it("deletes only draft or returned obligations", async () => {
    const approved = db.obligations.find((o) => o.status !== "Draft" && o.status !== "Returned")!;
    expect(await obligationsService.delete(approved.id).catch(toPlainApiError)).toMatchObject({ status: 409 });
    const draft = db.obligations.find((o) => o.status === "Draft");
    if (draft) {
      await obligationsService.delete(draft.id);
      expect(db.obligations.some((o) => o.id === draft.id)).toBe(false);
    }
  });

  it("returns 404 for unknown records", async () => {
    expect(await obligationsService.getById("does-not-exist").catch(toPlainApiError)).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("lists GAA uploads with their rows", async () => {
    const uploads = await gaaService.getUploads();
    expect(uploads.length).toBeGreaterThan(0);
    const rows = await gaaService.getRows(uploads[0].id);
    expect(rows.length).toBe(uploads[0].rowCount);
  });
});

describe("mock API: BFARS 1–11 and reports", () => {
  it("has a data endpoint for every BFARS report", () => {
    expect(Object.keys(BFARS_DATA_ENDPOINTS).sort()).toEqual(BFARS_REPORTS.map((r) => r.id).sort());
  });

  it.each(BFARS_REPORTS.map((r) => [r.id, r.number] as const))("loads %s data", async (id, n) => {
    const getter = (bfarsService as unknown as Record<string, (p: object) => Promise<{ options?: unknown }>>)[`getBFARS${n}`];
    const params = { fiscalYear: FY, quarter: "Q1", month: 3, asOf: "2026-03-31" };
    const report = await getter(params);
    expect(report).toBeTruthy();
    expect(await bfarsService.getData(id as BfarsReportId, params)).toEqual(report);
  });

  it("records generated BFARS reports in the report history", async () => {
    const before = (await reportsService.getHistory()).length;
    const record = await bfarsService.generateBFARS2({ params: { fiscalYear: FY, quarter: "Q1", department: "", uacsMajor: "", allotmentClass: "" }, format: "excel" });
    expect(record).toMatchObject({ reportId: "rpt-bfars-2", format: "XLSX", period: "FY 2026 Q1", status: "Ready" });
    expect((await reportsService.getHistory()).length).toBe(before + 1);
    expect((await bfarsService.getGeneratedBFARS2()).map((r) => r.id)).toContain(record.id);
    const mrd = await bfarsService.generateBFARS9({ params: { fiscalYear: FY, month: 3, department: "", allotmentClass: "", uacsMajor: "" }, format: "pdf" });
    expect(mrd.period).toBe("March 2026");
  });

  it("validates BFARS generation requests", async () => {
    expect(await bfarsService.generate("bfars-1", { params: { fiscalYear: FY }, format: "" }).catch(toPlainApiError)).toMatchObject({ status: 422 });
    expect(await bfarsService.generate("bfars-99" as BfarsReportId, { params: {}, format: "pdf" }).catch(toPlainApiError)).toMatchObject({ status: 404 });
  });

  it("generates and downloads catalog reports", async () => {
    const catalog = await reportsService.getAll({ category: "BFARS" });
    expect(catalog).toHaveLength(11);
    const generated = await reportsService.generate({ reportId: catalog[0].id, period: "FY 2026 Q1", format: "PDF" });
    const file = await reportsService.download(generated);
    expect(file.fileName.endsWith(".pdf")).toBe(true);
    expect(await file.blob.text()).toContain(generated.reportName);
  });
});

describe("mock API: simulated failures", () => {
  it("can force the next request to fail", async () => {
    mockControls.failNext(500);
    expect(await dashboardService.getOverview({ fiscalYear: FY }).catch(toPlainApiError)).toMatchObject({ status: 500, code: "SERVER_ERROR" });
    mockControls.failNext(0);
    expect(await dashboardService.getOverview({ fiscalYear: FY }).catch(toPlainApiError)).toMatchObject({ code: "NETWORK_ERROR" });
    await expect(dashboardService.getOverview({ fiscalYear: FY })).resolves.toBeTruthy();
  });

  it("answers unknown routes with 404", async () => {
    const { apiClient } = await import("@/lib/api/api-client");
    expect(await apiClient.get("/no-such-endpoint").catch(toPlainApiError)).toMatchObject({ status: 404 });
  });
});
