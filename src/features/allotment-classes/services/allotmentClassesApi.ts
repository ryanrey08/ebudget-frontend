import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { allotmentClassesService } from "@/services/allotments.service";
import type { AllotmentClassCode } from "@/lib/constants/allotment-classes";
import type { AllotmentClassRegistry } from "../types";

export const allotmentClassesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllotmentClassRegistry: build.query<AllotmentClassRegistry, { code: AllotmentClassCode; fiscalYear: number }>({
      queryFn: (arg) => fromService(() => allotmentClassesService.getRegistry(arg)),
      providesTags: (_r, _e, { code }) => [{ type: "AllotmentClass", id: code }],
    }),
  }),
});

export const { useGetAllotmentClassRegistryQuery } = allotmentClassesApi;
