import { api } from "@/store/services/api";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { AllotmentClassRegistry } from "../types";

export const allotmentClassesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllotmentClassRegistry: build.query<AllotmentClassRegistry, { code: AllotmentClassCode; fiscalYear: number }>({
      query: ({ code, fiscalYear }) => ({ url: ENDPOINTS.allotmentClasses.registry(code), params: { fiscalYear } }),
      providesTags: (_r, _e, { code }) => [{ type: "AllotmentClass", id: code }],
    }),
  }),
});

export const { useGetAllotmentClassRegistryQuery } = allotmentClassesApi;
