import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  SignupRequest,
  LoginRequest,
  AuthResponse,
  MeResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "../types/auth";
import { apiBaseUrl } from "../env";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/auth`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  endpoints: (builder) => ({
    signup: builder.mutation<AuthResponse, SignupRequest>({
      query: (body) => ({ url: "/signup", method: "POST", body }),
    }),
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: "/login", method: "POST", body }),
    }),
    forgotPassword: builder.mutation<{ message: string }, ForgotPasswordRequest>({
      query: (body) => ({ url: "/forgot-password", method: "POST", body }),
    }),
    resetPassword: builder.mutation<{ message: string }, ResetPasswordRequest>({
      query: (body) => ({ url: "/reset-password", method: "POST", body }),
    }),
    getMe: builder.query<MeResponse, void>({
      query: () => ({ url: "/me" }),
    }),
  }),
});

export const {
  useSignupMutation,
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useGetMeQuery,
} = authApi;
