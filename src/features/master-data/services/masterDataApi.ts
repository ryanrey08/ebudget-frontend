import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { masterDataService } from "@/services/backend";
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
} from "../types";

type Tag = "FiscalYear" | "PrexcItem" | "FundSource" | "Organization" | "BackendAllotmentClass" | "UacsObject";
const listTags = <T extends { id: string | number }>(type: Tag) => (result: Paginated<T> | undefined) => [
  { type, id: "LIST" as const },
  ...(result?.items.map((r) => ({ type, id: String(r.id) })) ?? []),
];

/** Appropriation lines show master-data codes, so edits refresh them too. */
const LINES = { type: "AppropriationLine" as const, id: "LIST" };

/** RTK Query cache for the backend's master data (src/services/backend/master-data.service.ts). */
export const masterDataApi = api.injectEndpoints({
  endpoints: (build) => ({
    /* Fiscal years */
    /** GET one record: edit forms load the latest copy before editing. */
    getFiscalYear: build.query<FiscalYearRecord, string>({
      queryFn: (id) => fromService(() => masterDataService.fiscalYears.get(id)),
      providesTags: (_r, _e, id) => [{ type: "FiscalYear", id: String(id) }],
    }),
    getFiscalYears: build.query<Paginated<FiscalYearRecord>, FiscalYearQuery>({
      queryFn: (q) => fromService(() => masterDataService.fiscalYears.list(q)),
      providesTags: listTags("FiscalYear"),
    }),
    createFiscalYear: build.mutation<FiscalYearRecord, FiscalYearInput>({
      queryFn: (input) => fromService(() => masterDataService.fiscalYears.create(input)),
      invalidatesTags: [{ type: "FiscalYear", id: "LIST" }],
    }),
    updateFiscalYear: build.mutation<FiscalYearRecord, { id: string; input: FiscalYearInput }>({
      queryFn: ({ id, input }) => fromService(() => masterDataService.fiscalYears.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "FiscalYear", id: "LIST" }, { type: "FiscalYear", id }, LINES],
    }),
    deleteFiscalYear: build.mutation<null, string>({
      queryFn: (id) => fromService(() => masterDataService.fiscalYears.remove(id)),
      invalidatesTags: [{ type: "FiscalYear", id: "LIST" }],
    }),
    transitionFiscalYear: build.mutation<FiscalYearRecord, { id: string; action: FiscalYearTransition }>({
      queryFn: ({ id, action }) => fromService(() => masterDataService.fiscalYears.transition(id, action)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "FiscalYear", id: "LIST" }, { type: "FiscalYear", id }, LINES, { type: "AllotmentRecord", id: "LIST" }],
    }),

    /* PREXC items */
    /** GET one record: edit forms load the latest copy before editing. */
    getPrexcItem: build.query<PrexcItem, number>({
      queryFn: (id) => fromService(() => masterDataService.prexcItems.get(id)),
      providesTags: (_r, _e, id) => [{ type: "PrexcItem", id: String(id) }],
    }),
    getPrexcItems: build.query<Paginated<PrexcItem>, PrexcItemQuery>({
      queryFn: (q) => fromService(() => masterDataService.prexcItems.list(q)),
      providesTags: listTags("PrexcItem"),
    }),
    createPrexcItem: build.mutation<PrexcItem, PrexcItemInput>({
      queryFn: (input) => fromService(() => masterDataService.prexcItems.create(input)),
      invalidatesTags: [{ type: "PrexcItem", id: "LIST" }],
    }),
    updatePrexcItem: build.mutation<PrexcItem, { id: number; input: PrexcItemInput }>({
      queryFn: ({ id, input }) => fromService(() => masterDataService.prexcItems.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "PrexcItem", id: "LIST" }, { type: "PrexcItem", id: String(id) }, LINES],
    }),
    deletePrexcItem: build.mutation<null, number>({
      queryFn: (id) => fromService(() => masterDataService.prexcItems.remove(id)),
      invalidatesTags: [{ type: "PrexcItem", id: "LIST" }],
    }),

    /* Fund sources */
    /** GET one record: edit forms load the latest copy before editing. */
    getFundSource: build.query<FundSource, number>({
      queryFn: (id) => fromService(() => masterDataService.fundSources.get(id)),
      providesTags: (_r, _e, id) => [{ type: "FundSource", id: String(id) }],
    }),
    getFundSources: build.query<Paginated<FundSource>, CodeListQuery>({
      queryFn: (q) => fromService(() => masterDataService.fundSources.list(q)),
      providesTags: listTags("FundSource"),
    }),
    createFundSource: build.mutation<FundSource, FundSourceInput>({
      queryFn: (input) => fromService(() => masterDataService.fundSources.create(input)),
      invalidatesTags: [{ type: "FundSource", id: "LIST" }],
    }),
    updateFundSource: build.mutation<FundSource, { id: number; input: FundSourceInput }>({
      queryFn: ({ id, input }) => fromService(() => masterDataService.fundSources.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "FundSource", id: "LIST" }, { type: "FundSource", id: String(id) }, LINES],
    }),
    deleteFundSource: build.mutation<null, number>({
      queryFn: (id) => fromService(() => masterDataService.fundSources.remove(id)),
      invalidatesTags: [{ type: "FundSource", id: "LIST" }],
    }),

    /* Organizations */
    /** GET one record: edit forms load the latest copy before editing. */
    getOrganization: build.query<Organization, number>({
      queryFn: (id) => fromService(() => masterDataService.organizations.get(id)),
      providesTags: (_r, _e, id) => [{ type: "Organization", id: String(id) }],
    }),
    getOrganizations: build.query<Paginated<Organization>, CodeListQuery>({
      queryFn: (q) => fromService(() => masterDataService.organizations.list(q)),
      providesTags: listTags("Organization"),
    }),
    createOrganization: build.mutation<Organization, OrganizationInput>({
      queryFn: (input) => fromService(() => masterDataService.organizations.create(input)),
      invalidatesTags: [{ type: "Organization", id: "LIST" }],
    }),
    updateOrganization: build.mutation<Organization, { id: number; input: OrganizationInput }>({
      queryFn: ({ id, input }) => fromService(() => masterDataService.organizations.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Organization", id: "LIST" }, { type: "Organization", id: String(id) }, LINES],
    }),
    deleteOrganization: build.mutation<null, number>({
      queryFn: (id) => fromService(() => masterDataService.organizations.remove(id)),
      invalidatesTags: [{ type: "Organization", id: "LIST" }],
    }),

    /* Allotment classes */
    /** GET one record: edit forms load the latest copy before editing. */
    getAllotmentClassRecord: build.query<AllotmentClassRecord, number>({
      queryFn: (id) => fromService(() => masterDataService.allotmentClasses.get(id)),
      providesTags: (_r, _e, id) => [{ type: "BackendAllotmentClass", id: String(id) }],
    }),
    getAllotmentClassRecords: build.query<Paginated<AllotmentClassRecord>, AllotmentClassQuery>({
      queryFn: (q) => fromService(() => masterDataService.allotmentClasses.list(q)),
      providesTags: listTags("BackendAllotmentClass"),
    }),
    createAllotmentClassRecord: build.mutation<AllotmentClassRecord, AllotmentClassInput>({
      queryFn: (input) => fromService(() => masterDataService.allotmentClasses.create(input)),
      invalidatesTags: [{ type: "BackendAllotmentClass", id: "LIST" }],
    }),
    updateAllotmentClassRecord: build.mutation<AllotmentClassRecord, { id: number; input: AllotmentClassInput }>({
      queryFn: ({ id, input }) => fromService(() => masterDataService.allotmentClasses.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "BackendAllotmentClass", id: "LIST" }, { type: "BackendAllotmentClass", id: String(id) }, LINES],
    }),
    deleteAllotmentClassRecord: build.mutation<null, number>({
      queryFn: (id) => fromService(() => masterDataService.allotmentClasses.remove(id)),
      invalidatesTags: [{ type: "BackendAllotmentClass", id: "LIST" }],
    }),

    /* UACS objects */
    /** GET one record: edit forms load the latest copy before editing. */
    getUacsObject: build.query<UacsObject, number>({
      queryFn: (id) => fromService(() => masterDataService.uacsObjects.get(id)),
      providesTags: (_r, _e, id) => [{ type: "UacsObject", id: String(id) }],
    }),
    getUacsObjects: build.query<Paginated<UacsObject>, CodeListQuery>({
      queryFn: (q) => fromService(() => masterDataService.uacsObjects.list(q)),
      providesTags: listTags("UacsObject"),
    }),
    createUacsObject: build.mutation<UacsObject, UacsObjectInput>({
      queryFn: (input) => fromService(() => masterDataService.uacsObjects.create(input)),
      invalidatesTags: [{ type: "UacsObject", id: "LIST" }],
    }),
    updateUacsObject: build.mutation<UacsObject, { id: number; input: UacsObjectInput }>({
      queryFn: ({ id, input }) => fromService(() => masterDataService.uacsObjects.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "UacsObject", id: "LIST" }, { type: "UacsObject", id: String(id) }, LINES],
    }),
    deleteUacsObject: build.mutation<null, number>({
      queryFn: (id) => fromService(() => masterDataService.uacsObjects.remove(id)),
      invalidatesTags: [{ type: "UacsObject", id: "LIST" }],
    }),
  }),
});

export const {
  useGetFiscalYearsQuery,
  useCreateFiscalYearMutation,
  useUpdateFiscalYearMutation,
  useDeleteFiscalYearMutation,
  useTransitionFiscalYearMutation,
  useGetPrexcItemsQuery,
  useCreatePrexcItemMutation,
  useUpdatePrexcItemMutation,
  useDeletePrexcItemMutation,
  useGetFundSourcesQuery,
  useCreateFundSourceMutation,
  useUpdateFundSourceMutation,
  useDeleteFundSourceMutation,
  useGetOrganizationsQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
  useGetAllotmentClassRecordsQuery,
  useCreateAllotmentClassRecordMutation,
  useUpdateAllotmentClassRecordMutation,
  useDeleteAllotmentClassRecordMutation,
  useGetUacsObjectsQuery,
  useCreateUacsObjectMutation,
  useUpdateUacsObjectMutation,
  useDeleteUacsObjectMutation,
  useGetFiscalYearQuery,
  useGetPrexcItemQuery,
  useGetFundSourceQuery,
  useGetOrganizationQuery,
  useGetAllotmentClassRecordQuery,
  useGetUacsObjectQuery,
} = masterDataApi;
