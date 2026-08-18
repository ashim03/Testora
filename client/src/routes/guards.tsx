import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { PageSpinner } from "../components/ui/feedback";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user) {
    const home =
      user.role === "SUPER_ADMIN" ? "/admin" : user.role === "CONSULTANCY" ? "/consultancy" : user.role === "TEACHER" ? "/teacher" : "/student";
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}

export function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const home =
    user.role === "SUPER_ADMIN" ? "/admin" : user.role === "CONSULTANCY" ? "/consultancy" : user.role === "TEACHER" ? "/teacher" : "/student";
  return <Navigate to={home} replace />;
}

export function ProfileLoader() {
  return <PageSpinner />;
}