import { BACKEND, backendPath } from "@/lib/api/endpoints";
import type { Paginated } from "@/types/api";
import type {
  AllotmentAttachment,
  AllotmentRecord,
  AllotmentRecordQuery,
  CreateAllotmentInput,
  ReleaseInput,
  UpdateAllotmentInput,
} from "@/features/allotments/types/records";
import { backend, compact } from "./http";

/**
 * Backend allotments. Release calls answer with the whole allotment, so
 * totals and the next tranche are always current; an attachment upload
 * answers with the attachment only.
 */
export const allotmentRecordsService = {
  list: (query: AllotmentRecordQuery) => backend.get<Paginated<AllotmentRecord>>(BACKEND.allotments, compact(query)),
  get: (id: string) => backend.get<AllotmentRecord>(BACKEND.allotment(id)),
  /** A draft allotment with its 1st tranche (draft). */
  create: (input: CreateAllotmentInput) => backend.post<AllotmentRecord>(BACKEND.allotments, input),
  update: (id: string, input: UpdateAllotmentInput) => backend.patch<AllotmentRecord>(BACKEND.allotment(id), input),
  /** Only a draft never submitted (409 allotment_submitted otherwise). */
  remove: (id: string) => backend.delete(BACKEND.allotment(id)),
  cancel: (id: string, reason: string) => backend.post<AllotmentRecord>(BACKEND.allotmentCancel(id), { reason }),

  addRelease: (id: string, input: ReleaseInput) => backend.post<AllotmentRecord>(BACKEND.allotmentReleases(id), input),
  updateRelease: (id: string, releaseId: string, input: ReleaseInput) =>
    backend.patch<AllotmentRecord>(BACKEND.allotmentRelease(id, releaseId), input),
  deleteRelease: (id: string, releaseId: string) => backend.delete(BACKEND.allotmentRelease(id, releaseId)),
  /** 409 no_active_approval_workflow when the `allotment` module has no active workflow. */
  submitRelease: (id: string, releaseId: string, remarks?: string) =>
    backend.post<AllotmentRecord>(BACKEND.allotmentReleaseSubmit(id, releaseId), remarks ? { remarks } : {}),
  cancelRelease: (id: string, releaseId: string, reason: string) =>
    backend.post<AllotmentRecord>(BACKEND.allotmentReleaseCancel(id, releaseId), { reason }),

  /**
   * PDF, .xlsx, JPEG or PNG, ≤ 5 MB, up to 20 per allotment. 201 with the
   * attachment itself (AllotmentAttachmentResource), not the whole allotment
   * as docs/ebudget/allotments.md says; verified against the backend.
   */
  uploadAttachment: (id: string, file: File) => backend.upload<AllotmentAttachment>(BACKEND.allotmentAttachments(id), { file }),
  deleteAttachment: (id: string, attachmentId: string) => backend.delete(BACKEND.allotmentAttachment(id, attachmentId)),
  downloadAttachment: (attachment: AllotmentAttachment) => backend.download(backendPath(attachment.download_url), attachment.original_name),
};
