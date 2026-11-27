"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage, isApiError } from "@/lib/api/error-handler";
import { formatNumber } from "@/lib/utils/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useSubmitGaaImportMutation } from "../../services/appropriationLinesApi";
import { configChanged, importErrorsReceived, importQueued, selectGaaWizard, stepChanged, type GaaWizardState } from "../../state/gaaWizardSlice";
import { APPROPRIATION_LEVELS, type AppropriationLevel, type GaaImportInput } from "../../types/lines";

const CONFIG_FIELDS = ["level", "legal_reference", "title", "effectivity_date", "expiry_date", "source_name", "lines"];

export function GaaConfigureStep() {
  const dispatch = useAppDispatch();
  const notify = useNotify();
  const { report, cells, excluded, config, fileName } = useAppSelector(selectGaaWizard);
  const [submit, { isLoading }] = useSubmitGaaImportMutation();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  if (!report) return null;

  const excludedSet = new Set(excluded);
  const lines = report.lines.filter((l) => !excludedSet.has(l.row)).map((l) => ({ row: l.row, cells: cells[l.row] ?? l.cells }));

  const run = async () => {
    const local: Record<string, string> = {};
    if (config.expiry_date && !config.effectivity_date) local.effectivity_date = "Needed when an expiry date is set.";
    if (config.expiry_date && config.effectivity_date && config.expiry_date < config.effectivity_date) local.expiry_date = "Must be on or after the effectivity date.";
    if (Object.keys(local).length) return setErrors(local);
    setErrors({});
    setGeneral("");
    const input: GaaImportInput = {
      level: config.level,
      legal_reference: config.legal_reference.trim() || null,
      title: config.title.trim() || null,
      effectivity_date: config.effectivity_date || null,
      expiry_date: config.expiry_date || null,
      source_name: fileName,
      lines,
    };
    try {
      const queued = await submit(input).unwrap();
      dispatch(importQueued(queued.id));
      notify("info", "Import queued", `${formatNumber(lines.length)} lines`);
    } catch (err) {
      if (isApiError(err) && err.status === 422 && err.fieldErrors) {
        // Keys are lines.{position}.cells.{field}, position in the order sent.
        const perRow: GaaWizardState["importErrors"] = {};
        const top: Record<string, string> = {};
        for (const [key, message] of Object.entries(err.fieldErrors)) {
          const m = /^lines\.(\d+)(?:\.cells\.([a-z_]+)|\.(row|cells))?/.exec(key);
          if (m) {
            const row = lines[Number(m[1])]?.row;
            if (row !== undefined) perRow[row] = { ...perRow[row], [m[2] ?? "row"]: message };
          } else if (CONFIG_FIELDS.includes(key)) top[key] = message;
          else top[key] = message;
        }
        if (Object.keys(perRow).length) {
          dispatch(importErrorsReceived(perRow));
          notify("error", "Some lines can't be imported", `${Object.keys(perRow).length} row(s) need corrections. Nothing was saved.`);
          return;
        }
        setErrors(top);
        setGeneral(top.lines ?? getErrorMessage(err));
      } else setGeneral(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Import settings" description={`These apply to all ${formatNumber(lines.length)} lines being imported. The import saves every line or none.`} />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {general && (
            <div className="md:col-span-2 xl:col-span-3">
              <FormAlert>{general}</FormAlert>
            </div>
          )}
          <FormField label="Level" htmlFor="gaa-level" error={errors.level} required>
            <Select id="gaa-level" value={config.level} onChange={(e) => dispatch(configChanged({ level: e.target.value as AppropriationLevel }))} options={APPROPRIATION_LEVELS} />
          </FormField>
          <FormField label="Legal reference" htmlFor="gaa-legal" error={errors.legal_reference} hint="e.g. R.A. No. 12116. Lines are unique per law.">
            <Input id="gaa-legal" maxLength={255} value={config.legal_reference} onChange={(e) => dispatch(configChanged({ legal_reference: e.target.value }))} />
          </FormField>
          <FormField label="Title" htmlFor="gaa-title" error={errors.title}>
            <Input id="gaa-title" maxLength={255} value={config.title} onChange={(e) => dispatch(configChanged({ title: e.target.value }))} placeholder="e.g. GAA FY 2026" />
          </FormField>
          <FormField label="Effectivity date" htmlFor="gaa-eff" error={errors.effectivity_date} hint="Empty: each line starts on its fiscal year's start date.">
            <Input id="gaa-eff" type="date" value={config.effectivity_date} onChange={(e) => dispatch(configChanged({ effectivity_date: e.target.value }))} />
          </FormField>
          <FormField label="Expiry date" htmlFor="gaa-exp" error={errors.expiry_date} hint="Empty: the lines are open-ended.">
            <Input id="gaa-exp" type="date" value={config.expiry_date} onChange={(e) => dispatch(configChanged({ expiry_date: e.target.value }))} />
          </FormField>
          <FormField label="Source file" htmlFor="gaa-source">
            <Input id="gaa-source" value={fileName ?? ""} disabled />
          </FormField>
        </CardBody>
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => dispatch(stepChanged("validate"))} disabled={isLoading}>
          Back to rows
        </Button>
        <Button onClick={run} loading={isLoading} disabled={!lines.length}>
          Import {formatNumber(lines.length)} lines
        </Button>
      </div>
    </div>
  );
}
