import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Quiz, CreateQuizRequest, UpdateQuizRequest } from "../types/quiz";
import { apiBaseUrl } from "../env";

export const quizApi = createApi({
  reducerPath: "quizApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/quiz`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Quiz"],
  endpoints: (builder) => ({
    getQuizzes: builder.query<Quiz[], void>({
      query: () => "/",
      providesTags: (result) =>
        result ? [...result.map(({ _id }) => ({ type: "Quiz" as const, id: _id })), { type: "Quiz", id: "LIST" }] : [{ type: "Quiz", id: "LIST" }],
    }),
    getQuiz: builder.query<Quiz, string>({
      query: (id) => `/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Quiz", id }],
    }),
    createQuiz: builder.mutation<Quiz, CreateQuizRequest>({
      query: (body) => ({ url: "/", method: "POST", body }),
      invalidatesTags: [{ type: "Quiz", id: "LIST" }],
    }),
    updateQuiz: builder.mutation<Quiz, UpdateQuizRequest>({
      query: ({ _id, ...body }) => ({ url: `/${_id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { _id }) => [{ type: "Quiz", id: _id }, { type: "Quiz", id: "LIST" }],
    }),
    deleteQuiz: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Quiz", id }, { type: "Quiz", id: "LIST" }],
    }),
  }),
});

export const {
  useGetQuizzesQuery,
  useGetQuizQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
} = quizApi;
