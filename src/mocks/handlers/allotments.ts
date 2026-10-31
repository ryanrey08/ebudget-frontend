import { ENDPOINTS } from "@/lib/api/endpoints";
import { ALLOTMENT_CLASS_CODES } from "@/lib/constants/allotment-classes";
import {
  REGISTRY_WORKFLOW_STEPS,
  WORKFLOW_STEPS,
  type RegistryAllotmentInput,
  type RegistryLookups,
  type Allotment,
  type AllotmentDetail,
  type AllotmentDocument,
  type AllotmentStatus,
  type AllotmentStatusGroup,
  type AllotmentSummary,
  type AllotmentWorkflowRequest,
  type CreateAllotmentRequest,
} from "@/features/allotments/types";
import { ROLE_LABELS } from "@/features/auth/types";
import { db, nextSequence, relinkBudget } from "../services/db";
import { MockHttpError, matchesSearch, num, paginate, route, str, type QueryValue } from "../services/http";
import { getMockSessionUserId } from "../services/session";
import { SAMPLE_ACTORS, currentStepIndex } from "../services/workflow";

const fyOf = (q: Record<string, QueryValue>) => num(q.fiscalYear, 2026);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOCUMENT_TYPES = [".pdf", ".xlsx", ".xls", ".jpg", ".jpeg", ".png"];
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const counts = (a: Allotment) => a.status !== "Draft" && a.status !== "Rejected";
const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((t, i) => t + pick(i), 0);

const GROUPS: Record<AllotmentStatusGroup, AllotmentStatus[]> = {
  released: ["Released"],
  partial: ["Partial"],
  unreleased: ["Unreleased"],
  approval: ["For Approval"],
  draft: ["Draft", "Returned", "Rejected"],
};

/** Uploaded but not yet attached documents. */
const pendingDocuments = new Map<string, AllotmentDocument>();

// Category labels taken from the RAOFE mockups (display grouping only).
const RAOFE_LINE_CATEGORIES = ["Subsidies to LGUs", "Grants", "Financial Charges", "Equity Contributions", "Other Financial Expenses"];
const RAOFE_DOCUMENT_CATEGORIES = ["MOA", "Resolution", "Support Document", "GAA", "Others"];

/** Departments for allotment-class registries (sample list for demo mode). */
const REGISTRY_DEPARTMENTS = [
  "General Administration",
  "Finance Office",
  "ICT Services",
  "Administrative Services",
  "General Services",
  "Procurement Unit",
  "Human Resource Office",
  "Academic Affairs",
  "Other Offices",
];

function applyRegistryInput(record: Allotment, input: RegistryAllotmentInput) {
  const app = db.appropriations.find((a) => a.referenceNo === input.appropriationRef);
  const lineItems = input.lineItems.map((li, i) => ({ ...li, id: `li-${i + 1}`, amount: Math.round(li.quantity * li.unitCost * 100) / 100 }));
  const lineTotal = sum(lineItems, (li) => li.amount);
  const amount = input.amount && input.amount > 0 ? input.amount : lineTotal;
  const uacs = input.uacsCode || lineItems[0]?.uacsCode || app?.uacsCode || "";
  Object.assign(record, {
    fiscalYear: input.fiscalYear,
    date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
    appropriationRef: input.appropriationRef,
    appropriationTitle: app?.title ?? "",
    program: app?.program ?? record.program,
    allotmentClass: input.allotmentClass,
    tranche: input.tranche,
    gaaReferenceNo: input.gaaReferenceNo,
    department: input.department,
    responsibilityCenter: input.responsibilityCenter,
    fundSource: input.fundSource,
    uacsCode: uacs,
    objectOfExpenditure: app?.uacsCode === uacs ? app.objectOfExpenditure : input.lineItems[0]?.description ?? app?.objectOfExpenditure ?? "",
    purpose: input.purpose,
    remarks: input.remarks,
    requiredDocuments: input.requiredDocuments,
    effectivityDate: input.effectivityDate || undefined,
    validityDate: input.validityDate || undefined,
    lineItems,
    amount,
    releaseAmount: amount,
    releaseDate: (input.date || new Date().toISOString()).slice(0, 10),
  });
  const added = input.documentIds.map((id) => pendingDocuments.get(id)).filter((d): d is AllotmentDocument => !!d);
  input.documentIds.forEach((id) => pendingDocuments.delete(id));
  const keep = new Set(input.documentIds);
  record.documents = [...(record.documents ?? []).filter((d) => keep.has(d.id)), ...added];
}

