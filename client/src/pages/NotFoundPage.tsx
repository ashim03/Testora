import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/auth";
import { homePathForRole } from "../config/navigation";

export function NotFoundPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="mt-2 text-lg">The page you were looking for doesn't exist.</p>
      <Button className="mt-4" onClick={() => navigate(homePathForRole(user?.role))}>Go home</Button>
    </div>
  );
}
