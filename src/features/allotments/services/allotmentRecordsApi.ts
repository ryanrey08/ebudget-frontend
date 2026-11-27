import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { allotmentRecordsService } from "@/services/backend";
import type { Paginated } from "@/types/api";
import type {
  AllotmentAttachment,
  AllotmentRecord,
  AllotmentRecordQuery,
  CreateAllotmentInput,
  ReleaseInput,
  UpdateAllotmentInput,
} from "../types/records";

const LIST = { type: "AllotmentRecord" as const, id: "LIST" };
/** An allotment changes its line's allotted and unallotted amounts. */
const LINES = { type: "AppropriationLine" as const, id: "LIST" };
const affected = (id: string) => [LIST, LINES, { type: "AllotmentRecord" as const, id }];

/** RTK Query cache for the backend's allotments, tranches and documents. */
export const allotmentRecordsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAllotmentRecords: build.query<Paginated<AllotmentRecord>, AllotmentRecordQuery>({
      queryFn: (q) => fromService(() => allotmentRecordsService.list(q)),
      providesTags: (result) => [LIST, ...(result?.items.map((a) => ({ type: "AllotmentRecord" as const, id: a.id })) ?? [])],
    }),
    getAllotmentRecord: build.query<AllotmentRecord, string>({
      queryFn: (id) => fromService(() => allotmentRecordsService.get(id)),
      providesTags: (_r, _e, id) => [{ type: "AllotmentRecord", id }],
    }),
    createAllotmentRecord: build.mutation<AllotmentRecord, CreateAllotmentInput>({
      queryFn: (input) => fromService(() => allotmentRecordsService.create(input)),
      invalidatesTags: [LIST, LINES],
    }),
    updateAllotmentRecord: build.mutation<AllotmentRecord, { id: string; input: UpdateAllotmentInput }>({
      queryFn: ({ id, input }) => fromService(() => allotmentRecordsService.update(id, input)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    deleteAllotmentRecord: build.mutation<null, string>({
      queryFn: (id) => fromService(() => allotmentRecordsService.remove(id)),
      invalidatesTags: [LIST, LINES],
    }),
    cancelAllotmentRecord: build.mutation<AllotmentRecord, { id: string; reason: string }>({
      queryFn: ({ id, reason }) => fromService(() => allotmentRecordsService.cancel(id, reason)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    addAllotmentRelease: build.mutation<AllotmentRecord, { id: string; input: ReleaseInput }>({
      queryFn: ({ id, input }) => fromService(() => allotmentRecordsService.addRelease(id, input)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    updateAllotmentRelease: build.mutation<AllotmentRecord, { id: string; releaseId: string; input: ReleaseInput }>({
      queryFn: ({ id, releaseId, input }) => fromService(() => allotmentRecordsService.updateRelease(id, releaseId, input)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    deleteAllotmentRelease: build.mutation<null, { id: string; releaseId: string }>({
      queryFn: ({ id, releaseId }) => fromService(() => allotmentRecordsService.deleteRelease(id, releaseId)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    submitAllotmentRelease: build.mutation<AllotmentRecord, { id: string; releaseId: string; remarks?: string }>({
      queryFn: ({ id, releaseId, remarks }) => fromService(() => allotmentRecordsService.submitRelease(id, releaseId, remarks)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    cancelAllotmentRelease: build.mutation<AllotmentRecord, { id: string; releaseId: string; reason: string }>({
      queryFn: ({ id, releaseId, reason }) => fromService(() => allotmentRecordsService.cancelRelease(id, releaseId, reason)),
      invalidatesTags: (_r, _e, { id }) => affected(id),
    }),
    /** Answers with the attachment only, so the allotment is fetched again. */
    uploadAllotmentAttachment: build.mutation<AllotmentAttachment, { id: string; file: File }>({
      queryFn: ({ id, file }) => fromService(() => allotmentRecordsService.uploadAttachment(id, file)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "AllotmentRecord", id }],
    }),
    deleteAllotmentAttachment: build.mutation<null, { id: string; attachmentId: string }>({
      queryFn: ({ id, attachmentId }) => fromService(() => allotmentRecordsService.deleteAttachment(id, attachmentId)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "AllotmentRecord", id }],
    }),
  }),
});

export const {
  useGetAllotmentRecordsQuery,
  useGetAllotmentRecordQuery,
  useCreateAllotmentRecordMutation,
  useUpdateAllotmentRecordMutation,
  useDeleteAllotmentRecordMutation,
  useCancelAllotmentRecordMutation,
  useAddAllotmentReleaseMutation,
  useUpdateAllotmentReleaseMutation,
  useDeleteAllotmentReleaseMutation,
  useSubmitAllotmentReleaseMutation,
  useCancelAllotmentReleaseMutation,
  useUploadAllotmentAttachmentMutation,
  useDeleteAllotmentAttachmentMutation,
} = allotmentRecordsApi;