function actor() {
  const user = db.users.find((u) => u.user.id === getMockSessionUserId())?.user;
  if (!user) throw new MockHttpError(401, "You are not signed in.");
  return { name: `${user.firstName} ${user.lastName}`, position: ROLE_LABELS[user.role] };
}

function findAllotment(id: string) {
  const record = db.allotments.find((a) => a.id === id);
  if (!record) throw new MockHttpError(404, "Allotment not found.");
  return record;
}

function balanceFor(appropriationRef: string, excludeId?: string) {
  const app = db.appropriations.find((a) => a.referenceNo === appropriationRef);
  if (!app) return null;
  const totalAllotted = sum(
    db.allotments.filter((a) => a.appropriationRef === appropriationRef && counts(a) && a.id !== excludeId),
    (a) => a.amount,
  );
  return { app, totalAllotted, remaining: app.amount - totalAllotted };
}

function detail(record: Allotment): AllotmentDetail {
  const b = balanceFor(record.appropriationRef);
  return {
    allotment: record,
    appropriation: b
      ? {
          referenceNo: b.app.referenceNo,
          title: b.app.title,
          status: b.app.status,
          amount: b.app.amount,
          totalAllotted: b.totalAllotted,
          remaining: b.remaining,
        }
      : null,
  };
}

