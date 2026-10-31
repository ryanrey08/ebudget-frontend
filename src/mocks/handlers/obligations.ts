import { ENDPOINTS } from "@/lib/api/endpoints";
import { ALLOTMENT_CLASS_CODES } from "@/lib/constants/allotment-classes";
import { ROLE_LABELS } from "@/features/auth/types";
import {
  OBLIGATION_STEPS,
  type Obligation,
  type ObligationDetail,
  type ObligationDocument,
  type ObligationInput,
  type ObligationLookups,
  type ObligationStatus,
  type ObligationSummary,
  type ObligationTab,
  type ObligationWorkflowRequest,
} from "@/features/obligation-management/types";
import { OBLIGATION_LOOKUPS, SAMPLE_PAYEES } from "../data/obligations";
import { db, nextSequence, relinkBudget } from "../services/db";
import { MockHttpError, matchesSearch, num, paginate, route, str, type QueryValue } from "../services/http";
import { obligationCurrentIndex } from "../services/obligation-workflow";
import { getMockSessionUserId } from "../services/session";

const fyOf = (q: Record<string, QueryValue>) => num(q.fiscalYear, 2026);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sum = <T>(items: T[], pick: (i: T) => number) => items.reduce((t, i) => t + pick(i), 0);
const counts = (o: Obligation) => o.status !== "Draft" && o.status !== "Cancelled";

const TABS: Record<ObligationTab, ObligationStatus[]> = {
  approval: ["For Approval"],
  approved: ["Approved"],
  released: ["Released"],
  cancelled: ["Cancelled"],
  draft: ["Draft", "Returned"],
};

/** Uploaded but not yet attached documents. */
const pendingDocuments = new Map<string, ObligationDocument>();

function actor() {
  const user = db.users.find((u) => u.user.id === getMockSessionUserId())?.user;
  if (!user) throw new MockHttpError(401, "You are not signed in.");
  return { name: `${user.firstName} ${user.lastName}`, position: ROLE_LABELS[user.role] };
}

function findObligation(id: string) {
  const record = db.obligations.find((o) => o.id === id);
  if (!record) throw new MockHttpError(404, "Obligation not found.");
  return record;
}

function balance(allotmentRef: string, excludeId?: string) {
  const allotment = db.allotments.find((a) => a.allotmentNo === allotmentRef);
  if (!allotment) return null;
  const otherObligations = sum(
    db.obligations.filter((o) => o.allotmentRef === allotmentRef && counts(o) && o.id !== excludeId),
    (o) => o.amount,
  );
  return { allotment, otherObligations, remaining: allotment.amount - otherObligations };
}

function detail(o: Obligation): ObligationDetail {
  const b = balance(o.allotmentRef, o.id);
  return {
    obligation: o,
    allotment: b
      ? { allotmentNo: b.allotment.allotmentNo, amount: b.allotment.amount, otherObligations: b.otherObligations, remaining: b.remaining }
      : null,
  };
}

/** Required-field and balance checks applied on submission. */
function validate(input: ObligationInput, excludeId?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const b = balance(input.allotmentRef, excludeId);
  if (!b) errors.allotmentRef = "Select a valid allotment.";
  else if (b.allotment.status !== "Released" && b.allotment.status !== "Partial") errors.allotmentRef = "The allotment has not been released.";
  if (!input.date) errors.date = "Select the obligation date.";
  if (!input.fundSource) errors.fundSource = "Select a fund source.";
  if (!input.responsibilityCenter) errors.responsibilityCenter = "Select the responsibility center.";
  if (!input.payee.trim()) errors.payee = "Enter the payee/supplier.";
  if (!input.particulars.trim()) errors.particulars = "Enter the particulars.";
  if (!input.lineItems.length) errors.lineItems = "Add at least one line item.";
  input.lineItems.forEach((li, i) => {
    if (!li.uacsCode.trim() || !li.description.trim() || !(li.quantity > 0) || !(li.unitCost > 0)) {
      errors[`lineItems.${i}`] = `Line ${i + 1} is incomplete.`;
    }
  });
  const total = sum(input.lineItems, (li) => li.quantity * li.unitCost);
  if (b && total > b.remaining) errors.lineItems = "Total amount exceeds the remaining allotment balance.";
  return errors;
}

