"use client";

import { useState } from "react";
import { Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { FormAlert } from "@/components/forms/FormAlert";
import { isBackendData } from "@/config/api.config";
import { useCan } from "@/hooks/useCan";
import { useNotify } from "@/hooks/useNotify";
import { getErrorMessage } from "@/lib/api/error-handler";
import { formatDateTime } from "@/lib/utils/format";
import { useGetReportDatasetsQuery, useGetReportSharesQuery, useShareReportDatasetMutation, useUnshareReportDatasetMutation } from "../services/accessApi";

const SYSTEMS = [
  { value: "engas", label: "eNGAS" },
  { value: "sims", label: "SIMS" },
];

/**
 * Cross-system report datasets (GET /reports/datasets, reports.view) and
 * eBudget's shares with eNGAS and SIMS (/reports/shares, reports.share).
 */
export function ReportSharingCard() {
  const canView = useCan("reports.view");
  const canShare = useCan("reports.share");
  if (!isBackendData() || (!canView && !canShare)) return null;
  return (
    <Card className="mt-5">
      <CardHeader title="Report datasets" description="Datasets eBudget can read (its own and those other systems share with it), and what eBudget shares." />
      <CardBody className="grid gap-6 lg:grid-cols-2">
        {canView && <Datasets />}
        {canShare && <Shares />}
      </CardBody>
    </Card>
  );
}

function Datasets() {
  const q = useGetReportDatasetsQuery();
  if (q.error) return <FormAlert>{getErrorMessage(q.error)}</FormAlert>;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900">Readable datasets</p>
      {q.data?.length ? (
        <ul className="space-y-2 text-sm">
          {q.data.map((d) => (
            <li key={d.key} className="rounded-lg border border-gray-200 px-3 py-2">
              <span className="font-mono text-xs text-gray-900">{d.key}</span> {d.shared_with_you && <Badge tone="blue">from {d.source.name}</Badge>}
              <p className="text-xs text-gray-500">{d.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{q.isLoading ? "Loading…" : "No datasets yet."}</p>
      )}
    </div>
  );
}

function Shares() {
  const notify = useNotify();
  const q = useGetReportSharesQuery();
  const [share, { isLoading }] = useShareReportDatasetMutation();
  const [unshare] = useUnshareReportDatasetMutation();
  const [dataset, setDataset] = useState("");
  const [system, setSystem] = useState("engas");

  const add = async () => {
    if (!dataset) return;
    try {
      await share({ dataset, system }).unwrap();
      notify("success", "Dataset shared", `${dataset} → ${system}`);
    } catch (err) {
      notify("error", "Unable to share", getErrorMessage(err));
    }
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900">Shared by eBudget</p>
      {q.error ? <FormAlert>{getErrorMessage(q.error)}</FormAlert> : null}
      <ul className="mb-3 space-y-2 text-sm">
        {q.data?.shares.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="font-mono text-xs">{s.dataset}</span> → {s.system.name}
              <span className="block text-xs text-gray-500">{formatDateTime(s.created_at)}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Stop sharing ${s.dataset} with ${s.system.name}`}
              onClick={() => unshare(s.id).unwrap().then(() => notify("success", "Sharing stopped"), (err) => notify("error", "Unable to stop sharing", getErrorMessage(err)))}
            >
              <Trash2 className="size-4 text-red-600" />
            </Button>
          </li>
        ))}
        {q.data && !q.data.shares.length && <li className="text-gray-500">Nothing shared.</li>}
      </ul>
      {q.data && q.data.datasets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="min-w-40 flex-1">
            <Select aria-label="Dataset" value={dataset} onChange={(e) => setDataset(e.target.value)} placeholder="Dataset…" options={q.data.datasets.map((d) => ({ value: d, label: d }))} />
          </div>
          <div className="w-32">
            <Select aria-label="System" value={system} onChange={(e) => setSystem(e.target.value)} options={SYSTEMS} />
          </div>
          <Button variant="outline" onClick={add} loading={isLoading} disabled={!dataset}>
            <Share2 className="size-4" /> Share
          </Button>
        </div>
      )}
    </div>
  );
}
