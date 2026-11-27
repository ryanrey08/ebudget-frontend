"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useGetAllotmentClassRecordsQuery,
  useGetFundSourcesQuery,
  useGetOrganizationsQuery,
  useGetPrexcItemsQuery,
  useGetUacsObjectsQuery,
} from "../services/masterDataApi";

export type LookupKind = "organization" | "prexc" | "uacs" | "fund" | "class";

interface Option {
  value: string;
  label: string;
}

/** Active records only (inactive ones can't be given to a line), searched on the server. */
function useLookupOptions(kind: LookupKind, search: string): { options: Option[]; loading: boolean; more: boolean } {
  const q = { per_page: 50, is_active: 1 as const, search: search || undefined };
  const org = useGetOrganizationsQuery(q, { skip: kind !== "organization" });
  const prexc = useGetPrexcItemsQuery({ ...q, is_parent_only: 0 }, { skip: kind !== "prexc" });
  const uacs = useGetUacsObjectsQuery(q, { skip: kind !== "uacs" });
  const fund = useGetFundSourcesQuery(q, { skip: kind !== "fund" });
  const cls = useGetAllotmentClassRecordsQuery(q, { skip: kind !== "class" });
  return useMemo(() => {
    const pick = { organization: org, prexc, uacs, fund, class: cls }[kind];
    const items = (pick.data?.items ?? []) as { id: number; code: string; name?: string; description?: string; registry_code?: string }[];
    return {
      options: items.map((i) => ({
        value: String(i.id),
        label: `${i.code} – ${i.name ?? i.description ?? ""}${i.registry_code ? ` (${i.registry_code})` : ""}`,
      })),
      loading: pick.isFetching,
      more: !!pick.data && pick.data.total > items.length,
    };
  }, [kind, org, prexc, uacs, fund, cls]);
}

/**
 * Select for a master-data reference, with a search box for long lists
 * (UACS objects, PREXC items). `current` keeps the saved value's label visible
 * when it isn't in the search results (e.g. it was deactivated since).
 */
export function LookupSelect({
  id,
  kind,
  value,
  onChange,
  invalid,
  placeholder = "Select…",
  current,
  disabled,
}: {
  id: string;
  kind: LookupKind;
  value: string;
  onChange: (value: string, label: string) => void;
  invalid?: boolean;
  placeholder?: string;
  current?: Option | null;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const search = useDebouncedValue(draft.trim(), 300);
  const { options, loading, more } = useLookupOptions(kind, search);
  const merged = current && value === current.value && !options.some((o) => o.value === current.value) ? [current, ...options] : options;
  const searchable = kind === "uacs" || kind === "prexc" || kind === "organization";

  return (
    <div className="space-y-1.5">
      {searchable && !disabled && (
        <Input
          type="search"
          aria-label="Search the list"
          placeholder="Type to search codes or names…"
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 text-xs"
        />
      )}
      <Select
        id={id}
        value={value}
        disabled={disabled}
        invalid={invalid}
        placeholder={loading && !merged.length ? "Loading…" : placeholder}
        options={merged}
        onChange={(e) => onChange(e.target.value, merged.find((o) => o.value === e.target.value)?.label ?? "")}
      />
      {more && <p className="text-xs text-gray-500">Showing the first 50 matches. Search to narrow the list.</p>}
    </div>
  );
}