function apply(record: Obligation, input: ObligationInput) {
  const allotment = db.allotments.find((a) => a.allotmentNo === input.allotmentRef);
  const lineItems = input.lineItems.map((li, i) => ({
    ...li,
    id: `li-${i + 1}`,
    amount: Math.round(li.quantity * li.unitCost * 100) / 100,
  }));
  Object.assign(record, {
    date: input.date ? new Date(input.date).toISOString() : record.date,
    allotmentRef: input.allotmentRef,
    allotmentClass: allotment?.allotmentClass ?? record.allotmentClass,
    tranche: input.tranche,
    fundSource: input.fundSource,
    responsibilityCenter: input.responsibilityCenter,
    payee: input.payee.trim(),
    tin: input.tin.trim(),
    address: input.address.trim(),
    particulars: input.particulars.trim(),
    lineItems,
    uacsCode: lineItems[0]?.uacsCode ?? "",
    amount: sum(lineItems, (li) => li.amount),
    appNo: input.appNo,
    prNo: input.prNo,
    poNo: input.poNo,
    modeOfProcurement: input.modeOfProcurement,
    projectActivity: input.projectActivity,
    remarks: input.remarks,
    applicableDocuments: input.applicableDocuments,
  });
  const added = input.documentIds.map((id) => pendingDocuments.get(id)).filter((d): d is ObligationDocument => !!d);
  input.documentIds.forEach((id) => pendingDocuments.delete(id));
  const keep = new Set(input.documentIds);
  record.documents = [...record.documents.filter((d) => keep.has(d.id)), ...added];
}

