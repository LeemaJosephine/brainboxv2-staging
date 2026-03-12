import { Navigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";

interface PublicRouteProps {
  children: React.ReactNode;
}

export default function PublicRoute({ children }: PublicRouteProps) {
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const membership = useAppSelector((state) => state.auth.membership);

  if (token) {
    // Admin or active membership → app (quiz); otherwise onboarding
    if (user?.role === "admin" || membership?.status === "active") {
      return <Navigate to="/quiz" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
