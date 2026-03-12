import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Category } from "../types/category";
import { apiBaseUrl } from "../env";

export const categoryApi = createApi({
  reducerPath: "categoryApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/category`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Category"],
  endpoints: (builder) => ({
    getCategories: builder.query<Category[], void>({
      query: () => "/",
      providesTags: (result) =>
        result
          ? [...result.map(({ _id }) => ({ type: "Category" as const, id: _id })), { type: "Category", id: "LIST" }]
          : [{ type: "Category", id: "LIST" }],
    }),
    getCategory: builder.query<Category, string>({
      query: (id) => `/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Category", id }],
    }),
    createCategory: builder.mutation<Category, { name: string }>({
      query: (body) => ({ url: "/", method: "POST", body }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),
    updateCategory: builder.mutation<Category, { _id: string; name: string }>({
      query: ({ _id, ...body }) => ({ url: `/${_id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { _id }) => [{ type: "Category", id: _id }, { type: "Category", id: "LIST" }],
    }),
    deleteCategory: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Category", id }, { type: "Category", id: "LIST" }],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} = categoryApi;
