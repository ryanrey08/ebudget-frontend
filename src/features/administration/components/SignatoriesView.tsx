"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ResourceManager, formToInput, type FieldDef, type ResourceConfig } from "@/components/backend/ResourceManager";
import { useGetUsersQuery } from "@/features/access/services/accessApi";
import { formatDate } from "@/lib/utils/format";
import { useGetSignatoryQuery, useCreateSignatoryMutation, useDeleteSignatoryMutation, useGetSignatoriesQuery, useUpdateSignatoryMutation } from "../services/administrationApi";
import type { Signatory, SignatoryQuery } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = <T,>(hook: T) => hook as any;

export function SignatoriesView() {
  const users = useGetUsersQuery({ per_page: 100 });
  const config = useMemo<ResourceConfig<Signatory, SignatoryQuery>>(() => {
    const userOptions = (users.data?.items ?? []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));
    const fields: FieldDef[] = [
      { name: "user_id", label: "User", type: "select", required: true, options: userOptions, wide: true, hint: "An active eBudget user." },
      { name: "position", label: "Position", type: "text", required: true, max: 100, wide: true, placeholder: "e.g. Budget Officer" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ];
    return {
      title: "Signatories",
      description: "Users linked to the positions they sign under. Approval steps and reports print them.",
      singular: "signatory",
      permissions: { view: "signatories.view", manage: "signatories.manage" },
      useList: useGetSignatoriesQuery,
      useCreate: loose(useCreateSignatoryMutation),
      useUpdate: loose(useUpdateSignatoryMutation),
      useDelete: loose(useDeleteSignatoryMutation),
      useGet: useGetSignatoryQuery,
      columns: [
        { key: "position", header: "Position", cell: (s) => <span className="font-medium">{s.position}</span> },
        { key: "user", header: "User", cell: (s) => s.user.name },
        { key: "updated", header: "Updated", hideBelow: "md", cell: (s) => formatDate(s.updated_at) },
        { key: "status", header: "Status", align: "center", cell: (s) => <StatusBadge status={s.is_active ? "Active" : "Inactive"} /> },
      ],
      fields,
      toForm: (s) => ({ user_id: s.user.id, position: s.position, is_active: s.is_active }),
      toInput: (values, mode, original) =>
        formToInput(fields, values, mode, original ? { user_id: original.user.id, position: original.position, is_active: original.is_active } : undefined),
      buildQuery: ({ page, per_page, active, filter }) => ({
        page,
        per_page,
        is_active: active === "" ? undefined : (Number(active) as 0 | 1),
        user_id: filter || undefined,
      }),
      activeFilter: true,
      extraFilter: { label: "User", options: userOptions },
      rowLabel: (s) => `${s.position} (${s.user.name})`,
    };
  }, [users.data]);
  return <ResourceManager config={config} />;
}
