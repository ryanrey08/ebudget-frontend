import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { agencyProfileService, signatoriesService } from "@/services/backend";
import type { Paginated } from "@/types/api";
import type { AgencyProfile, AgencyProfileInput, Signatory, SignatoryInput, SignatoryQuery } from "../types";

const SIGNATORIES = { type: "Signatory" as const, id: "LIST" };

export const administrationApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAgencyProfile: build.query<AgencyProfile, void>({
      queryFn: () => fromService(() => agencyProfileService.get()),
      providesTags: ["AgencyProfile"],
    }),
    updateAgencyProfile: build.mutation<AgencyProfile, AgencyProfileInput>({
      queryFn: (input) => fromService(() => agencyProfileService.update(input)),
      invalidatesTags: ["AgencyProfile"],
    }),
    uploadAgencyLogo: build.mutation<AgencyProfile, File>({
      queryFn: (file) => fromService(() => agencyProfileService.uploadLogo(file)),
      invalidatesTags: ["AgencyProfile"],
    }),
    removeAgencyLogo: build.mutation<AgencyProfile, void>({
      queryFn: () => fromService(() => agencyProfileService.removeLogo()),
      invalidatesTags: ["AgencyProfile"],
    }),

    getSignatories: build.query<Paginated<Signatory>, SignatoryQuery>({
      queryFn: (q) => fromService(() => signatoriesService.list(q)),
      providesTags: (result) => [SIGNATORIES, ...(result?.items.map((s) => ({ type: "Signatory" as const, id: s.id })) ?? [])],
    }),
    getSignatory: build.query<Signatory, string>({
      queryFn: (id) => fromService(() => signatoriesService.get(id)),
      providesTags: (_r, _e, id) => [{ type: "Signatory", id }],
    }),
    createSignatory: build.mutation<Signatory, SignatoryInput>({
      queryFn: (input) => fromService(() => signatoriesService.create(input)),
      invalidatesTags: [SIGNATORIES],
    }),
    updateSignatory: build.mutation<Signatory, { id: string; input: SignatoryInput }>({
      queryFn: ({ id, input }) => fromService(() => signatoriesService.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [SIGNATORIES, { type: "Signatory", id }, { type: "ApprovalWorkflow", id: "LIST" }],
    }),
    deleteSignatory: build.mutation<null, string>({
      queryFn: (id) => fromService(() => signatoriesService.remove(id)),
      invalidatesTags: [SIGNATORIES],
    }),
  }),
});

export const {
  useGetAgencyProfileQuery,
  useUpdateAgencyProfileMutation,
  useUploadAgencyLogoMutation,
  useRemoveAgencyLogoMutation,
  useGetSignatoriesQuery,
  useGetSignatoryQuery,
  useCreateSignatoryMutation,
  useUpdateSignatoryMutation,
  useDeleteSignatoryMutation,
} = administrationApi;
