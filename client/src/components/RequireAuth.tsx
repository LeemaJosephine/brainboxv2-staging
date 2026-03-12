import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "../app/hooks";

interface RequireAuthProps {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
