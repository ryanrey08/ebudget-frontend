/**
 * System administration: the agency profile and signatories
 * (AgencyProfileResource, SignatoryResource).
 */
import type { BackendPageQuery, IsoDateTime, Ulid, UserRef } from "@/types/backend";

export interface AgencyProfile {
  department_code: string;
  agency_code: string;
  agency_name: string;
  acronym: string;
  address: string;
  head_of_agency: string;
  /** Needs the token: fetch through the data proxy, show as a blob URL. Null without a logo. */
  logo_url: string | null;
  updated_at: IsoDateTime;
}

export type AgencyProfileInput = Partial<Omit<AgencyProfile, "logo_url" | "updated_at">>;

export const AGENCY_PROFILE_LIMITS: Record<keyof AgencyProfileInput, number> = {
  department_code: 20,
  agency_code: 20,
  agency_name: 255,
  acronym: 30,
  address: 500,
  head_of_agency: 150,
};

export interface Signatory {
  id: Ulid;
  user: UserRef;
  position: string;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface SignatoryQuery extends BackendPageQuery {
  user_id?: Ulid;
  is_active?: 0 | 1;
}

export interface SignatoryInput {
  user_id?: Ulid;
  position?: string;
  is_active?: boolean;
}
