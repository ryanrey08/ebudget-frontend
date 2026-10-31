"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, RefreshCw, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { FormAlert } from "@/components/forms/FormAlert";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { FISCAL_YEARS } from "@/config/site";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { GAA_FIELDS, autoMap, defaultImportSettings, emptyMapping, missingRequired, rowStatus } from "../../gaa/fields";
import { useGetGaaColumnsQuery, useGetGaaRowsQuery, useImportGaaMutation } from "../../services/gaaApi";
import {
  mappingChanged,
  selectGaaWizard,
  settingsChanged,
  stepChanged,
} from "../../state/gaaWizardSlice";
import type { GaaFieldKey, GaaImportSettings, GaaMapping, GaaRow, GaaSourceColumn, GaaUploadBatch } from "../../types";

export function MapConfigureStep({ batch }: { batch: GaaUploadBatch }) {
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const wizard = useAppSelector(selectGaaWizard);
  const columns = useGetGaaColumnsQuery(batch.id);
  const rows = useGetGaaRowsQuery(batch.id);
  const [focusField, setFocusField] = useState<GaaFieldKey>("uacsObjectCode");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importGaa, { isLoading: importing, error: importError, reset }] = useImportGaaMutation();

  // Auto map on first visit; keep any mapping the user already adjusted.
  useEffect(() => {
    if (!wizard.mapping && columns.data) dispatch(mappingChanged(autoMap(columns.data)));
    if (!wizard.settings) dispatch(settingsChanged(defaultImportSettings(batch.fiscalYear)));
  }, [wizard.mapping, wizard.settings, columns.data, batch.fiscalYear, dispatch]);

  const mapping = wizard.mapping ?? emptyMapping();
  const settings = wizard.settings ?? defaultImportSettings(batch.fiscalYear);
  const missing = missingRequired(mapping);

  const setColumnField = (column: string, field: GaaFieldKey | "") => {
    const next: GaaMapping = { ...mapping };
    (Object.keys(next) as GaaFieldKey[]).forEach((k) => {
      if (next[k] === column) next[k] = "";
    });
    if (field) {
      next[field] = column;
      setFocusField(field);
    }
    dispatch(mappingChanged(next));
  };

  const updateSettings = (patch: Partial<GaaImportSettings>) => dispatch(settingsChanged({ ...settings, ...patch }));

  const importable = rows.data?.filter((r) => rowStatus(r) !== "error").length ?? 0;
  const failing = (rows.data?.length ?? 0) - importable;

  const onImport = async () => {
    try {
      const result = await importGaa({ id: batch.id, mapping, settings }).unwrap();
      notify("success", "Import completed", `${formatNumber(result.importedCount)} records imported to FY ${settings.fiscalYear}.`);
      setConfirmOpen(false);
      dispatch(stepChanged("import"));
    } catch {
      // shown in the dialog
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Column Mapping</h2>
              <p className="text-sm text-gray-500">Match the columns from your Excel file to the required eBudget fields.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => columns.data && dispatch(mappingChanged(autoMap(columns.data)))}>
                <RefreshCw className="size-4" /> Auto Map
              </Button>
              <Button onClick={() => dispatch(mappingChanged(emptyMapping()))}>
                <RotateCcw className="size-4" /> Reset Mapping
              </Button>
            </div>
          </div>
          <div className="px-5 py-4">
            {missing.length === 0 ? (
              <FormAlert tone="success">All required fields are mapped. You may proceed to import.</FormAlert>
            ) : (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Map the required fields: {missing.map((f) => f.label).join(", ")}.
              </div>
            )}
          </div>
          <MappingTable
            columns={columns.data}
            loading={columns.isLoading}
            mapping={mapping}
            focusField={focusField}
            onChange={setColumnField}
            onFocusField={setFocusField}
          />
        </Card>

        <div className="space-y-5">
          <ImportSettingsCard settings={settings} onChange={updateSettings} />
          <FieldInfoCard field={focusField} />
        </div>
      </div>

      <MappedPreview rows={rows.data} loading={rows.isLoading} mapping={mapping} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" size="lg" onClick={() => dispatch(stepChanged("validate"))}>
          <ChevronLeft className="size-4" /> Back to Validation
        </Button>
        <Button
          size="lg"
          disabled={missing.length > 0 || importable === 0}
          onClick={() => {
            reset();
            setConfirmOpen(true);
          }}
        >
          <ChevronRight className="size-4" /> Proceed to Import
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Import GAA data"
        description={batch.fileName}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={onImport} loading={importing}>
              Confirm import
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-gray-700">
          {importError && <FormAlert>{getErrorMessage(importError)}</FormAlert>}
          <p>
            <strong>{formatNumber(importable)}</strong> rows will be processed into FY {settings.fiscalYear} appropriations
            ({settings.importType === "create" ? "create new" : "update existing"}).
          </p>
          {failing > 0 && (
            <p className={settings.skipRowsWithErrors ? "text-amber-700" : "text-red-600"}>
              {formatNumber(failing)} rows have errors and{" "}
              {settings.skipRowsWithErrors ? "will be skipped." : "must be fixed first, or enable “Skip rows with errors”."}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MappingTable({
  columns,
  loading,
  mapping,
  focusField,
  onChange,
  onFocusField,
}: {
  columns?: GaaSourceColumn[];
  loading: boolean;
  mapping: GaaMapping;
  focusField: GaaFieldKey;
  onChange: (column: string, field: GaaFieldKey | "") => void;
  onFocusField: (field: GaaFieldKey) => void;
}) {
  const fieldFor = (column: string) => (Object.keys(mapping) as GaaFieldKey[]).find((k) => mapping[k] === column) ?? "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Column mapping</caption>
        <thead>
          <tr className="bg-gray-50 text-left text-gray-700">
            <th scope="col" className="px-3 py-3 pl-5 font-semibold">Excel Column (From File)</th>
            <th scope="col" className="px-3 py-3 font-semibold">Sample Data</th>
            <th scope="col" className="px-3 py-3 font-semibold">Map to eBudget Field</th>
            <th scope="col" className="px-3 py-3 font-semibold">Data Type</th>
            <th scope="col" className="px-3 py-3 pr-5 text-center font-semibold">Required</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading &&
            Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>
                <td colSpan={5} className="px-5 py-3">
                  <Skeleton className="h-6 w-full" />
                </td>
              </tr>
            ))}
          {columns?.map((col) => {
            const fieldKey = fieldFor(col.key);
            const field = GAA_FIELDS.find((f) => f.key === fieldKey);
            return (
              <tr key={col.key} className={cn(fieldKey && fieldKey === focusField && "bg-blue-50/50")}>
                <td className="px-3 py-2 pl-5">
                  <span className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-red-50 text-xs font-bold text-brand-600">
                      {col.key}
                    </span>
                    <span className="text-gray-800">{col.header}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{col.sample || "-"}</td>
                <td className="px-3 py-2">
                  <Select
                    aria-label={`Map column ${col.key} (${col.header})`}
                    value={fieldKey}
                    placeholder="— Do not import —"
                    onChange={(e) => onChange(col.key, e.target.value as GaaFieldKey | "")}
                    onFocus={() => fieldKey && onFocusField(fieldKey)}
                    options={GAA_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
                    className="h-9 min-w-48"
                  />
                </td>
                <td className="px-3 py-2 text-gray-500">{field?.dataType ?? "—"}</td>
                <td className="px-3 py-2 pr-5 text-center">
                  {field?.required ? (
                    <CheckCircle2 className="inline size-5 fill-brand-600 text-white" aria-label="Required" />
                  ) : (
                    <CheckCircle2 className="inline size-5 fill-gray-300 text-white" aria-label="Optional" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ImportSettingsCard({
  settings,
  onChange,
}: {
  settings: GaaImportSettings;
  onChange: (patch: Partial<GaaImportSettings>) => void;
}) {
  const row = "grid items-center gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]";
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Settings className="size-5" aria-hidden /> Import Settings
      </h2>
      <div className="mt-4 space-y-4 text-sm">
        <div className={row}>
          <label htmlFor="import-fy" className="text-gray-700">
            Fiscal Year <span className="text-brand-600">*</span>
          </label>
          <Select
            id="import-fy"
            value={String(settings.fiscalYear)}
            onChange={(e) => onChange({ fiscalYear: Number(e.target.value) })}
            options={FISCAL_YEARS.map((fy) => ({ value: String(fy), label: String(fy) }))}
          />
        </div>
        <fieldset className={row}>
          <legend className="sr-only">Import type</legend>
          <span className="self-start text-gray-700" aria-hidden>
            Import Type <span className="text-brand-600">*</span>
          </span>
          <div className="space-y-2">
            {[
              { value: "create", label: "Create New Appropriations" },
              { value: "update", label: "Update Existing Appropriations" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="importType"
                  value={opt.value}
                  checked={settings.importType === opt.value}
                  onChange={() => onChange({ importType: opt.value as GaaImportSettings["importType"] })}
                  className="size-4 accent-brand-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className={row}>
          <label htmlFor="data-sheet" className="text-gray-700">
            Data Sheet <span className="text-brand-600">*</span>
          </label>
          <Select
            id="data-sheet"
            value={settings.dataSheet}
            onChange={(e) => onChange({ dataSheet: e.target.value })}
            options={[{ value: "GAA Upload", label: "GAA Upload" }]}
          />
        </div>
        <div className={row}>
          <label htmlFor="first-row" className="text-gray-700">
            First Data Row
          </label>
          <Input
            id="first-row"
            type="number"
            min={1}
            value={settings.firstDataRow}
            onChange={(e) => onChange({ firstDataRow: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={settings.skipRowsWithErrors}
            onChange={(e) => onChange({ skipRowsWithErrors: e.target.checked })}
            className="size-4 accent-brand-600"
          />
          Skip rows with errors
        </label>
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={settings.updateExisting}
            onChange={(e) => onChange({ updateExisting: e.target.checked })}
            className="size-4 accent-brand-600"
          />
          Update existing records if Org Code and UACS Code match
        </label>
      </div>
    </Card>
  );
}

function FieldInfoCard({ field: key }: { field: GaaFieldKey }) {
  const field = GAA_FIELDS.find((f) => f.key === key)!;
  const items: [string, React.ReactNode][] = [
    ["eBudget Field", <span key="v" className="block rounded bg-gray-100 px-2 py-1">{field.label}</span>],
    ["Description", field.description],
    ["Data Type", field.dataType],
    [
      "Required",
      field.required ? (
        <span key="v" className="rounded bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">Yes</span>
      ) : (
        <span key="v" className="rounded bg-gray-200 px-3 py-0.5 text-xs font-semibold text-gray-700">No</span>
      ),
    ],
    ["Valid Values", field.validValues],
    ["Example", field.example],
  ];
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Info className="size-5 fill-gray-900 text-white" aria-hidden /> Field Information
      </h2>
      <dl className="mt-4 space-y-3 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            <dt className="text-gray-600">{label}</dt>
            <dd className="text-gray-800">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-gray-500">Select a column&apos;s field to see its details.</p>
    </Card>
  );
}

function MappedPreview({ rows, loading, mapping }: { rows?: GaaRow[]; loading: boolean; mapping: GaaMapping }) {
  const paging = useClientPagination(rows, 5);
  const shown = useMemo(() => GAA_FIELDS.filter((f) => f.key !== "fiscalYear"), []);
  const columns: Column<GaaRow>[] = [
    { key: "row", header: "#", cell: (r) => r.rowNo },
    ...shown.map<Column<GaaRow>>((f) => ({
      key: f.key,
      header: f.label,
      align: f.key === "amount" ? "right" : "left",
      className: f.key === "description" ? "min-w-52" : "whitespace-nowrap",
      cell: (r) => {
        if (!mapping[f.key]) return <span className="text-gray-300">—</span>;
        const value = r[f.key];
        if (f.key === "amount") return <span className="tabular-nums">{formatCurrency(Number(value)).replace("₱", "")}</span>;
        return String(value || "-");
      },
    })),
  ];
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-lg font-semibold text-gray-900">Data Preview</h2>
        <p className="text-sm text-gray-500">This is a preview of your data after mapping. Please review before importing.</p>
      </div>
      <DataTable dense columns={columns} rows={paging.pageItems} rowKey={(r) => String(r.rowNo)} loading={loading} skeletonRows={5} caption="Mapped data preview" />
      {paging.total > 0 && (
        <div className="border-t border-gray-100">
          <Pagination
            page={paging.page}
            pageSize={paging.pageSize}
            total={paging.total}
            onPageChange={paging.setPage}
            pageSizeOptions={[5, 10, 25]}
            onPageSizeChange={paging.setPageSize}
          />
        </div>
      )}
    </Card>
  );
}
