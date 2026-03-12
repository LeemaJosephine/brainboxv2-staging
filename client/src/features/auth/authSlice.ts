import { createSlice } from "@reduxjs/toolkit";
import type { User, Membership } from "../../types/auth";

const AUTH_TOKEN_KEY = "token";
const AUTH_USER_KEY = "user";
const AUTH_MEMBERSHIP_KEY = "membership";

const getStoredToken = () => (typeof window !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
const getStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};
const getStoredMembership = (): Membership | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_MEMBERSHIP_KEY);
    return raw ? (JSON.parse(raw) as Membership) : null;
  } catch {
    return null;
  }
};

export interface AuthState {
  token: string | null;
  user: User | null;
  membership: Membership | null;
}

const initialState: AuthState = {
  token: getStoredToken(),
  user: getStoredUser(),
  membership: getStoredMembership(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: {
        payload: { token: string; user: User; membership?: Membership | null };
      }
    ) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.membership = action.payload.membership ?? null;
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_TOKEN_KEY, action.payload.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(action.payload.user));
        if (action.payload.membership != null) {
          localStorage.setItem(AUTH_MEMBERSHIP_KEY, JSON.stringify(action.payload.membership));
        } else {
          localStorage.removeItem(AUTH_MEMBERSHIP_KEY);
        }
      }
    },
    setMembership: (state, action: { payload: Membership | null }) => {
      state.membership = action.payload;
      if (typeof window !== "undefined") {
        if (action.payload != null) {
          localStorage.setItem(AUTH_MEMBERSHIP_KEY, JSON.stringify(action.payload));
        } else {
          localStorage.removeItem(AUTH_MEMBERSHIP_KEY);
        }
      }
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.membership = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_MEMBERSHIP_KEY);
      }
    },
  },
});

export const { setCredentials, setMembership, logout } = authSlice.actions;
export default authSlice.reducer;
