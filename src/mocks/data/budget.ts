import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { Appropriation, AppropriationCategory } from "@/features/appropriations/types";
import type { Allotment, TrancheType } from "@/features/allotments/types";
import { seedWorkflow, type SeedStage } from "../services/workflow";
import type { Obligation, ObligationStatus } from "@/features/obligation-management/types";
import { seedObligationWorkflow } from "../services/obligation-workflow";

/**
 * Seed data for appropriations, allotments and obligations. FY 2026 figures
 * mirror the eBudget dashboard reference (₱500M appropriations, ₱420M
 * allotments, ₱310M obligations); earlier years are scaled copies.
 */

const M = 1_000_000;

interface AppropriationSeed {
  cls: AllotmentClassCode;
  uacs: string;
  object: string;
  pap: string;
  program: string;
  fund: string;
  amount: number;
}

export const AGENCY = { orgCode: "08 011 0000000", name: "Marikina Polytechnic College" };

/** Illustrative grouping for the list's category tabs (dummy data only). */
function categoryFor(s: AppropriationSeed): AppropriationCategory {
  if (s.fund === "164") return "Special Purpose Funds";
  if (s.cls === "RAOFE") return "Automatic Appropriations";
  return "Permanent";
}

const APPROPRIATION_SEEDS: AppropriationSeed[] = [
  { cls: "RAOPS", uacs: "50101010", object: "Salaries and Wages – Regular", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 120 * M },
  { cls: "RAOPS", uacs: "50101020", object: "Salaries and Wages – Casual/Contractual", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 20 * M },
  { cls: "RAOPS", uacs: "50102010", object: "Personnel Economic Relief Allowance (PERA)", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 25 * M },
  { cls: "RAOPS", uacs: "50102020", object: "Representation Allowance (RA)", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 8 * M },
  { cls: "RAOPS", uacs: "50102030", object: "Transportation Allowance (TA)", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 7 * M },
  { cls: "RAOPS", uacs: "50103010", object: "Personnel Benefit Contributions", pap: "PAP-002", program: "Instructional Services", fund: "101", amount: 20 * M },
  { cls: "RAOMO", uacs: "50203010", object: "Office Supplies Expenses", pap: "PAP-002", program: "Instructional Services", fund: "101", amount: 55 * M },
  { cls: "RAOMO", uacs: "50203020", object: "ICT Supplies Expenses", pap: "PAP-002", program: "Instructional Services", fund: "101", amount: 10 * M },
  { cls: "RAOMO", uacs: "50202010", object: "Training Expenses", pap: "PAP-004", program: "Extension Services", fund: "101", amount: 15 * M },
  { cls: "RAOMO", uacs: "50201010", object: "Travelling Expenses – Local", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 5 * M },
  { cls: "RAOMO", uacs: "50204010", object: "Utility Expenses", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 20 * M },
  { cls: "RAOMO", uacs: "50213040", object: "Repairs and Maintenance – Buildings", pap: "PAP-001", program: "General Administration and Support Services", fund: "101", amount: 10 * M },
  { cls: "RAOMO", uacs: "50299990", object: "Other Maintenance and Operating Expenses", pap: "PAP-003", program: "Research and Development", fund: "164", amount: 10 * M },
  { cls: "RAOCO", uacs: "50604020", object: "Buildings and Other Structures", pap: "PAP-005", program: "Infrastructure Development", fund: "151", amount: 48 * M },
  { cls: "RAOCO", uacs: "50605030", object: "ICT Equipment", pap: "PAP-005", program: "Infrastructure Development", fund: "151", amount: 25 * M },
  { cls: "RAOCO", uacs: "50605080", object: "Laboratory Equipment", pap: "PAP-003", program: "Research and Development", fund: "164", amount: 13 * M },
  { cls: "RAOCO", uacs: "50604010", object: "Land Improvements", pap: "PAP-005", program: "Infrastructure Development", fund: "151", amount: 14 * M },
  { cls: "RAOFE", uacs: "50301020", object: "Interest Expenses", pap: "PAP-006", program: "Financial Operations", fund: "101", amount: 30 * M },
  { cls: "RAOFE", uacs: "50301040", object: "Bank Charges", pap: "PAP-006", program: "Financial Operations", fund: "101", amount: 15 * M },
  { cls: "RAOFE", uacs: "50301990", object: "Other Financial Charges", pap: "PAP-006", program: "Financial Operations", fund: "101", amount: 30 * M },
];

