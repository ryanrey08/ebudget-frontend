"use client";

import { ClipboardCheck, Clock3, Database, FileText } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { formatCurrency, formatPercent, safeRatio } from "@/lib/utils/format";
import type { DashboardSummary } from "../types";

export function SummaryCards({ summary, loading }: { summary?: DashboardSummary; loading: boolean }) {
  const s = summary;
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <StatCard
        label="Total Appropriations"
        value={formatCurrency(s?.totalAppropriations ?? 0)}
        caption={`FY ${s?.fiscalYear ?? ""} GAA`}
        icon={Database}
        iconTone="red"
        loading={loading}
      />
      <StatCard
        label="Total Allotments"
        value={formatCurrency(s?.totalAllotments ?? 0)}
        caption={`${formatPercent(safeRatio(s?.totalAllotments ?? 0, s?.totalAppropriations ?? 0))} of Appropriations`}
        icon={FileText}
        iconTone="dark"
        progress={{ value: safeRatio(s?.totalAllotments ?? 0, s?.totalAppropriations ?? 0), tone: "blue" }}
        loading={loading}
      />
      <StatCard
        label="Total Obligations"
        value={formatCurrency(s?.totalObligations ?? 0)}
        caption={`${formatPercent(safeRatio(s?.totalObligations ?? 0, s?.totalAllotments ?? 0))} of Allotments`}
        icon={ClipboardCheck}
        iconTone="red"
        progress={{ value: safeRatio(s?.totalObligations ?? 0, s?.totalAllotments ?? 0), tone: "green" }}
        loading={loading}
      />
      <StatCard
        label="Available Balance"
        value={formatCurrency(s?.availableBalance ?? 0)}
        caption={`${formatPercent(safeRatio(s?.availableBalance ?? 0, s?.totalAllotments ?? 0))} of Allotments`}
        icon={Clock3}
        iconTone="dark"
        progress={{ value: safeRatio(s?.availableBalance ?? 0, s?.totalAllotments ?? 0), tone: "amber" }}
        loading={loading}
      />
    </div>
  );
}
