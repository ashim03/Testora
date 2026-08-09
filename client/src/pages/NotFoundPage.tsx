import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="mt-2 text-lg">The page you were looking for doesn't exist.</p>
      <Button className="mt-4" onClick={() => navigate("/login")}>Go home</Button>
    </div>
  );
}