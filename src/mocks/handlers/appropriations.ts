import { ENDPOINTS } from "@/lib/api/endpoints";
import { ALLOTMENT_CLASS_CODES, type AllotmentClassCode } from "@/lib/constants/allotment-classes";
import {
  APPROPRIATION_CATEGORIES,
  type Appropriation,
  type AppropriationDocument,
  type AppropriationLookups,
  type AppropriationSummary,
  type CreateAppropriationRequest,
} from "@/features/appropriations/types";
import { AGENCIES } from "@/config/site";
import { GAA_SAMPLE_ROWS } from "../data/gaa";
import { APPROPRIATION_LEVELS, FUND_SOURCES } from "../data/lookups";
import { db, nextSequence, relinkBudget } from "../services/db";
import { MockHttpError, matchesSearch, num, paginate, route, str, type QueryValue } from "../services/http";

const fyOf = (q: Record<string, QueryValue>) => num(q.fiscalYear, 2026);
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const DOCUMENT_TYPES = [".pdf", ".xlsx", ".xls", ".jpg", ".jpeg", ".png"];

/** Uploaded but not yet attached documents, keyed by id. */
const pendingDocuments = new Map<string, AppropriationDocument>();

function requireFields(body: CreateAppropriationRequest) {
  const errors: Record<string, string> = {};
  const required: (keyof CreateAppropriationRequest)[] = [
    "title",
    "orgCode",
    "program",
    "uacsCode",
    "objectOfExpenditure",
    "fundSource",
    "allotmentClass",
    "level",
    "gaaReference",
    "effectivityDate",
  ];
  for (const key of required) if (!String(body[key] ?? "").trim()) errors[key] = "This field is required.";
  if (!(body.amount > 0)) errors.amount = "Amount must be greater than zero.";
  if (body.allotmentClass && !(ALLOTMENT_CLASS_CODES as readonly string[]).includes(body.allotmentClass)) {
    errors.allotmentClass = "Select a valid allotment class.";
  }
  if (body.expiryDate && body.effectivityDate && body.expiryDate < body.effectivityDate) {
    errors.expiryDate = "Expiry date cannot be earlier than the effectivity date.";
  }
  return errors;
}

