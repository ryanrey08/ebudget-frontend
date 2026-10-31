"use client";

import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ROUTES } from "@/lib/constants/routes";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useFiscalYear } from "@/hooks/useFiscalYear";
import { useGetRecentTransactionsQuery } from "../services/dashboardApi";
import type { Transaction } from "../types";

const columns: Column<Transaction>[] = [
  { key: "date", header: "Date", cell: (t) => <span className="whitespace-nowrap">{formatDate(t.date)}</span> },
  { key: "ref", header: "Reference No.", cell: (t) => <span className="whitespace-nowrap">{t.referenceNo}</span> },
  { key: "type", header: "Transaction Type", cell: (t) => t.type, hideBelow: "md" },
  { key: "desc", header: "Description", cell: (t) => t.description, hideBelow: "lg" },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (t) => <span className="whitespace-nowrap tabular-nums">{formatCurrency(t.amount)}</span>,
  },
  { key: "status", header: "Status", align: "center", cell: (t) => <StatusBadge status={t.status} /> },
];

export function RecentTransactionsCard() {
  const fiscalYear = useFiscalYear();
  const { data, isLoading, isFetching, error, refetch } = useGetRecentTransactionsQuery({ fiscalYear, limit: 6 });
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Recent Transactions"
        className="pb-4"
        action={
          <Link href={ROUTES.obligationManagement} className="text-sm font-medium text-blue-600 hover:underline">
            View All
          </Link>
        }
      />
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(t) => t.id}
        loading={isLoading || isFetching}
        error={error}
        onRetry={refetch}
        caption="Recent transactions"
        skeletonRows={6}
        dense
      />
    </Card>
  );
}
