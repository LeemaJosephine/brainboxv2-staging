import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { ReportQuizListItem, QuizReportResponse } from "../types/reports";
import { apiBaseUrl } from "../env";

export const reportsApi = createApi({
  reducerPath: "reportsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/reports`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Reports"],
  endpoints: (builder) => ({
    listReportQuizzes: builder.query<ReportQuizListItem[], void>({
      query: () => "/quizzes",
      providesTags: [{ type: "Reports", id: "QUIZZES" }],
    }),
    getQuizReport: builder.query<QuizReportResponse, string>({
      query: (quizId) => `/quizzes/${quizId}`,
      providesTags: (_r, _e, quizId) => [{ type: "Reports", id: quizId }],
    }),
    downloadQuizCsv: builder.query<Blob, string>({
      query: (quizId) => ({
        url: `/quizzes/${quizId}/csv`,
        // tell fetchBaseQuery to treat it as blob
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useListReportQuizzesQuery,
  useGetQuizReportQuery,
  useLazyDownloadQuizCsvQuery,
} = reportsApi;

