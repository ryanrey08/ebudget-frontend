"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, ListChecks, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/shared/StatCard";
import { FormAlert } from "@/components/forms/FormAlert";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { pesos } from "@/types/backend";
import { cellEdited, rowExcluded, selectGaaWizard, stepChanged, wizardReset } from "../../state/gaaWizardSlice";
import { GAA_CELL_FIELDS, GAA_CELL_HEADINGS, type GaaCellField } from "../../types/lines";

type View = "issues" | "all";

export function GaaValidateStep() {
  const dispatch = useAppDispatch();
  const { report, cells, excluded, importErrors } = useAppSelector(selectGaaWizard);
  const [view, setView] = useState<View>("issues");

  /** Errors per row and field: the validation report's, replaced by the import's once it answered. */
  const errorsByRow = useMemo(() => {
    const out: Record<number, Partial<Record<string, string>>> = {};
    if (Object.keys(importErrors).length) return importErrors as Record<number, Partial<Record<string, string>>>;
    for (const e of report?.errors ?? []) out[e.row] = { ...out[e.row], [e.field]: e.message };
    return out;
  }, [report, importErrors]);

  if (!report) return null;
  const excludedSet = new Set(excluded);
  const withIssues = report.lines.filter((l) => errorsByRow[l.row] && Object.keys(errorsByRow[l.row]).length);
  const rows = view === "issues" ? withIssues : report.lines;
  const included = report.lines.length - excluded.length;
  const fromImport = Object.keys(importErrors).length > 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Rows" value={formatNumber(report.summary.rows)} caption="Data rows read" icon={FileSpreadsheet} iconTone="dark" />
        <StatCard label="Valid Rows" value={formatNumber(report.summary.valid_rows)} caption="When validated" icon={CheckCircle2} iconTone="green" />
        <StatCard label="Rows with Errors" value={formatNumber(report.summary.invalid_rows)} caption="When validated" icon={AlertTriangle} iconTone="red" />
        <StatCard label="Total Amount" value={formatCurrency(pesos(report.summary.total_amount))} caption="Of every parsed amount" icon={Wallet} iconTone="blue" />
      </div>

      {fromImport ? (
        <FormAlert>The import was refused: correct the highlighted cells (or leave rows out) and import again. Nothing was saved.</FormAlert>
      ) : report.valid ? (
        <FormAlert tone="success">Every row passed validation. Duplicates of lines already saved are checked when you import.</FormAlert>
      ) : (
        <FormAlert tone="info">
          Correct the highlighted cells below. Your corrections are checked again, with the same rules, when you import.
        </FormAlert>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
          <Tabs
            label="Rows to show"
            className="border-b-0"
            value={view}
            onChange={setView}
            items={[
              { value: "issues" as const, label: `Rows with errors (${withIssues.length})` },
              { value: "all" as const, label: `All rows (${report.lines.length})` },
            ]}
          />
          <p className="pb-2 text-sm text-gray-500">
            <ListChecks className="mr-1 inline size-4" aria-hidden />
            {included} of {report.lines.length} rows will be imported
          </p>
        </div>
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full min-w-[1400px] text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-700">
                <th className="px-3 py-2.5 font-semibold">Row</th>
                <th className="px-3 py-2.5 font-semibold">Import</th>
                {GAA_CELL_FIELDS.map((f) => (
                  <th key={f} className="px-2 py-2.5 font-semibold whitespace-nowrap">
                    <span className="text-gray-400">{GAA_CELL_HEADINGS[f].column}</span> {GAA_CELL_HEADINGS[f].heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.slice(0, 500).map((line) => {
                const rowErrors = errorsByRow[line.row] ?? {};
                const out = excludedSet.has(line.row);
                return (
                  <tr key={line.row} className={cn(out && "opacity-50")}>
                    <td className="px-3 py-2 align-top font-medium text-gray-900">{line.row}</td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        aria-label={`Import row ${line.row}`}
                        checked={!out}
                        onChange={(e) => dispatch(rowExcluded({ row: line.row, excluded: !e.target.checked }))}
                      />
                      {rowErrors.row && <p className="mt-1 w-40 text-xs text-red-600">{rowErrors.row}</p>}
                    </td>
                    {GAA_CELL_FIELDS.map((f) => (
                      <CellEditor key={f} row={line.row} field={f} value={cells[line.row]?.[f] ?? ""} error={rowErrors[f]} disabled={out} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-gray-500">No rows with errors.</p>}
          {rows.length > 500 && <p className="px-5 py-3 text-xs text-gray-500">Showing the first 500 rows.</p>}
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => dispatch(wizardReset())}>
          Upload another file
        </Button>
        <Button onClick={() => dispatch(stepChanged("map"))} disabled={included === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function CellEditor({ row, field, value, error, disabled }: { row: number; field: GaaCellField; value: string; error?: string; disabled?: boolean }) {
  const dispatch = useAppDispatch();
  const wide = field === "organization_name" || field === "uacs_object_description" || field === "program_name" || field === "remarks";
  return (
    <td className="px-2 py-1.5 align-top">
      <Input
        aria-label={`Row ${row} ${GAA_CELL_HEADINGS[field].heading}`}
        value={value ?? ""}
        disabled={disabled}
        invalid={!!error}
        onChange={(e) => dispatch(cellEdited({ row, field, value: e.target.value }))}
        className={cn("h-8 px-2 text-[13px]", wide ? "min-w-44" : "min-w-24")}
      />
      {error && <p className="mt-1 max-w-56 text-xs text-red-600">{error}</p>}
    </td>
  );
}
