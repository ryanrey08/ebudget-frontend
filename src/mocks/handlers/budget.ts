import { ENDPOINTS } from "@/lib/api/endpoints";
import { ALLOTMENT_CLASS_CODES, type AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { DashboardOverview, Transaction } from "@/features/dashboard/types";
import type { Obligation } from "@/features/obligation-management/types";
import type { AllotmentClassRegistry } from "@/features/allotment-classes/types";
import { db } from "../services/db";
import { MockHttpError, byDateDesc, num, route, type QueryValue } from "../services/http";

const fyOf = (q: Record<string, QueryValue>) => num(q.fiscalYear, 2026);
/** Obligations that count toward totals (drafts and cancelled excluded). */
const active = (o: Obligation) => o.status !== "Cancelled" && o.status !== "Draft";
const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0);

function assertClass(code: string): AllotmentClassCode {
  if (!(ALLOTMENT_CLASS_CODES as readonly string[]).includes(code)) {
    throw new MockHttpError(404, `Unknown allotment class ${code}.`);
  }
  return code as AllotmentClassCode;
}

export const budgetHandlers = [
  /* ---------------- Dashboard ---------------- */
  route("GET", ENDPOINTS.dashboard.overview, ({ query }): DashboardOverview => {
    const fy = fyOf(query);
    const apps = db.appropriations.filter((a) => a.fiscalYear === fy);
    const allotments = db.allotments.filter(
      (a) => a.fiscalYear === fy && a.status !== "Draft" && a.status !== "Rejected",
    );
    const obligations = db.obligations.filter((o) => o.date.startsWith(String(fy)) && active(o));
    const totalAllotments = sum(allotments, (a) => a.amount);
    const totalObligations = sum(obligations, (o) => o.amount);
    return {
      summary: {
        fiscalYear: fy,
        totalAppropriations: sum(apps, (a) => a.amount),
        totalAllotments,
        totalObligations,
        totalDisbursements: sum(obligations, (o) => o.disbursed),
        availableBalance: totalAllotments - totalObligations,
      },
      utilization: ALLOTMENT_CLASS_CODES.map((cls) => ({
        allotmentClass: cls,
        appropriations: sum(apps.filter((a) => a.allotmentClass === cls), (a) => a.amount),
        allotments: sum(allotments.filter((a) => a.allotmentClass === cls), (a) => a.amount),
        obligations: sum(obligations.filter((o) => o.allotmentClass === cls), (o) => o.amount),
      })),
      allocation: ALLOTMENT_CLASS_CODES.map((cls) => ({
        allotmentClass: cls,
        amount: sum(allotments.filter((a) => a.allotmentClass === cls), (a) => a.amount),
      })),
    };
  }),

  route("GET", ENDPOINTS.dashboard.recentTransactions, ({ query }): Transaction[] => {
    const fy = fyOf(query);
    const limit = num(query.limit, 6);
    const shortClass: Record<AllotmentClassCode, string> = { RAOPS: "PS", RAOMO: "MOOE", RAOCO: "CO", RAOFE: "FE" };
    const apps = db.appropriations.filter((a) => a.fiscalYear === fy);
    const gaa: Transaction = {
      id: `txn-gaa-${fy}`,
      date: new Date(Date.UTC(fy, 0, 5)).toISOString(),
      referenceNo: `APP-${fy}-001`,
      type: "Appropriation",
      description: "General Appropriations (GAA)",
      amount: sum(apps, (a) => a.amount),
      status: "Posted",
    };
    const fromAllotments = db.allotments
      .filter((a) => a.date.startsWith(String(fy)))
      .map<Transaction>((a) => ({
        id: `txn-${a.id}`,
        date: a.date,
        referenceNo: a.allotmentNo,
        type: "Allotment",
        description: `${shortClass[a.allotmentClass]} – ${a.purpose.replace(/^(PS|MOOE|CO|FE) – /, "")}`,
        amount: a.amount,
        status:
          a.status === "Released" || a.status === "Partial"
            ? "Posted"
            : a.status === "Unreleased"
              ? "Approved"
              : a.status === "Rejected"
                ? "Cancelled"
                : "Pending",
      }));
    const fromObligations = db.obligations
      .filter((o) => o.date.startsWith(String(fy)) && o.status !== "Draft")
      .map<Transaction>((o) => ({
        id: `txn-${o.id}`,
        date: o.date,
        referenceNo: o.referenceNo,
        type: "Obligation",
        description: o.particulars,
        amount: o.amount,
        status:
          o.status === "Released"
            ? "Posted"
            : o.status === "Cancelled"
              ? "Cancelled"
              : o.status === "Approved"
                ? "Approved"
                : "Pending",
      }));
    return [gaa, ...fromAllotments, ...fromObligations].sort(byDateDesc).slice(0, limit);
  }),

  /* ---------------- Allotment class registries ---------------- */
  route("GET", "/allotment-classes/:code/registry", ({ params, query }): AllotmentClassRegistry => {
    const code = assertClass(params.code);
    const fy = fyOf(query);
    const allotments = db.allotments.filter(
      (a) => a.allotmentClass === code && a.fiscalYear === fy && a.status !== "Draft" && a.status !== "Rejected",
    );
    const obligations = db.obligations
      .filter((o) => o.allotmentClass === code && o.date.startsWith(String(fy)))
      .sort(byDateDesc);
    const valid = obligations.filter(active);
    const totalAllotments = sum(allotments, (a) => a.amount);
    const totalObligations = sum(valid, (o) => o.amount);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      code,
      fiscalYear: fy,
      summary: {
        allotments: totalAllotments,
        obligations: totalObligations,
        disbursements: sum(valid, (o) => o.disbursed),
        unobligatedBalance: totalAllotments - totalObligations,
      },
      allotments: allotments.map((a) => ({
        allotmentNo: a.allotmentNo,
        objectOfExpenditure: a.objectOfExpenditure,
        amount: a.amount,
        obligated: a.obligated,
      })),
      monthly: months.map((month, i) => {
        const inMonth = valid.filter((o) => new Date(o.date).getUTCMonth() === i);
        return { month, obligations: sum(inMonth, (o) => o.amount), disbursements: sum(inMonth, (o) => o.disbursed) };
      }),
      entries: obligations.map((o) => ({
        id: o.id,
        date: o.date,
        obligationRef: o.referenceNo,
        allotmentNo: o.allotmentRef,
        uacsCode: o.uacsCode,
        particulars: o.particulars,
        payee: o.payee,
        obligation: o.amount,
        disbursement: o.disbursed,
        status: o.status,
      })),
    };
  }),
];
