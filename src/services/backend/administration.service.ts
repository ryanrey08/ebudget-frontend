import { BACKEND, backendPath } from "@/lib/api/endpoints";
import type { Paginated } from "@/types/api";
import type { AgencyProfile, AgencyProfileInput, Signatory, SignatoryInput, SignatoryQuery } from "@/features/administration/types";
import { backend, compact } from "./http";

export const agencyProfileService = {
  get: () => backend.get<AgencyProfile>(BACKEND.agencyProfile),
  update: (input: AgencyProfileInput) => backend.patch<AgencyProfile>(BACKEND.agencyProfile, input),
  /** PNG, JPEG or WebP, ≤ 2 MB and 4000 × 4000 px. */
  uploadLogo: (logo: File) => backend.upload<AgencyProfile>(BACKEND.agencyLogo, { logo }),
  removeLogo: () => backend.delete<AgencyProfile>(BACKEND.agencyLogo),
  /** The logo image (needs the token, so it is shown through a blob URL). */
  logo: (logoUrl: string) => backend.download(backendPath(logoUrl), "logo"),
};

export const signatoriesService = {
  list: (query: SignatoryQuery) => backend.get<Paginated<Signatory>>(BACKEND.signatories, compact(query)),
  get: (id: string) => backend.get<Signatory>(BACKEND.signatory(id)),
  create: (input: SignatoryInput) => backend.post<Signatory>(BACKEND.signatories, input),
  update: (id: string, input: SignatoryInput) => backend.patch<Signatory>(BACKEND.signatory(id), input),
  /** 409 signatory_in_use when an approval step names it. */
  remove: (id: string) => backend.delete(BACKEND.signatory(id)),
};
