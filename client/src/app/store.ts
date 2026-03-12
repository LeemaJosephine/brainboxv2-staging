import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import { logout } from "../features/auth/authSlice";
import { authApi } from "../services/authApi";
import { teamApi } from "../services/teamApi";
import { quizApi } from "../services/quizApi";
import { gameApi } from "../services/gameApi";
import { categoryApi } from "../services/categoryApi";
import { reportsApi } from "../services/reportsApi";
import { usersApi } from "../services/usersApi";
import { inviteApi } from "../services/inviteApi";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [teamApi.reducerPath]: teamApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [inviteApi.reducerPath]: inviteApi.reducer,
    [quizApi.reducerPath]: quizApi.reducer,
    [gameApi.reducerPath]: gameApi.reducer,
    [categoryApi.reducerPath]: categoryApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      teamApi.middleware,
      quizApi.middleware,
      gameApi.middleware,
      categoryApi.middleware,
      reportsApi.middleware,
      usersApi.middleware,
      inviteApi.middleware
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Logout and clear all RTK Query caches so the next login doesn't show previous user's data */
export const logoutAndClearCache = (): ((dispatch: AppDispatch) => void) => (dispatch: AppDispatch) => {
  dispatch(logout());
  dispatch(authApi.util.resetApiState());
  dispatch(teamApi.util.resetApiState());
  dispatch(quizApi.util.resetApiState());
  dispatch(gameApi.util.resetApiState());
  dispatch(categoryApi.util.resetApiState());
  dispatch(reportsApi.util.resetApiState());
  dispatch(usersApi.util.resetApiState());
  dispatch(inviteApi.util.resetApiState());
};
