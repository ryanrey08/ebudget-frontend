import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { appropriationLinesService } from "@/services/backend";
import type { Paginated } from "@/types/api";
import type {
  AppropriationLine,
  AppropriationLineInput,
  AppropriationLineQuery,
  GaaImport,
  GaaImportInput,
  GaaValidationReport,
} from "../types/lines";

const LIST = { type: "AppropriationLine" as const, id: "LIST" };

/** RTK Query cache for the backend's appropriation lines and GAA import. */
export const appropriationLinesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAppropriationLines: build.query<Paginated<AppropriationLine>, AppropriationLineQuery>({
      queryFn: (q) => fromService(() => appropriationLinesService.list(q)),
      providesTags: (result) => [LIST, ...(result?.items.map((l) => ({ type: "AppropriationLine" as const, id: String(l.id) })) ?? [])],
    }),
    getAppropriationLine: build.query<AppropriationLine, number>({
      queryFn: (id) => fromService(() => appropriationLinesService.get(id)),
      providesTags: (_r, _e, id) => [{ type: "AppropriationLine", id: String(id) }],
    }),
    createAppropriationLine: build.mutation<AppropriationLine, AppropriationLineInput>({
      queryFn: (input) => fromService(() => appropriationLinesService.create(input)),
      invalidatesTags: [LIST],
    }),
    updateAppropriationLine: build.mutation<AppropriationLine, { id: number; input: AppropriationLineInput }>({
      queryFn: ({ id, input }) => fromService(() => appropriationLinesService.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => [LIST, { type: "AppropriationLine", id: String(id) }, { type: "AllotmentRecord", id: "LIST" }],
    }),
    deleteAppropriationLine: build.mutation<null, number>({
      queryFn: (id) => fromService(() => appropriationLinesService.remove(id)),
      invalidatesTags: [LIST],
    }),
    validateGaaUpload: build.mutation<GaaValidationReport, File>({
      queryFn: (file) => fromService(() => appropriationLinesService.validateUpload(file)),
    }),
    submitGaaImport: build.mutation<GaaImport, GaaImportInput>({
      queryFn: (input) => fromService(() => appropriationLinesService.submitImport(input)),
    }),
    /** Polled while queued/processing; invalidates the lines once it completes. */
    getGaaImport: build.query<GaaImport, string>({
      queryFn: (id) => fromService(() => appropriationLinesService.getImport(id)),
      providesTags: (_r, _e, id) => [{ type: "GaaImport", id }],
      keepUnusedDataFor: 0,
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.status === "completed") dispatch(api.util.invalidateTags([LIST]));
        } catch {
          /* shown by the page */
        }
      },
    }),
  }),
});

export const {
  useGetAppropriationLinesQuery,
  useGetAppropriationLineQuery,
  useCreateAppropriationLineMutation,
  useUpdateAppropriationLineMutation,
  useDeleteAppropriationLineMutation,
  useValidateGaaUploadMutation,
  useSubmitGaaImportMutation,
  useGetGaaImportQuery,
} = appropriationLinesApi;