interface AllotmentSeed {
  cls: AllotmentClassCode;
  /** Index into APPROPRIATION_SEEDS */
  app: number;
  allottee: string;
  purpose: string;
  amount: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  status: SeedStage;
}

const ALLOTMENT_SEEDS: AllotmentSeed[] = [
  { cls: "RAOPS", app: 0, allottee: "Human Resource Office", purpose: "Salaries of regular personnel – Q1", amount: 60 * M, quarter: "Q1", status: "Released" },
  { cls: "RAOPS", app: 0, allottee: "Academic Affairs", purpose: "Faculty salaries – Q2", amount: 40 * M, quarter: "Q2", status: "Released" },
  { cls: "RAOPS", app: 2, allottee: "Human Resource Office", purpose: "PERA – 1st semester", amount: 25 * M, quarter: "Q1", status: "Released" },
  { cls: "RAOMO", app: 6, allottee: "Supply and Property Office", purpose: "Office supplies – 1st tranche", amount: 30 * M, quarter: "Q1", status: "Released" },
  { cls: "RAOCO", app: 13, allottee: "Facilities Office", purpose: "Academic building renovation", amount: 33 * M, quarter: "Q1", status: "Partial" },
  { cls: "RAOFE", app: 17, allottee: "Accounting Office", purpose: "Loan interest – 1st half", amount: 30 * M, quarter: "Q1", status: "Released" },
  { cls: "RAOMO", app: 10, allottee: "General Services Office", purpose: "Utilities – electricity and water", amount: 20 * M, quarter: "Q2", status: "Released" },
  { cls: "RAOFE", app: 19, allottee: "Cashier Office", purpose: "Other financial charges", amount: 25 * M, quarter: "Q2", status: "Released" },
  { cls: "RAOCO", app: 14, allottee: "ICT Office", purpose: "Computer laboratory equipment", amount: 20 * M, quarter: "Q2", status: "Partial" },
  { cls: "RAOMO", app: 8, allottee: "Research and Extension", purpose: "Training and seminars", amount: 15 * M, quarter: "Q2", status: "Released" },
  { cls: "RAOPS", app: 5, allottee: "Human Resource Office", purpose: "Personnel benefit contributions", amount: 15 * M, quarter: "Q3", status: "Released" },
  { cls: "RAOFE", app: 18, allottee: "Cashier Office", purpose: "Bank charges", amount: 15 * M, quarter: "Q3", status: "Released" },
  { cls: "RAOMO", app: 11, allottee: "Facilities Office", purpose: "Building repairs", amount: 10 * M, quarter: "Q3", status: "accountant" },
  { cls: "RAOPS", app: 1, allottee: "Human Resource Office", purpose: "Casual personnel salaries", amount: 11.5 * M, quarter: "Q3", status: "Unreleased" },
  { cls: "RAOCO", app: 15, allottee: "Research Office", purpose: "Laboratory equipment", amount: 13 * M, quarter: "Q3", status: "review" },
  { cls: "RAOCO", app: 16, allottee: "Facilities Office", purpose: "CO – 1st Tranche", amount: 14 * M, quarter: "Q4", status: "Released" },
  { cls: "RAOPS", app: 0, allottee: "Human Resource Office", purpose: "PS – 1st Tranche", amount: 18.5 * M, quarter: "Q4", status: "Released" },
  { cls: "RAOMO", app: 6, allottee: "Supply and Property Office", purpose: "MOOE – 2nd Tranche", amount: 25 * M, quarter: "Q4", status: "Released" },
];

interface ObligationSeed {
  cls: AllotmentClassCode;
  payee: string;
  particulars: string;
}

