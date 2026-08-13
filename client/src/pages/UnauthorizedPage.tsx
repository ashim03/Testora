import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuthStore } from "../store/auth";
import { homePathForRole } from "../config/navigation";

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">403</h1>
      <p className="mt-2 text-lg">You don't have permission to access this page.</p>
      <Button className="mt-4" variant="outline" onClick={() => navigate(homePathForRole(user?.role))}>Go home</Button>
    </div>
  );
}
