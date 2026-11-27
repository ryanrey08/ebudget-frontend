import { BACKEND } from "@/lib/api/endpoints";
import type { Paginated } from "@/types/api";
import type {
  AllotmentClassInput,
  AllotmentClassQuery,
  AllotmentClassRecord,
  CodeListQuery,
  FiscalYearInput,
  FiscalYearQuery,
  FiscalYearRecord,
  FiscalYearTransition,
  FundSource,
  FundSourceInput,
  Organization,
  OrganizationInput,
  PrexcItem,
  PrexcItemInput,
  PrexcItemQuery,
  UacsObject,
  UacsObjectInput,
} from "@/features/master-data/types";
import { backend, compact } from "./http";

/** Generic CRUD for one master-data resource. */
function crud<T, Q extends object, I, Id extends string | number>(list: string, item: (id: Id) => string) {
  return {
    list: (query: Q) => backend.get<Paginated<T>>(list, compact(query)),
    get: (id: Id) => backend.get<T>(item(id)),
    create: (input: I) => backend.post<T>(list, input),
    update: (id: Id, input: I) => backend.patch<T>(item(id), input),
    remove: (id: Id) => backend.delete(item(id)),
  };
}

/** eBudget master data (backend routes/ebudget.php, prefix /master-data). */
export const masterDataService = {
  fiscalYears: {
    ...crud<FiscalYearRecord, FiscalYearQuery, FiscalYearInput, string>(BACKEND.fiscalYears, BACKEND.fiscalYear),
    /** open → closed, closed → open, closed → locked (cannot be undone). */
    transition: (id: string, action: FiscalYearTransition) => backend.post<FiscalYearRecord>(BACKEND.fiscalYearTransition(id, action)),
  },
  prexcItems: crud<PrexcItem, PrexcItemQuery, PrexcItemInput, number>(BACKEND.prexcItems, BACKEND.prexcItem),
  fundSources: crud<FundSource, CodeListQuery, FundSourceInput, number>(BACKEND.fundSources, BACKEND.fundSource),
  organizations: crud<Organization, CodeListQuery, OrganizationInput, number>(BACKEND.organizations, BACKEND.organization),
  allotmentClasses: crud<AllotmentClassRecord, AllotmentClassQuery, AllotmentClassInput, number>(BACKEND.allotmentClasses, BACKEND.allotmentClass),
  uacsObjects: crud<UacsObject, CodeListQuery, UacsObjectInput, number>(BACKEND.uacsObjects, BACKEND.uacsObject),
};

export type MasterDataService = typeof masterDataService;