const OBLIGATION_SEEDS: ObligationSeed[] = [
  { cls: "RAOPS", payee: "MPC Regular Employees", particulars: "Payroll – January" },
  { cls: "RAOMO", payee: "Meralco", particulars: "Electricity – January" },
  { cls: "RAOFE", payee: "Land Bank of the Philippines", particulars: "Loan interest – Q1" },
  { cls: "RAOPS", payee: "MPC Regular Employees", particulars: "Payroll – February" },
  { cls: "RAOCO", payee: "ABC Construction Corp.", particulars: "Building renovation – progress billing 1" },
  { cls: "RAOMO", payee: "XYZ Trading", particulars: "Office supplies" },
  { cls: "RAOPS", payee: "GSIS", particulars: "Personnel benefit contributions – Q1" },
  { cls: "RAOMO", payee: "Manila Water Company", particulars: "Water – Q1" },
  { cls: "RAOPS", payee: "MPC Regular Employees", particulars: "Payroll – March" },
  { cls: "RAOCO", payee: "Tech Solutions Inc.", particulars: "Laboratory equipment" },
  { cls: "RAOFE", payee: "Development Bank of the Philippines", particulars: "Bank charges – Q1" },
  { cls: "RAOMO", payee: "Prima Marketing", particulars: "Training and seminars" },
  { cls: "RAOPS", payee: "MPC Casual Employees", particulars: "Casual payroll – Q1" },
  { cls: "RAOCO", payee: "JKL Engineering", particulars: "Infrastructure Phase II" },
  { cls: "RAOMO", payee: "CleanPlus Services", particulars: "Janitorial services" },
  { cls: "RAOPS", payee: "PhilHealth", particulars: "Employer share – Q2" },
  { cls: "RAOFE", payee: "Land Bank of the Philippines", particulars: "Loan interest – Q2" },
  { cls: "RAOMO", payee: "SafeSecure Corp.", particulars: "Security services" },
  { cls: "RAOCO", payee: "Greenfield Contractors", particulars: "ICT infrastructure" },
  { cls: "RAOPS", payee: "MPC Regular Employees", particulars: "Payroll – June" },
  { cls: "RAOMO", payee: "Global Medical Supply", particulars: "Medical supplies" },
  { cls: "RAOFE", payee: "Bureau of the Treasury", particulars: "Other financial charges" },
  { cls: "RAOPS", payee: "Pag-IBIG Fund", particulars: "Employer share – Q3" },
  { cls: "RAOMO", payee: "Marikina IT Solutions", particulars: "Software licenses" },
  { cls: "RAOCO", payee: "BuildRight Corp.", particulars: "Land improvements" },
  { cls: "RAOPS", payee: "MPC Regular Employees", particulars: "Payroll – September" },
  { cls: "RAOMO", payee: "EduTech Solutions", particulars: "Learning materials" },
  { cls: "RAOFE", payee: "Development Bank of the Philippines", particulars: "Bank charges – Q3" },
  { cls: "RAOCO", payee: "Tech Solutions Inc.", particulars: "ICT Equipment" },
  { cls: "RAOMO", payee: "Office Warehouse Inc.", particulars: "Office Supplies Procurement" },
];

/** Fixed amounts for the most recent obligations (match the dashboard reference). */
const FIXED_AMOUNTS: Record<number, number> = { 28: 5.8 * M, 29: 3.25 * M };

const CLASS_OBLIGATION_TOTALS: Record<AllotmentClassCode, number> = {
  RAOPS: 125 * M,
  RAOMO: 75 * M,
  RAOCO: 60 * M,
  RAOFE: 50 * M,
};

const WEIGHTS = [1.4, 0.9, 1.2, 0.7, 1.1, 0.8, 1.3, 0.6, 1.0, 0.95];

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Spreads `count` dates between Jan 5 and Oct 19 of the fiscal year. */
function spreadDate(fy: number, index: number, count: number) {
  const start = Date.UTC(fy, 0, 5);
  const end = Date.UTC(fy, 9, 19);
  const t = start + ((end - start) * index) / Math.max(count - 1, 1);
  return new Date(roundTo(t, 86_400_000)).toISOString();
}

const pad = (n: number) => String(n).padStart(3, "0");

function obligationStatusFor(index: number, count: number): ObligationStatus {
  const remaining = count - index;
  if (remaining <= 2) return "For Approval";
  if (remaining <= 4) return "Approved";
  return "Released";
}

const DISBURSED_RATIO: Record<ObligationStatus, number> = {
  Released: 0.85,
  Approved: 0,
  "For Approval": 0,
  Draft: 0,
  Returned: 0,
  Cancelled: 0,
};

export interface BudgetSeed {
  appropriations: Appropriation[];
  allotments: Allotment[];
  obligations: Obligation[];
}

