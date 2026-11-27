/**
 * Backend allotments: /allotments (AllotmentResource, AllotmentReleaseResource,
 * AllotmentAttachmentResource). One allotment per appropriation line, released
 * in tranches that each go through the `allotment` approval workflow. The older
 * types in ./index.ts belong to the demo RAO registries and obligations.
 */
import type { BackendPageQuery, IsoDate, IsoDateTime, PesoString, Ulid, UserRef } from "@/types/backend";
import type { FiscalYearStatus } from "@/features/master-data/types";
import type { AllotmentRegistryCode } from "@/features/master-data/types";

export type AllotmentRecordStatus = "draft" | "active" | "fully_released" | "cancelled";
export const ALLOTMENT_RECORD_STATUSES: { value: AllotmentRecordStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "fully_released", label: "Fully Released" },
  { value: "cancelled", label: "Cancelled" },
];

export type ReleaseStatus = "draft" | "pending" | "released" | "rejected" | "cancelled";
export type ReleaseKind = "tranche" | "full";

export interface ReleaseApprovalSummary {
  id: Ulid;
  status: "pending" | "approved" | "rejected";
  submitted_at: IsoDateTime;
  completed_at: IsoDateTime | null;
  current_step: { id: Ulid; sequence: number; name: string; user: UserRef } | null;
}

export interface AllotmentRelease {
  id: Ulid;
  allotment_id: Ulid;
  tranche_no: number;
  tranche_label: string;
  release_kind: ReleaseKind;
  release_kind_label: string;
  amount: PesoString;
  release_date: IsoDate;
  reference_no: string | null;
  status: ReleaseStatus;
  status_label: string;
  is_final: boolean;
  released_at: IsoDateTime | null;
  cancel_reason: string | null;
  cancelled_at: IsoDateTime | null;
  /** Only on GET /allotments/{id}; null for a tranche never submitted. */
  approval?: ReleaseApprovalSummary | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AllotmentAttachment {
  id: Ulid;
  allotment_id: Ulid;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: Ulid;
  /** Absolute backend URL; download it through the data proxy (needs the token). */
  download_url: string;
  created_at: IsoDateTime;
}

export interface AllotmentRecord {
  id: Ulid;
  /** ALT-2026-001 */
  allotment_no: string;
  status: AllotmentRecordStatus;
  status_label: string;
  fiscal_year_id: Ulid;
  fiscal_year?: { id: Ulid; year: number; name: string; status: FiscalYearStatus };
  appropriation_id: number;
  appropriation?: {
    id: number;
    appropriation_no: string;
    title: string | null;
    amount: PesoString;
    effectivity_date: IsoDate;
    expiry_date: IsoDate | null;
    organization: { id: number; code: string; name: string } | null;
    prexc_item: { id: number; code: string; description: string } | null;
    uacs_object: { id: number; code: string; description: string } | null;
    fund_source: { id: number; code: string; description: string } | null;
    allotment_class: {
      id: number;
      code: string;
      description: string;
      registry_code: AllotmentRegistryCode;
      registry_label: string;
    } | null;
  };
  amount: PesoString;
  released_amount?: PesoString;
  pending_amount?: PesoString;
  unreleased_amount?: PesoString;
  next_tranche_no?: number | null;
  next_tranche_label?: string | null;
  purpose: string;
  cancel_reason: string | null;
  cancelled_at: IsoDateTime | null;
  created_by?: UserRef;
  releases?: AllotmentRelease[];
  attachments?: AllotmentAttachment[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AllotmentRecordQuery extends BackendPageQuery {
  fiscal_year_id?: Ulid;
  appropriation_id?: number;
  organization_id?: number;
  status?: AllotmentRecordStatus;
  search?: string;
}

export interface ReleaseInput {
  release_kind?: ReleaseKind;
  /** Required for a tranche; leave out for a full release. */
  amount?: PesoString;
  release_date?: IsoDate;
  reference_no?: string | null;
}

export interface CreateAllotmentInput {
  appropriation_id: number;
  amount: PesoString;
  purpose: string;
  release: ReleaseInput & { release_kind: ReleaseKind; release_date: IsoDate };
}

export interface UpdateAllotmentInput {
  amount?: PesoString;
  purpose?: string;
}
