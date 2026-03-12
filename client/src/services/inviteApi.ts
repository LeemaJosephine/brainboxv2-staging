import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { apiBaseUrl } from "../env";

/** teamId required for admin; omitted for team manager (invites to own team). */
export interface CreateInviteRequest {
  name: string;
  email: string;
  teamId?: string;
}

export interface CreateInviteResponse {
  message: string;
  invite: { _id: string; email: string; name: string; teamId: string; teamName: string };
}

export interface ValidateInviteResponse {
  valid: boolean;
  name: string;
  email: string;
  teamName: string;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface AcceptInviteResponse {
  message: string;
  email: string;
}

export interface BulkInviteItem {
  name: string;
  email: string;
  teamName?: string;
}

export interface BulkInviteRequest {
  invites: BulkInviteItem[];
}

export interface BulkInviteResponse {
  message: string;
  sent: number;
  failed: { index: number; email: string; message: string }[];
}

export const inviteApi = createApi({
  reducerPath: "inviteApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/invite`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  endpoints: (builder) => ({
    createInvite: builder.mutation<CreateInviteResponse, CreateInviteRequest>({
      query: (body) => ({ url: "/", method: "POST", body }),
    }),
    validateInvite: builder.query<ValidateInviteResponse, string>({
      query: (token) => ({ url: `/validate/${encodeURIComponent(token)}` }),
    }),
    acceptInvite: builder.mutation<AcceptInviteResponse, AcceptInviteRequest>({
      query: (body) => ({ url: "/accept", method: "POST", body }),
    }),
    createBulkInvite: builder.mutation<BulkInviteResponse, BulkInviteRequest>({
      query: (body) => ({ url: "/bulk", method: "POST", body }),
    }),
  }),
});

export const {
  useCreateInviteMutation,
  useCreateBulkInviteMutation,
  useValidateInviteQuery,
  useLazyValidateInviteQuery,
  useAcceptInviteMutation,
} = inviteApi;
