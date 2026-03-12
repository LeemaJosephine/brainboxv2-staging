import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Membership } from "../types/auth";
import { apiBaseUrl } from "../env";

export interface TeamInfo {
  _id: string;
  name: string;
  teamCode: string;
  createdAt?: string;
  teamManagerName?: string | null;
  memberCount?: number;
}

export interface CreateTeamResponse {
  team: TeamInfo;
  membership?: Membership;
}

export interface ListTeamsResponse {
  teams: TeamInfo[];
}

export interface GetTeamMembersByTeamIdResponse {
  team: { _id: string; name: string; teamCode: string };
  members: TeamMember[];
}

export interface JoinTeamResponse {
  team: { _id: string; name: string; teamCode: string };
  membership: Membership;
}

export interface TeamMember {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface GetMembersResponse {
  team: { _id: string; name: string; teamCode: string };
  members: TeamMember[];
  currentUserRole: string;
}

export const teamApi = createApi({
  reducerPath: "teamApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/team`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ["Members", "Teams"],
  endpoints: (builder) => ({
    listTeams: builder.query<ListTeamsResponse, void>({
      query: () => ({ url: "/" }),
      providesTags: ["Teams"],
    }),
    getTeamMembersByTeamId: builder.query<GetTeamMembersByTeamIdResponse, string>({
      query: (teamId) => ({ url: `/${teamId}/members` }),
      providesTags: (_result, _err, teamId) => [{ type: "Teams", id: `members-${teamId}` }],
    }),
    createTeam: builder.mutation<CreateTeamResponse, { name: string }>({
      query: (body) => ({ url: "/create", method: "POST", body }),
      invalidatesTags: ["Teams"],
    }),
    updateTeam: builder.mutation<{ team: TeamInfo }, { teamId: string; name: string }>({
      query: ({ teamId, name }) => ({ url: `/${teamId}`, method: "PATCH", body: { name } }),
      invalidatesTags: ["Teams"],
    }),
    deleteTeam: builder.mutation<{ message: string }, string>({
      query: (teamId) => ({ url: `/${teamId}`, method: "DELETE" }),
      invalidatesTags: ["Teams"],
    }),
    joinTeam: builder.mutation<JoinTeamResponse, { teamCode: string }>({
      query: (body) => ({ url: "/join", method: "POST", body }),
    }),
    getMembers: builder.query<GetMembersResponse, void>({
      query: () => ({ url: "/members" }),
      providesTags: ["Members"],
    }),
    approveMember: builder.mutation<{ message: string }, string>({
      query: (userId) => ({ url: `/members/${userId}/approve`, method: "POST" }),
      invalidatesTags: ["Members"],
    }),
    rejectMember: builder.mutation<{ message: string }, string>({
      query: (userId) => ({ url: `/members/${userId}/reject`, method: "POST" }),
      invalidatesTags: ["Members"],
    }),
  }),
});

export const {
  useListTeamsQuery,
  useGetTeamMembersByTeamIdQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useJoinTeamMutation,
  useGetMembersQuery,
  useApproveMemberMutation,
  useRejectMemberMutation,
} = teamApi;