function storeDocument(file: File, category?: string, description?: string): AllotmentDocument {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!DOCUMENT_TYPES.includes(ext)) throw new MockHttpError(415, "Accepted formats are PDF, Excel, JPG and PNG.");
  if (file.size > MAX_DOCUMENT_SIZE) throw new MockHttpError(413, `${file.name} is larger than 10 MB.`);
  return {
    id: `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
    uploadedBy: actor().name,
    category: category || undefined,
    description: description || undefined,
    // Session-only link so uploaded files can be viewed/downloaded in demo mode.
    url: URL.createObjectURL(file),
  };
}

function validateRequest(body: CreateAllotmentRequest, excludeId?: string) {
  const errors: Record<string, string> = {};
  const b = balanceFor(body.appropriationRef, excludeId);
  if (!b) errors.appropriationRef = "Select a valid appropriation.";
  else if (b.app.status === "Draft") errors.appropriationRef = "The appropriation is still a draft.";
  if (!(ALLOTMENT_CLASS_CODES as readonly string[]).includes(body.allotmentClass)) errors.allotmentClass = "Select an allotment class.";
  if (!body.fundSource) errors.fundSource = "Select a fund source.";
  if (!(body.amount > 0)) errors.amount = "Amount must be greater than zero.";
  else if (b && body.amount > b.remaining) errors.amount = "Amount exceeds the remaining unallotted balance.";
  if (!(body.releaseAmount > 0)) errors.releaseAmount = "Release amount must be greater than zero.";
  else if (body.releaseAmount > body.amount) errors.releaseAmount = "Release amount cannot exceed the allotment amount.";
  if (!body.releaseDate) errors.releaseDate = "Select a release date.";
  if (!body.purpose?.trim()) errors.purpose = "Enter the purpose/particulars.";
  const dates = body as { effectivityDate?: string; validityDate?: string };
  if (dates.effectivityDate && dates.validityDate && dates.validityDate < dates.effectivityDate) {
    errors.validityDate = "Validity date cannot be earlier than the effectivity date.";
  }
  return errors;
}

export const allotmentHandlers = [
  route("GET", ENDPOINTS.allotments.list, ({ query }) => {
    const fy = fyOf(query);
    const search = str(query.search);
    const group = str(query.group) as AllotmentStatusGroup | "";
    const items = db.allotments
      .filter((a) => a.fiscalYear === fy)
      .filter((a) => !query.allotmentClass || a.allotmentClass === query.allotmentClass)
      .filter((a) => !query.fundSource || a.fundSource === query.fundSource)
      .filter((a) => !query.program || a.program === query.program)
      .filter((a) => !query.department || a.department === query.department)
      .filter((a) => !query.status || a.status === query.status)
      .filter((a) => !group || GROUPS[group]?.includes(a.status))
      .filter((a) => matchesSearch(search, a.allotmentNo, a.appropriationRef, a.orgCode, a.objectOfExpenditure, a.purpose, a.program))
      .sort((a, b) => b.allotmentNo.localeCompare(a.allotmentNo));
    return paginate(items, query);
  }),

  route("GET", ENDPOINTS.allotments.summary, ({ query }): AllotmentSummary => {
    const fy = fyOf(query);
    const all = db.allotments.filter((a) => a.fiscalYear === fy);
    const items = all.filter(counts);
    const totalAllotments = sum(items, (a) => a.amount);
    const totalReleased = sum(items, (a) => a.released);
    return {
      fiscalYear: fy,
      appropriationTotal: sum(db.appropriations.filter((a) => a.fiscalYear === fy && a.status !== "Draft"), (a) => a.amount),
      totalAllotments,
      totalReleased,
      unreleased: totalAllotments - totalReleased,
      count: all.length,
      byGroup: Object.fromEntries(
        (Object.keys(GROUPS) as AllotmentStatusGroup[]).map((g) => [g, all.filter((a) => GROUPS[g].includes(a.status)).length]),
      ) as Record<AllotmentStatusGroup, number>,
      byClass: ALLOTMENT_CLASS_CODES.map((cls) => ({
        allotmentClass: cls,
        amount: sum(items.filter((a) => a.allotmentClass === cls), (a) => a.amount),
      })),
      monthly: MONTHS.map((month, i) => {
        const inMonth = items.filter((a) => new Date(a.date).getUTCMonth() === i);
        const allotted = sum(inMonth, (a) => a.amount);
        const released = sum(inMonth, (a) => a.released);
        return { month, allotted, released, unreleased: allotted - released };
      }),
    };
  }),

  route("GET", ENDPOINTS.allotments.nextNumber, ({ query }) => ({
    allotmentNo: nextSequence("ALT", fyOf(query), db.allotments.map((a) => a.allotmentNo)),
  })),

  route<FormData>("POST", ENDPOINTS.allotments.documents, ({ body }): AllotmentDocument => {
    const file = body.get("file");
    if (!(file instanceof File)) throw new MockHttpError(400, "No file was uploaded.");
    const doc = storeDocument(file, String(body.get("category") ?? ""), String(body.get("description") ?? ""));
    pendingDocuments.set(doc.id, doc);
    return doc;
  }),

  route("GET", "/allotments/:id", ({ params }): AllotmentDetail => detail(findAllotment(params.id))),

  route<FormData>("POST", "/allotments/:id/documents", ({ params, body }): AllotmentDetail => {
    const record = findAllotment(params.id);
    const file = body.get("file");
    if (!(file instanceof File)) throw new MockHttpError(400, "No file was uploaded.");
    record.documents = [...record.documents, storeDocument(file)];
    return detail(record);
  }),

  route<CreateAllotmentRequest>("POST", ENDPOINTS.allotments.list, ({ body }): Allotment => {
    if (!body.appropriationRef) {
      throw new MockHttpError(422, "Select an appropriation.", { appropriationRef: "Select an appropriation." });
    }
    if (!body.draft) {
      const errors = validateRequest(body);
      if (Object.keys(errors).length) throw new MockHttpError(422, "Some fields are invalid.", errors);
    }
    const app = db.appropriations.find((a) => a.referenceNo === body.appropriationRef);
    if (!app) throw new MockHttpError(422, "Appropriation not found.", { appropriationRef: "Select a valid appropriation." });
    const me = actor();
    const now = new Date().toISOString();
    const allotmentNo = nextSequence("ALT", body.fiscalYear, db.allotments.map((a) => a.allotmentNo));
    const record: Allotment = {
      id: allotmentNo.toLowerCase(),
      allotmentNo,
      fiscalYear: body.fiscalYear,
      date: now,
      appropriationRef: app.referenceNo,
      appropriationTitle: app.title,
      orgCode: app.orgCode,
      office: app.office,
      program: app.program,
      uacsCode: app.uacsCode,
      objectOfExpenditure: app.objectOfExpenditure,
      allotmentClass: body.allotmentClass,
      fundSource: body.fundSource,
      amount: body.amount || 0,
      tranche: body.tranche,
      releaseAmount: body.releaseAmount || 0,
      releaseDate: body.releaseDate,
      released: 0,
      obligated: 0,
      purpose: body.purpose,
      documents: body.documentIds.map((id) => pendingDocuments.get(id)).filter((d): d is AllotmentDocument => !!d),
      status: body.draft ? "Draft" : "For Approval",
      workflow: WORKFLOW_STEPS.map((key, i) => {
        if (i === 0) {
          return body.draft
            ? { key, status: "current" as const }
            : { key, status: "completed" as const, actorName: me.name, actorPosition: me.position, actedAt: now };
        }
        return { key, status: !body.draft && i === 1 ? ("current" as const) : ("pending" as const) };
      }),
    };
    body.documentIds.forEach((id) => pendingDocuments.delete(id));
    db.allotments.push(record);
    relinkBudget();
    return record;
  }),

  route<Omit<AllotmentWorkflowRequest, "id">>("POST", "/allotments/:id/workflow", ({ params, body }): AllotmentDetail => {
    const record = findAllotment(params.id);
    const me = actor();
    const now = new Date().toISOString();
    const index = currentStepIndex(record.workflow);
    if (record.status === "Rejected" || record.status === "Released" || record.status === "Partial" || index < 0) {
      throw new MockHttpError(409, "This allotment is no longer in the approval workflow.");
    }
    const step = record.workflow[index];

    const registry = record.workflowType === "registry";
    const last = index === record.workflow.length - 1;

    if (body.action === "saveRemarks") {
      record.workflow[index] = { ...step, draftRemarks: body.remarks ?? "" };
      return detail(record);
    }

    if (body.action === "submit") {
      const submitKey = registry ? "submit" : "prepared";
      if (step.key !== submitKey) throw new MockHttpError(409, "Only drafts or returned allotments can be submitted.");
      const errors = validateRequest(
        { ...record, documentIds: [], draft: false, fiscalYear: record.fiscalYear },
        record.id,
      );
      if (registry && !record.lineItems?.length) errors.lineItems = "Add at least one line item.";
      if (registry && sum(record.lineItems ?? [], (li) => li.amount) > record.amount) {
        errors.lineItems = "Line items exceed the total allotment amount.";
      }
      if (Object.keys(errors).length) throw new MockHttpError(422, Object.values(errors)[0], errors);
      record.workflow = record.workflow.map((s, i) => {
        if (i < index) return s;
        if (i === index) {
          return { ...s, status: "completed", actorName: me.name, actorPosition: me.position, actedAt: now, remarks: body.remarks, submission: body.submission, draftRemarks: undefined };
        }
        return { key: s.key, status: i === index + 1 ? "current" : "pending" };
      });
      record.status = "For Approval";
    } else if (body.action === "approve") {
      if (step.key === "prepared" || step.key === "submit") throw new MockHttpError(409, "Submit the allotment first.");
      if (step.key === "release" && !body.mdsReferenceNo?.trim()) {
        throw new MockHttpError(422, "Enter the MDS reference number.", { mdsReferenceNo: "MDS reference no. is required." });
      }
      if (registry && step.key !== "review" && !body.signature?.trim()) {
        throw new MockHttpError(422, "Sign before approving.", { signature: "Type your full name to sign." });
      }
      record.workflow[index] = { ...step, status: "completed", actorName: me.name, actorPosition: me.position, actedAt: now, remarks: body.remarks, signature: body.signature?.trim(), draftRemarks: undefined };
      if (step.key === "release" || (registry && last)) {
        // Final step: the allotment amount is released.
        record.released = record.releaseAmount;
        record.status = record.releaseAmount >= record.amount ? "Released" : "Partial";
        record.release = {
          releaseNo: record.release?.releaseNo ?? nextSequence("REL", record.fiscalYear, db.allotments.map((a) => a.release?.releaseNo ?? "")),
          releaseDate: body.releaseDate || record.releaseDate,
          mdsReferenceNo: body.mdsReferenceNo?.trim(),
          releasedAt: now,
        };
      } else {
        record.workflow[index + 1] = { ...record.workflow[index + 1], status: "current" };
        if (step.key === "certification") {
          record.status = "Unreleased";
          record.release = {
            releaseNo: nextSequence("REL", record.fiscalYear, db.allotments.map((a) => a.release?.releaseNo ?? "")),
            releaseDate: record.releaseDate,
          };
        }
      }
    } else {
      if (step.key === "prepared" || step.key === "submit") throw new MockHttpError(409, "The allotment has not been submitted.");
      if (!body.remarks?.trim()) {
        throw new MockHttpError(422, "Remarks are required.", { remarks: "Explain why the allotment is being returned or rejected." });
      }
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
        // Back to the preparer; later steps start over on resubmission.
        record.workflow[0] = { key: "prepared", status: "current" };
        if (registry) record.workflow[1] = { key: "submit", status: "pending" };
        record.status = "Returned";
      } else {
        record.status = "Rejected";
      }
    }
    relinkBudget();
    return detail(record);
  }),

  route("GET", "/allotment-classes/:code/lookups", ({ params }): RegistryLookups => ({
    departments: REGISTRY_DEPARTMENTS,
    priorities: ["Normal", "High", "Urgent"],
    ...(params.code === "RAOFE"
      ? { lineCategories: RAOFE_LINE_CATEGORIES }
      : {}),
    documentCategories: params.code === "RAOFE" ? RAOFE_DOCUMENT_CATEGORIES : ["GAA", "Purchase Request", "PPMP", "Canvass", "Technical Specification", "BAC Resolution", "Project Proposal", "Others"],
    requiredDocuments: params.code === "RAOFE" ? [] : [
      "General Appropriations Act (GAA)",
      "Approved Budget of the Contract / Purchase Request (PR)",
      "Project Procurement Management Plan (PPMP)",
      "Purchase/Procurement Request",
      "Canvass/Price Quotation",
      "Approved Project/Activity Proposal",
      "Technical Specifications",
      "BAC Resolution / Notice of Award",
      "Others (if applicable)",
    ],
    approvers: [
      { step: "review", label: `Budget Head (${SAMPLE_ACTORS.review.name})` },
      { step: "accountant", label: `Accountant (${SAMPLE_ACTORS.accountant.name})` },
      { step: "certification", label: `Head of Agency (${SAMPLE_ACTORS.certification.name})` },
    ],
  })),

  route<RegistryAllotmentInput>("POST", ENDPOINTS.allotments.registry, ({ body }): Allotment => {
    const app = db.appropriations.find((a) => a.referenceNo === body.appropriationRef);
    if (!app) throw new MockHttpError(422, "Select the reference appropriation.", { appropriationRef: "Select the reference appropriation." });
    const me = actor();
    const now = new Date().toISOString();
    const allotmentNo = nextSequence("ALT", body.fiscalYear, db.allotments.map((a) => a.allotmentNo));
    const record = {
      id: allotmentNo.toLowerCase(),
      allotmentNo,
      fiscalYear: body.fiscalYear,
      appropriationRef: app.referenceNo,
      appropriationTitle: app.title,
      orgCode: app.orgCode,
      office: app.office,
      program: app.program,
      released: 0,
      obligated: 0,
      documents: [],
      status: "Draft",
      workflowType: "registry",
      workflow: REGISTRY_WORKFLOW_STEPS.map((key, i) =>
        i === 0
          ? { key, status: "completed" as const, actorName: me.name, actorPosition: me.position, actedAt: now }
          : { key, status: i === 1 ? ("current" as const) : ("pending" as const) },
      ),
    } as unknown as Allotment;
    applyRegistryInput(record, body);
    db.allotments.push(record);
    relinkBudget();
    return record;
  }),

  route<RegistryAllotmentInput>("PUT", "/allotments/:id/registry", ({ params, body }): Allotment => {
    const record = findAllotment(params.id);
    if (record.status !== "Draft" && record.status !== "Returned") throw new MockHttpError(409, "Only draft or returned allotments can be edited.");
    applyRegistryInput(record, body);
    if (record.workflow[0].status === "current") {
      const me = actor();
      record.workflow[0] = { key: "prepared", status: "completed", actorName: me.name, actorPosition: me.position, actedAt: new Date().toISOString() };
      record.workflow[1] = { key: "submit", status: "current" };
      record.status = "Draft";
    }
    relinkBudget();
    return record;
  }),

  route("DELETE", "/allotments/:id/documents/:docId", ({ params }): AllotmentDetail => {
    const record = findAllotment(params.id);
    if (record.status !== "Draft" && record.status !== "Returned") throw new MockHttpError(409, "Documents can only be removed before submission.");
    record.documents = record.documents.filter((d) => d.id !== params.docId);
    return detail(record);
  }),

  route("DELETE", "/allotments/:id", ({ params }) => {
    const record = findAllotment(params.id);
    if (record.status !== "Draft" && record.status !== "Returned") {
      throw new MockHttpError(409, "Only draft or returned allotments can be deleted.");
    }
    db.allotments = db.allotments.filter((a) => a.id !== params.id);
    relinkBudget();
    return { message: `${record.allotmentNo} deleted.` };
  }),
];