export function buildBudgetSeed(fy: number, scale: number): BudgetSeed {
  const appropriations: Appropriation[] = APPROPRIATION_SEEDS.map((s, i) => ({
    id: `app-${fy}-${pad(i + 1)}`,
    referenceNo: `APP-${fy}-${pad(i + 1)}`,
    fiscalYear: fy,
    title: s.object,
    type: "GAA",
    category: categoryFor(s),
    orgCode: AGENCY.orgCode,
    office: AGENCY.name,
    uacsCode: s.uacs,
    objectOfExpenditure: s.object,
    papCode: s.pap,
    program: s.program,
    allotmentClass: s.cls,
    fundSource: s.fund,
    amount: roundTo(s.amount * scale, 1000),
    allotted: 0,
    released: 0,
    level: "Agency",
    gaaReference: `GAA FY ${fy}`,
    gaaPart: "State Universities and Colleges (SUCs)",
    effectivityDate: `${fy}-01-01`,
    expiryDate: `${fy}-12-31`,
    remarks: "",
    documents: [],
    status: "Unreleased",
    createdAt: new Date(Date.UTC(fy, 0, 5)).toISOString(),
  }));

  const allotments: Allotment[] = ALLOTMENT_SEEDS.map((s, i) => {
    const amount = roundTo(s.amount * scale, 1000);
    const app = appropriations[s.app];
    const date = spreadDate(fy, i, ALLOTMENT_SEEDS.length);
    const partial = s.status === "Partial";
    const tranche: TrancheType = partial ? "1st Tranche" : /2nd Tranche/.test(s.purpose) ? "2nd Tranche" : i % 3 === 0 ? "1st Tranche" : "Full Release";
    const releaseAmount = partial ? roundTo(amount * 0.6, 1000) : amount;
    const { workflow, status, release } = seedWorkflow(s.status, date, `REL-${fy}-${pad(i + 1)}`);
    return {
      id: `alt-${fy}-${pad(i + 1)}`,
      allotmentNo: `ALT-${fy}-${pad(i + 1)}`,
      fiscalYear: fy,
      date,
      appropriationRef: app.referenceNo,
      appropriationTitle: app.title,
      orgCode: app.orgCode,
      office: app.office,
      program: app.program,
      uacsCode: app.uacsCode,
      objectOfExpenditure: app.objectOfExpenditure,
      allotmentClass: s.cls,
      fundSource: app.fundSource,
      amount,
      tranche,
      releaseAmount,
      releaseDate: date.slice(0, 10),
      released: status === "Released" || status === "Partial" ? releaseAmount : 0,
      obligated: 0,
      purpose: s.purpose,
      documents: [
        { id: `doc-alt-${fy}-${i}-1`, name: "Allotment_Worksheet.xlsx", size: 1_258_291, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", uploadedAt: date, uploadedBy: "Juan Dela Cruz" },
        { id: `doc-alt-${fy}-${i}-2`, name: "DBM_Notice_allotment.pdf", size: 2_516_582, mimeType: "application/pdf", uploadedAt: date, uploadedBy: "Juan Dela Cruz" },
      ],
      status,
      workflow,
      release,
      workflowType: "standard",
      department: s.allottee,
      responsibilityCenter: app.program,
    };
  });

  // Distribute each class's obligation total across that class's seed rows.
  const obligations: Obligation[] = [];
  const byClass = new Map<AllotmentClassCode, number[]>();
  OBLIGATION_SEEDS.forEach((s, i) => byClass.set(s.cls, [...(byClass.get(s.cls) ?? []), i]));
  const amounts: number[] = [];
  byClass.forEach((indexes, cls) => {
    const total = roundTo(CLASS_OBLIGATION_TOTALS[cls] * scale, 1000);
    const free = indexes.filter((i) => !FIXED_AMOUNTS[i]);
    let allocated = 0;
    indexes
      .filter((i) => FIXED_AMOUNTS[i])
      .forEach((i) => {
        amounts[i] = roundTo(FIXED_AMOUNTS[i] * scale, 1000);
        allocated += amounts[i];
      });
    const pool = total - allocated;
    const weightSum = free.reduce((sum, i) => sum + WEIGHTS[i % WEIGHTS.length], 0);
    free.forEach((i, n) => {
      amounts[i] =
        n === free.length - 1 ? total - allocated : roundTo((WEIGHTS[i % WEIGHTS.length] / weightSum) * pool, 1000);
      allocated += amounts[i];
    });
  });

  // Charge each obligation to the allotment of its class with the most room left,
  // preferring allotments issued on or before the obligation date.
  const remaining = new Map(allotments.map((a) => [a.allotmentNo, a.amount]));
  OBLIGATION_SEEDS.forEach((s, i) => {
    const status = obligationStatusFor(i, OBLIGATION_SEEDS.length);
    const amount = amounts[i];
    const date = spreadDate(fy, i, OBLIGATION_SEEDS.length);
    const byRoom = (a: Allotment, b: Allotment) => remaining.get(b.allotmentNo)! - remaining.get(a.allotmentNo)!;
    const candidates = allotments
      .filter((a) => a.allotmentClass === s.cls && (a.status === "Released" || a.status === "Partial"))
      .sort(byRoom);
    const allotment =
      candidates.find((a) => a.date <= date && remaining.get(a.allotmentNo)! >= amount) ??
      candidates.find((a) => remaining.get(a.allotmentNo)! >= amount) ??
      candidates[0];
    remaining.set(allotment.allotmentNo, remaining.get(allotment.allotmentNo)! - amount);
    const uacsCode = appropriations.find((a) => a.referenceNo === allotment.appropriationRef)!.uacsCode;
    obligations.push({
      id: `obl-${fy}-${pad(i + 49)}`,
      referenceNo: `OBL-${fy}-${pad(i + 49)}`,
      fiscalYear: fy,
      date,
      allotmentRef: allotment.allotmentNo,
      allotmentClass: s.cls,
      tranche: allotment.tranche,
      fundSource: allotment.fundSource,
      responsibilityCenter: allotment.program,
      payee: s.payee,
      tin: "",
      address: "",
      particulars: s.particulars,
      uacsCode,
      lineItems: [{ id: "li-1", uacsCode, description: s.particulars, quantity: 1, unit: "lot", unitCost: amount, amount }],
      amount,
      appNo: "",
      prNo: "",
      poNo: "",
      modeOfProcurement: "",
      projectActivity: "",
      remarks: "",
      applicableDocuments: ["Approved Allotment"],
      documents: [],
      disbursed: roundTo(amount * DISBURSED_RATIO[status], 1000),
      status,
      workflow: seedObligationWorkflow(status, date),
    });
  });

  // Two extra records that do not count toward totals: a draft and a cancelled request.
  const extras: { status: ObligationStatus; payee: string; particulars: string; amount: number }[] = [
    { status: "Draft", payee: "ABC Office Supplies Inc.", particulars: "Procurement of office supplies for general administration use", amount: 103_000 },
    { status: "Cancelled", payee: "Prima Marketing", particulars: "Training materials (duplicate request)", amount: 450_000 },
  ];
  extras.forEach((x, n) => {
    const allotment = allotments.find((a) => a.status === "Released" && a.allotmentClass === "RAOMO")!;
    const uacsCode = appropriations.find((a) => a.referenceNo === allotment.appropriationRef)!.uacsCode;
    const date = new Date(Date.UTC(fy, 9, 20 + n)).toISOString();
    const ref = `OBL-${fy}-${pad(OBLIGATION_SEEDS.length + 49 + n)}`;
    obligations.push({
      ...obligations[0],
      id: ref.toLowerCase(),
      referenceNo: ref,
      date,
      allotmentRef: allotment.allotmentNo,
      allotmentClass: allotment.allotmentClass,
      tranche: allotment.tranche,
      fundSource: allotment.fundSource,
      responsibilityCenter: allotment.program,
      payee: x.payee,
      particulars: x.particulars,
      uacsCode,
      lineItems: [{ id: "li-1", uacsCode, description: x.particulars, quantity: 1, unit: "lot", unitCost: x.amount, amount: x.amount }],
      amount: x.amount,
      disbursed: 0,
      status: x.status,
      workflow: seedObligationWorkflow(x.status, date),
    });
  });

  return recomputeLinks({ appropriations, allotments, obligations });
}

/**
 * Recalculates running totals from child records. Appropriation status in the
 * mock is derived from releases: none → Unreleased, partial → Active, full → Released.
 */
export function recomputeLinks(seed: BudgetSeed): BudgetSeed {
  const counts = (a: Allotment) => a.status !== "Draft" && a.status !== "Rejected";
  for (const app of seed.appropriations) {
    const linked = seed.allotments.filter((a) => a.appropriationRef === app.referenceNo && counts(a));
    app.allotted = linked.reduce((sum, a) => sum + a.amount, 0);
    app.released = linked.reduce((sum, a) => sum + a.released, 0);
    if (app.status !== "Draft") {
      app.status = app.released <= 0 ? "Unreleased" : app.released >= app.amount ? "Released" : "Active";
    }
  }
  for (const allotment of seed.allotments) {
    allotment.obligated = seed.obligations
      .filter((o) => o.allotmentRef === allotment.allotmentNo && o.status !== "Cancelled" && o.status !== "Draft")
      .reduce((sum, o) => sum + o.amount, 0);
  }
  return seed;
}
