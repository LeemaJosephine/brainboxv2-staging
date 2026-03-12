import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { apiBaseUrl } from "../env";

export const gameApi = createApi({
  reducerPath: "gameApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/game`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth?: { token: string | null } }).auth?.token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  endpoints: (builder) => ({
    createGame: builder.mutation<{ code: string; quizName: string }, { quizId: string }>({
      query: (body) => ({ url: "/", method: "POST", body }),
    }),
    getGameInfo: builder.query<{ code: string; quizName: string; status: string; participantCount: number }, string>({
      query: (code) => `/${code}`,
    }),
    sendReport: builder.mutation<{ message: string }, { code: string; email: string; name?: string }>({
      query: (body) => ({ url: "/send-report", method: "POST", body }),
    }),
  }),
});

export const { useCreateGameMutation, useGetGameInfoQuery, useSendReportMutation } = gameApi;
