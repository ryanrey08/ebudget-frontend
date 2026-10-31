"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { FormAlert } from "@/components/forms/FormAlert";
import { useNotify } from "@/hooks/useNotify";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { getErrorMessage } from "@/lib/api/error-handler";
import { toOptions } from "@/lib/constants/options";
import { useGenerateReportMutation } from "../services/reportsApi";
import type { GeneratedReport, ReportDefinition } from "../types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function periodOptions(report: ReportDefinition, fiscalYear: number) {
  if (report.frequency === "Monthly") return MONTHS.map((m) => `${m} ${fiscalYear}`);
  if (report.frequency === "Quarterly") return ["Q1", "Q2", "Q3", "Q4"].map((q) => `FY ${fiscalYear} ${q}`);
  return [`FY ${fiscalYear}`];
}

export function GenerateReportModal({ report, onClose }: { report: ReportDefinition | null; onClose: () => void }) {
  const fiscalYear = useFiscalYear();
  const notify = useNotify();
  const [generate, { isLoading, error, reset }] = useGenerateReportMutation();
  const [period, setPeriod] = useState("");
  const [format, setFormat] = useState<GeneratedReport["format"]>("PDF");

  useEffect(() => {
    if (report) {
      setPeriod(periodOptions(report, fiscalYear)[0]);
      setFormat("PDF");
      reset();
    }
  }, [report, fiscalYear, reset]);

  if (!report) return null;

  const onGenerate = async () => {
    try {
      await generate({ reportId: report.id, period, format }).unwrap();
      notify("success", "Report generated", `${report.name} · ${period}`);
      onClose();
    } catch {
      // shown inline
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Generate report"
      description={report.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onGenerate} loading={isLoading}>
            Generate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <FormAlert>{getErrorMessage(error)}</FormAlert>}
        <p className="text-sm text-gray-600">{report.description}</p>
        <FormField label="Reporting period" htmlFor="period" required>
          <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value)} options={toOptions(periodOptions(report, fiscalYear))} />
        </FormField>
        <FormField label="Format" htmlFor="format" required>
          <Select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as GeneratedReport["format"])}
            options={toOptions(["PDF", "XLSX", "CSV"])}
          />
        </FormField>
      </div>
    </Modal>
  );
}
