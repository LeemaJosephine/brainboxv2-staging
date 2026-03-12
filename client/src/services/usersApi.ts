import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { apiBaseUrl } from "../env";

export type ApiUserRole = "admin" | "team_manager" | "user";

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: ApiUserRole;
  active: boolean;
  createdAt: string;
  teamId?: string | null;
  teamName?: string | null;
}

export interface ListAllUsersResponse {
  users: ApiUser[];
}

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/users`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["AllUsers", "Teams"],
  endpoints: (builder) => ({
    getAllUsers: builder.query<ListAllUsersResponse, void>({
      query: () => ({ url: "/" }),
      providesTags: ["AllUsers"],
    }),
    setUserActive: builder.mutation<
      { message: string; user: ApiUser },
      { userId: string; active: boolean }
    >({
      query: ({ userId, active }) => ({
        url: `/${userId}/active`,
        method: "PATCH",
        body: { active },
      }),
      invalidatesTags: ["AllUsers"],
    }),
    setUserRole: builder.mutation<
      { message: string; user: ApiUser },
      { userId: string; role: "team_manager" | "user" }
    >({
      query: ({ userId, role }) => ({
        url: `/${userId}/role`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: ["AllUsers"],
    }),
    updateUserRoleAndTeam: builder.mutation<
      { message: string; user: ApiUser },
      { userId: string; role?: "team_manager" | "user"; teamId?: string }
    >({
      query: ({ userId, role, teamId }) => ({
        url: `/${userId}`,
        method: "PATCH",
        body: { role, teamId },
      }),
      invalidatesTags: ["AllUsers", "Teams"],
    }),
  }),
});

export const {
  useGetAllUsersQuery,
  useSetUserActiveMutation,
  useSetUserRoleMutation,
  useUpdateUserRoleAndTeamMutation,
} = usersApi;
