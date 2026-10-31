import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { Column } from "@/components/tables/DataTable";
import { AllotmentClassBadge } from "@/components/shared/AllotmentClassBadge";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { rowStatus } from "../../gaa/fields";
import type { GaaRow } from "../../types";

const dash = (v: string) => v || "—";

/** Columns shared by the GAA preview, validation and result tables. */
export const gaaDataColumns: Column<GaaRow>[] = [
  { key: "row", header: "#", cell: (r) => r.rowNo },
  { key: "org", header: "Org Code", cell: (r) => <span className="whitespace-nowrap">{dash(r.orgCode)}</span>, hideBelow: "xl" },
  { key: "office", header: "Organization/Office", cell: (r) => dash(r.office), hideBelow: "wide", className: "whitespace-nowrap" },
  { key: "uacs", header: "UACS Code", cell: (r) => <span className="tabular-nums">{dash(r.uacsObjectCode)}</span> },
  { key: "desc", header: "Description", cell: (r) => dash(r.description), className: "min-w-64" },
  {
    key: "amount",
    header: "Appropriation",
    align: "right",
    cell: (r) => (
      <span className="whitespace-nowrap tabular-nums">
        {Number.isFinite(r.amount) ? formatNumber(r.amount) + (Number.isInteger(r.amount) ? ".00" : "") : "—"}
      </span>
    ),
  },
  { key: "fund", header: "Fund Source", cell: (r) => dash(r.fundSource), hideBelow: "md" },
  { key: "class", header: "Allotment Class", cell: (r) => <AllotmentClassBadge code={r.allotmentClass} /> },
  { key: "program", header: "Program/Activity", cell: (r) => dash(r.program), hideBelow: "xl", className: "whitespace-nowrap" },
];

export function GaaStatusIcon({ row }: { row: GaaRow }) {
  const status = rowStatus(row);
  if (status === "error") return <XCircle className="size-5 fill-red-600 text-white" aria-label="Error" />;
  if (status === "warning") return <AlertTriangle className="size-5 fill-amber-400 text-white" aria-label="Warning" />;
  return <CheckCircle2 className="size-5 fill-green-600 text-white" aria-label="Valid" />;
}

export function gaaRemarks(row: GaaRow) {
  const status = rowStatus(row);
  if (status === "valid") return <span className="text-gray-400">-</span>;
  return (
    <span className={status === "error" ? "text-xs font-medium text-red-600" : "text-xs font-medium text-amber-700"}>
      {[...row.errors, ...row.warnings].join("; ")}
    </span>
  );
}

export const pesoCell = (amount: number) => (
  <span className="whitespace-nowrap tabular-nums">{Number.isFinite(amount) ? formatCurrency(amount) : "—"}</span>
);
