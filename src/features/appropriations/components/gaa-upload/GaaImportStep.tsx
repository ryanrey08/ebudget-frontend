"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormAlert } from "@/components/forms/FormAlert";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/utils/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { pesos } from "@/types/backend";
import { useGetGaaImportQuery } from "../../services/appropriationLinesApi";
import { importErrorsReceived, selectGaaWizard, wizardReset, type GaaWizardState } from "../../state/gaaWizardSlice";

const POLL_MS = 2000;
const running = (s?: string) => s === "queued" || s === "processing";

export function GaaImportStep() {
  const dispatch = useAppDispatch();
  const { importId, report, excluded } = useAppSelector(selectGaaWizard);
  const [polling, setPolling] = useState(true);
  const query = useGetGaaImportQuery(importId ?? "", { skip: !importId, pollingInterval: polling ? POLL_MS : 0, skipPollingIfUnfocused: false });
  const imp = query.data;
  // Stop polling once the job finished.
  useEffect(() => {
    if (imp && !running(imp.status)) setPolling(false);
  }, [imp]);
  if (query.error && !imp) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const finished = imp && !running(imp.status);
  const Icon = !imp || running(imp.status) ? Loader2 : imp.status === "completed" ? CheckCircle2 : XCircle;

  const fixAndRetry = () => {
    if (!imp?.errors || !report) return;
    // Errors carry `line`: the position in the lines that were sent.
    const sent = report.lines.filter((l) => !excluded.includes(l.row));
    const perRow: GaaWizardState["importErrors"] = {};
    for (const e of imp.errors) {
      const row = sent[e.line]?.row ?? e.row;
      perRow[row] = { ...perRow[row], [e.field]: e.message };
    }
    dispatch(importErrorsReceived(perRow));
  };

  return (
    <Card>
      <CardHeader
        title={imp ? `Import ${imp.status_label.toLowerCase()}` : "Starting the import…"}
        description={imp?.source_name ?? undefined}
        action={imp ? <StatusBadge status={imp.status_label} /> : undefined}
      />
      <CardBody className="space-y-5">
        <div className="flex items-center gap-3">
          <Icon className={`size-8 ${!imp || running(imp.status) ? "animate-spin text-gray-400" : imp.status === "completed" ? "text-green-600" : "text-red-600"}`} aria-hidden />
          <p className="text-sm text-gray-700">
            {!imp || imp.status === "queued"
              ? "Waiting for a worker. This page checks every few seconds."
              : imp.status === "processing"
                ? "Checking the lines again and saving them in one transaction…"
                : imp.status === "completed"
                  ? `Every line was saved: ${formatNumber(imp.imported_count ?? 0)} appropriation lines created.`
                  : (imp.failure_message ?? "Nothing was saved.")}
          </p>
        </div>

        {imp && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Fact label="Rows" value={imp.row_count === null ? "—" : formatNumber(imp.row_count)} />
            <Fact label="Imported" value={imp.imported_count === null ? "—" : formatNumber(imp.imported_count)} />
            <Fact label="Total amount" value={imp.total_amount === null ? "—" : formatCurrency(pesos(imp.total_amount))} />
            <Fact label="Level / Reference" value={`${imp.level_label}${imp.legal_reference ? ` · ${imp.legal_reference}` : ""}`} />
            <Fact label="Queued" value={formatDateTime(imp.created_at)} icon={<Clock className="size-3.5" />} />
            {imp.finished_at && <Fact label="Finished" value={formatDateTime(imp.finished_at)} />}
          </dl>
        )}

        {imp?.status === "failed" && imp.errors && imp.errors.length > 0 && (
          <div>
            <FormAlert>
              {formatNumber(imp.error_count ?? imp.errors.length)} problem(s) found
              {imp.error_count && imp.error_count > imp.errors.length ? ` (first ${imp.errors.length} shown)` : ""}. Master data or saved lines changed since you submitted.
            </FormAlert>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {imp.errors.map((e, i) => (
                <li key={i} className="text-gray-700">
                  <span className="font-medium">
                    Row {e.row}, {e.heading}:
                  </span>{" "}
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {finished && (
          <div className="flex flex-wrap justify-end gap-2">
            {imp.status === "failed" && imp.errors?.length ? (
              <Button variant="outline" onClick={fixAndRetry}>
                Correct the rows
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => dispatch(wizardReset())}>
              Upload another file
            </Button>
            {imp.status === "completed" && (
              <Link href={ROUTES.appropriations} className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                View appropriations
              </Link>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2">
      <dt className="flex items-center gap-1 text-xs text-gray-500">
        {icon}
        {label}
      </dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}
