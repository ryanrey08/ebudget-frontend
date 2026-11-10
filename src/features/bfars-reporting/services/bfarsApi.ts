import { api } from "@/store/services/api";
import { fromService } from "@/lib/api/client";
import { bfarsService, type BfarsReportId, type GenerateBfarsRequest } from "@/services/bfars.service";
import type { GeneratedReport } from "@/features/reports/types";
import type { BfarsReportData, BfarsReportParams } from "../types";
import type { QproParams, QproReport } from "../qpro/types";
import type { SaaodbParams, SaaodbReport } from "../saaodb/types";
import type { SaaodboeParams, SaaodboeReport } from "../saaodboe/types";
import type { LasaParams, LasaReport } from "../lasa/types";
import type { SodlbiaftParams, SodlbiaftReport } from "../sodlbiaft/types";
import type { SabudbParams, SabudbReport } from "../sabudb/types";
import type { SabudboeParams, SabudboeReport } from "../sabudboe/types";
import type { AuoParams, AuoReport } from "../auo/types";
import type { MrdParams, MrdReport } from "../mrd/types";
import type { QrrorParams, QrrorReport } from "../qrror/types";
import type { SabudbtrParams, SabudbtrReport } from "../sabudbtr/types";

export const bfarsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getBfarsReport: build.query<BfarsReportData, BfarsReportParams>({
      queryFn: (params) => fromService(() => bfarsService.getReport(params)),
      providesTags: (_r, _e, { id }) => [{ type: "Bfars", id }],
    }),
  }),
});

export const { useGetBfarsReportQuery } = bfarsApi;

export const qproApi = api.injectEndpoints({
  endpoints: (build) => ({
    getQproReport: build.query<QproReport, QproParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS1(params)),
      providesTags: [{ type: "Bfars", id: "bfars-1" }],
    }),
  }),
});

export const { useGetQproReportQuery, useLazyGetQproReportQuery } = qproApi;

export const saaodbApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSaaodbReport: build.query<SaaodbReport, SaaodbParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS2(params)),
      providesTags: [{ type: "Bfars", id: "bfars-2" }],
    }),
  }),
});

export const { useGetSaaodbReportQuery } = saaodbApi;

export const saaodboeApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSaaodboeReport: build.query<SaaodboeReport, SaaodboeParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS3(params)),
      providesTags: [{ type: "Bfars", id: "bfars-3" }],
    }),
  }),
});

export const { useGetSaaodboeReportQuery } = saaodboeApi;

export const lasaApi = api.injectEndpoints({
  endpoints: (build) => ({
    getLasaReport: build.query<LasaReport, LasaParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS4(params)),
      providesTags: [{ type: "Bfars", id: "bfars-4" }],
    }),
  }),
});

export const { useGetLasaReportQuery } = lasaApi;

export const sodlbiaftApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSodlbiaftReport: build.query<SodlbiaftReport, SodlbiaftParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS5(params)),
      providesTags: [{ type: "Bfars", id: "bfars-5" }],
    }),
  }),
});

export const { useGetSodlbiaftReportQuery } = sodlbiaftApi;

export const sabudbApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSabudbReport: build.query<SabudbReport, SabudbParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS6(params)),
      providesTags: [{ type: "Bfars", id: "bfars-6" }],
    }),
  }),
});

export const { useGetSabudbReportQuery } = sabudbApi;

export const sabudboeApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSabudboeReport: build.query<SabudboeReport, SabudboeParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS7(params)),
      providesTags: [{ type: "Bfars", id: "bfars-7" }],
    }),
  }),
});

export const { useGetSabudboeReportQuery } = sabudboeApi;

export const auoApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAuoReport: build.query<AuoReport, AuoParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS8(params)),
      providesTags: [{ type: "Bfars", id: "bfars-8" }],
    }),
  }),
});

export const { useGetAuoReportQuery } = auoApi;

export const mrdApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMrdReport: build.query<MrdReport, MrdParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS9(params)),
      providesTags: [{ type: "Bfars", id: "bfars-9" }],
    }),
  }),
});

export const { useGetMrdReportQuery } = mrdApi;

export const qrrorApi = api.injectEndpoints({
  endpoints: (build) => ({
    getQrrorReport: build.query<QrrorReport, QrrorParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS10(params)),
      providesTags: [{ type: "Bfars", id: "bfars-10" }],
    }),
  }),
});

export const { useGetQrrorReportQuery } = qrrorApi;

export const sabudbtrApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSabudbtrReport: build.query<SabudbtrReport, SabudbtrParams>({
      queryFn: (params) => fromService(() => bfarsService.getBFARS11(params)),
      providesTags: [{ type: "Bfars", id: "bfars-11" }],
    }),
  }),
});

export const { useGetSabudbtrReportQuery } = sabudbtrApi;

/**
 * Report history for BFARS 1–11: generating a report records it (format,
 * parameters, period) so it shows under Reports › Recently Generated.
 */
export const bfarsGenerationApi = api.injectEndpoints({
  endpoints: (build) => ({
    generateBfarsReport: build.mutation<GeneratedReport, { id: BfarsReportId } & GenerateBfarsRequest>({
      queryFn: ({ id, ...payload }) => fromService(() => bfarsService.generate(id, payload)),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Report", id: "HISTORY" },
        { type: "Report", id: "LIST" },
        { type: "Bfars", id: `${id}-generated` },
      ],
    }),
    getGeneratedBfarsReports: build.query<GeneratedReport[], BfarsReportId>({
      queryFn: (id) => fromService(() => bfarsService.getGenerated(id)),
      providesTags: (_r, _e, id) => [{ type: "Bfars", id: `${id}-generated` }],
    }),
  }),
});

export const { useGenerateBfarsReportMutation, useGetGeneratedBfarsReportsQuery } = bfarsGenerationApi;
