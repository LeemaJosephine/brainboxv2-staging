import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { setCredentials } from "../features/auth/authSlice";
import { useGetMeQuery } from "../services/authApi";
import type { MeResponse } from "../types/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const userFromRedux = useAppSelector((state) => state.auth.user);
  const membershipFromRedux = useAppSelector((state) => state.auth.membership);
  const location = useLocation();

  const { data, isLoading, isSuccess } = useGetMeQuery(undefined, {
    skip: !token,
  });

  // Sync getMe to Redux, but don't overwrite active membership with stale cache
  // (e.g. right after creating team, getMe may still return no membership)
  useEffect(() => {
    if (!isSuccess || !data || !token) return;
    const { user, membership: membershipData } = data as MeResponse;
    const hasMembershipFromApi = membershipData != null;
    const hasActiveInRedux = membershipFromRedux?.status === "active";
    if (hasMembershipFromApi || !hasActiveInRedux) {
      dispatch(
        setCredentials({
          token,
          user,
          membership: membershipData ?? null,
        })
      );
    }
  }, [isSuccess, data, token, dispatch, membershipFromRedux?.status]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-black/40 to-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Admin always gets access to the app (home); no team ID / onboarding required
  const user = (data as MeResponse | undefined)?.user ?? userFromRedux;
  if (user?.role === "admin") {
    return <>{children}</>;
  }
  // Non-admin: require active team membership
  const effectiveMembership =
    (data as MeResponse | undefined)?.membership ?? membershipFromRedux;
  if (!effectiveMembership || effectiveMembership.status !== "active") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