export const appropriationHandlers = [
  route("GET", ENDPOINTS.appropriations.list, ({ query }) => {
    const fy = fyOf(query);
    const search = str(query.search);
    const items = db.appropriations
      .filter((a) => a.fiscalYear === fy)
      .filter((a) => !query.allotmentClass || a.allotmentClass === query.allotmentClass)
      .filter((a) => !query.status || a.status === query.status)
      .filter((a) => !query.fundSource || a.fundSource === query.fundSource)
      .filter((a) => !query.program || a.program === query.program)
      .filter((a) => !query.category || a.category === query.category)
      .filter((a) =>
        matchesSearch(search, a.referenceNo, a.orgCode, a.uacsCode, a.objectOfExpenditure, a.title, a.program),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.referenceNo.localeCompare(b.referenceNo));
    return paginate(items, query);
  }),

  route("GET", ENDPOINTS.appropriations.summary, ({ query }): AppropriationSummary => {
    const fy = fyOf(query);
    const items = db.appropriations.filter((a) => a.fiscalYear === fy && a.status !== "Draft");
    const totalAmount = items.reduce((s, a) => s + a.amount, 0);
    const released = items.reduce((s, a) => s + Math.min(a.released, a.amount), 0);
    return {
      fiscalYear: fy,
      totalAmount,
      count: items.length,
      released,
      unreleased: totalAmount - released,
      byClass: ALLOTMENT_CLASS_CODES.map((cls) => ({
        allotmentClass: cls,
        amount: items.filter((a) => a.allotmentClass === cls).reduce((s, a) => s + a.amount, 0),
      })),
      byFundSource: FUND_SOURCES.map((f) => ({
        ...f,
        amount: items.filter((a) => a.fundSource === f.code).reduce((s, a) => s + a.amount, 0),
      })),
      byCategory: Object.fromEntries(
        APPROPRIATION_CATEGORIES.map((c) => [c, items.filter((a) => a.category === c).length]),
      ) as AppropriationSummary["byCategory"],
    };
  }),

  route("GET", ENDPOINTS.appropriations.lookups, (): AppropriationLookups => {
    const uacs = new Map<string, { code: string; description: string; allotmentClass: AllotmentClassCode }>();
    for (const a of db.appropriations) {
      if (!uacs.has(a.uacsCode)) uacs.set(a.uacsCode, { code: a.uacsCode, description: a.objectOfExpenditure, allotmentClass: a.allotmentClass });
    }
    for (const r of GAA_SAMPLE_ROWS) {
      if (!uacs.has(r.uacsObjectCode)) {
        uacs.set(r.uacsObjectCode, { code: r.uacsObjectCode, description: r.description, allotmentClass: r.allotmentClass as AllotmentClassCode });
      }
    }
    return {
      offices: AGENCIES.map((a) => ({ orgCode: a.code, name: a.name })),
      programs: [...new Set(db.appropriations.map((a) => a.program))].sort(),
      fundSources: FUND_SOURCES,
      levels: APPROPRIATION_LEVELS,
      uacsCodes: [...uacs.values()].sort((a, b) => a.code.localeCompare(b.code)),
    };
  }),

  route<FormData>("POST", ENDPOINTS.appropriations.documents, ({ body }): AppropriationDocument => {
    const file = body.get("file");
    if (!(file instanceof File)) throw new MockHttpError(400, "No file was uploaded.");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!DOCUMENT_TYPES.includes(ext)) throw new MockHttpError(415, "Accepted formats are PDF, Excel, JPG and PNG.");
    if (file.size > MAX_DOCUMENT_SIZE) throw new MockHttpError(413, `${file.name} is larger than 10 MB.`);
    const doc: AppropriationDocument = {
      id: `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
    pendingDocuments.set(doc.id, doc);
    return doc;
  }),

  route<CreateAppropriationRequest>("POST", ENDPOINTS.appropriations.list, ({ body }): Appropriation => {
    if (!body.title?.trim()) throw new MockHttpError(422, "Enter a title.", { title: "Appropriation title is required." });
    if (!body.draft) {
      const errors = requireFields(body);
      if (Object.keys(errors).length) throw new MockHttpError(422, "Some fields are invalid.", errors);
    }
    const office = AGENCIES.find((a) => a.code === body.orgCode);
    const referenceNo = nextSequence("APP", body.fiscalYear, db.appropriations.map((a) => a.referenceNo));
    const record: Appropriation = {
      id: referenceNo.toLowerCase(),
      referenceNo,
      fiscalYear: body.fiscalYear,
      title: body.title.trim(),
      type: body.type,
      orgCode: body.orgCode,
      office: office?.name ?? "",
      program: body.program,
      papCode: "",
      uacsCode: body.uacsCode,
      objectOfExpenditure: body.objectOfExpenditure,
      fundSource: body.fundSource,
      allotmentClass: body.allotmentClass,
      amount: body.amount || 0,
      allotted: 0,
      released: 0,
      level: body.level,
      gaaReference: body.gaaReference,
      gaaPart: body.gaaPart,
      effectivityDate: body.effectivityDate,
      expiryDate: body.expiryDate || undefined,
      remarks: body.remarks,
      documents: body.documentIds.map((id) => pendingDocuments.get(id)).filter((d): d is AppropriationDocument => !!d),
      status: body.draft ? "Draft" : "Unreleased",
      createdAt: new Date().toISOString(),
    };
    body.documentIds.forEach((id) => pendingDocuments.delete(id));
    db.appropriations.push(record);
    return record;
  }),

  route("DELETE", "/appropriations/:id", ({ params }) => {
    const record = db.appropriations.find((a) => a.id === params.id);
    if (!record) throw new MockHttpError(404, "Appropriation not found.");
    if (record.allotted > 0) throw new MockHttpError(409, "Appropriations with allotments cannot be deleted.");
    db.appropriations = db.appropriations.filter((a) => a.id !== params.id);
    relinkBudget();
    return { message: `${record.referenceNo} deleted.` };
  }),
];