export const obligationHandlers = [
  route("GET", ENDPOINTS.obligations.list, ({ query }) => {
    const fy = fyOf(query);
    const search = str(query.search);
    const tab = str(query.tab) as ObligationTab | "";
    const from = str(query.dateFrom);
    const to = str(query.dateTo);
    const items = db.obligations
      .filter((o) => o.fiscalYear === fy)
      .filter((o) => !query.status || o.status === query.status)
      .filter((o) => !tab || TABS[tab]?.includes(o.status))
      .filter((o) => !query.allotmentClass || o.allotmentClass === query.allotmentClass)
      .filter((o) => !query.fundSource || o.fundSource === query.fundSource)
      .filter((o) => (!from || o.date.slice(0, 10) >= from) && (!to || o.date.slice(0, 10) <= to))
      .filter((o) => matchesSearch(search, o.referenceNo, o.payee, o.particulars, o.allotmentRef))
      .sort((a, b) => b.date.localeCompare(a.date) || b.referenceNo.localeCompare(a.referenceNo));
    return paginate(items, query);
  }),

  route("GET", ENDPOINTS.obligations.summary, ({ query }): ObligationSummary => {
    const fy = fyOf(query);
    const all = db.obligations.filter((o) => o.fiscalYear === fy);
    const valid = all.filter(counts);
    const released = valid.filter((o) => o.status === "Released");
    return {
      fiscalYear: fy,
      allotmentTotal: sum(db.allotments.filter((a) => a.fiscalYear === fy && a.status !== "Draft" && a.status !== "Rejected"), (a) => a.amount),
      totalObligations: sum(valid, (o) => o.amount),
      obligatedAmount: sum(valid.filter((o) => o.status === "Approved" || o.status === "Released"), (o) => o.amount),
      pendingApproval: sum(valid.filter((o) => o.status === "For Approval" || o.status === "Returned"), (o) => o.amount),
      releasedAmount: sum(released, (o) => o.amount),
      totalDisbursed: sum(valid, (o) => o.disbursed),
      count: all.length,
      byTab: Object.fromEntries(
        (Object.keys(TABS) as ObligationTab[]).map((t) => [t, all.filter((o) => TABS[t].includes(o.status)).length]),
      ) as Record<ObligationTab, number>,
      byClass: ALLOTMENT_CLASS_CODES.map((c) => ({ allotmentClass: c, amount: sum(valid.filter((o) => o.allotmentClass === c), (o) => o.amount) })),
      monthly: MONTHS.map((month, i) => {
        const inMonth = valid.filter((o) => new Date(o.date).getUTCMonth() === i);
        return {
          month,
          amount: sum(inMonth, (o) => o.amount),
          released: sum(inMonth.filter((o) => o.status === "Released"), (o) => o.amount),
          count: inMonth.length,
        };
      }),
    };
  }),

  route("GET", ENDPOINTS.obligations.lookups, (): ObligationLookups => {
    const payees = new Map(SAMPLE_PAYEES.map((p) => [p.name, p]));
    db.obligations.forEach((o) => {
      if (!payees.has(o.payee)) payees.set(o.payee, { name: o.payee, tin: o.tin, address: o.address });
    });
    return { ...OBLIGATION_LOOKUPS, payees: [...payees.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  }),

  route("GET", ENDPOINTS.obligations.nextNumber, ({ query }) => ({
    referenceNo: nextSequence("OBL", fyOf(query), db.obligations.map((o) => o.referenceNo)),
  })),

  route<FormData>("POST", ENDPOINTS.obligations.documents, ({ body }): ObligationDocument => {
    const file = body.get("file");
    if (!(file instanceof File)) throw new MockHttpError(400, "No file was uploaded.");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls"].includes(ext)) throw new MockHttpError(415, "Accepted formats are PDF, JPG, PNG and XLSX.");
    if (file.size > 10 * 1024 * 1024) throw new MockHttpError(413, `${file.name} is larger than 10 MB.`);
    const doc: ObligationDocument = {
      id: `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: actor().name,
      url: URL.createObjectURL(file),
    };
    pendingDocuments.set(doc.id, doc);
    return doc;
  }),

  route("GET", "/obligations/:id", ({ params }): ObligationDetail => detail(findObligation(params.id))),

  route<ObligationInput>("POST", ENDPOINTS.obligations.list, ({ body }): Obligation => {
    if (!body.allotmentRef) throw new MockHttpError(422, "Select an allotment.", { allotmentRef: "Select an allotment." });
    const allotment = db.allotments.find((a) => a.allotmentNo === body.allotmentRef);
    if (!allotment) throw new MockHttpError(422, "Allotment not found.", { allotmentRef: "Select a valid allotment." });
    const me = actor();
    const fy = Number((body.date || new Date().toISOString()).slice(0, 4));
    const referenceNo = nextSequence("OBL", fy, db.obligations.map((o) => o.referenceNo));
    const now = new Date().toISOString();
    const record: Obligation = {
      id: referenceNo.toLowerCase(),
      referenceNo,
      fiscalYear: fy,
      date: now,
      allotmentRef: allotment.allotmentNo,
      allotmentClass: allotment.allotmentClass,
      tranche: body.tranche,
      fundSource: "",
      responsibilityCenter: "",
      payee: "",
      tin: "",
      address: "",
      particulars: "",
      uacsCode: "",
      lineItems: [],
      amount: 0,
      appNo: "",
      prNo: "",
      poNo: "",
      modeOfProcurement: "",
      projectActivity: "",
      remarks: "",
      applicableDocuments: [],
      documents: [],
      disbursed: 0,
      status: "Draft",
      workflow: OBLIGATION_STEPS.map((key, i) =>
        i === 0
          ? { key, status: "completed" as const, actorName: me.name, actorPosition: me.position, actedAt: now }
          : { key, status: i === 1 ? ("current" as const) : ("pending" as const) },
      ),
    };
    apply(record, body);
    db.obligations.push(record);
    return record;
  }),

  route<ObligationInput>("PUT", "/obligations/:id", ({ params, body }): Obligation => {
    const record = findObligation(params.id);
    if (record.status !== "Draft" && record.status !== "Returned") {
      throw new MockHttpError(409, "Only draft or returned obligations can be edited.");
    }
    apply(record, body);
    const me = actor();
    if (record.workflow[0].status === "current") {
      record.workflow[0] = { key: "encode", status: "completed", actorName: me.name, actorPosition: me.position, actedAt: new Date().toISOString() };
      record.workflow[1] = { key: "submit", status: "current" };
      record.status = "Draft";
    }
    return record;
  }),

  route<Omit<ObligationWorkflowRequest, "id">>("POST", "/obligations/:id/workflow", ({ params, body }): ObligationDetail => {
    const record = findObligation(params.id);
    const index = obligationCurrentIndex(record.workflow);
    if (index < 0 || record.status === "Released" || record.status === "Cancelled") {
      throw new MockHttpError(409, "This obligation is no longer in the approval workflow.");
    }
    const step = record.workflow[index];
    const me = actor();
    const now = new Date().toISOString();
    const needsRemarks = () => {
      if (!body.remarks?.trim()) throw new MockHttpError(422, "Remarks are required.", { remarks: "Enter remarks for this action." });
    };

    switch (body.action) {
      case "saveRemarks":
        record.workflow[index] = { ...step, draftRemarks: body.remarks ?? "" };
        return detail(record);

      case "submit": {
        if (step.key !== "submit") throw new MockHttpError(409, "This obligation has already been submitted.");
        const input: ObligationInput = { ...record, date: record.date.slice(0, 10), documentIds: record.documents.map((d) => d.id) };
        const errors = validate(input, record.id);
        if (Object.keys(errors).length) throw new MockHttpError(422, Object.values(errors)[0], errors);
        record.workflow[index] = { ...step, status: "completed", actorName: me.name, actorPosition: me.position, actedAt: now, remarks: body.remarks, draftRemarks: undefined };
        record.workflow[index + 1] = { key: "review", status: "current" };
        for (let i = index + 2; i < record.workflow.length; i++) record.workflow[i] = { key: record.workflow[i].key, status: "pending" };
        record.status = "For Approval";
        break;
      }

      case "approve": {
        if (step.key === "encode" || step.key === "submit") throw new MockHttpError(409, "Submit the obligation first.");
        if (step.key === "accountant") needsRemarks();
        if (step.key === "certification" && !body.signature?.trim()) {
          throw new MockHttpError(422, "Sign the certification.", { signature: "Type your full name to sign." });
        }
        const b = balance(record.allotmentRef, record.id);
        if (b && record.amount > b.remaining) throw new MockHttpError(422, "The obligation exceeds the remaining allotment balance.");
        record.workflow[index] = {
          ...step,
          status: "completed",
          actorName: me.name,
          actorPosition: me.position,
          actedAt: now,
          remarks: body.remarks,
          signature: body.signature?.trim(),
          draftRemarks: undefined,
        };
        if (step.key === "certification") {
          // Certification also approves the obligation for release.
          record.workflow[index + 1] = { key: "release", status: "completed", actorName: me.name, actorPosition: me.position, actedAt: now };
          record.status = "Released";
        } else {
          record.workflow[index + 1] = { ...record.workflow[index + 1], status: "current" };
          record.status = step.key === "accountant" ? "Approved" : "For Approval";
        }
        break;
      }

      case "back": {
        if (step.key !== "accountant" && step.key !== "certification") {
          throw new MockHttpError(409, "There is no previous approval step to return to.");
        }
        needsRemarks();
        record.workflow[index] = { key: step.key, status: "pending" };
        const prev = record.workflow[index - 1];
        record.workflow[index - 1] = { key: prev.key, status: "current", remarks: `Sent back by ${me.name}: ${body.remarks}` };
        record.status = "For Approval";
        break;
      }

      case "return":
      case "reject": {
        if (step.key === "encode" || step.key === "submit") throw new MockHttpError(409, "The obligation has not been submitted.");
        needsRemarks();
        record.workflow[index] = {
          ...step,
          status: body.action === "return" ? "returned" : "rejected",
          actorName: me.name,
          actorPosition: me.position,
          actedAt: now,
          remarks: body.remarks,
          draftRemarks: undefined,
        };
        if (body.action === "return") {
          record.workflow[0] = { key: "encode", status: "current" };
          record.workflow[1] = { key: "submit", status: "pending" };
          record.status = "Returned";
        } else {
          record.status = "Cancelled";
        }
        break;
      }
    }
    relinkBudget();
    return detail(record);
  }),

  route("DELETE", "/obligations/:id", ({ params }) => {
    const record = findObligation(params.id);
    if (record.status !== "Draft" && record.status !== "Returned") throw new MockHttpError(409, "Only draft or returned obligations can be deleted.");
    db.obligations = db.obligations.filter((o) => o.id !== params.id);
    relinkBudget();
    return { message: `${record.referenceNo} deleted.` };
  }),
];
