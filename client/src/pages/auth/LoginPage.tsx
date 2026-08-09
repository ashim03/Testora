import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { useBrandingStore, type Branding } from "../../store/branding";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Spinner } from "../../components/ui/feedback";
import { getErrorMessage } from "../../utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const branding = useBrandingStore((s) => s.branding);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    apiGet<Branding>("/branding")
      .then((res) => setBranding(res.data ?? null))
      .catch(() => undefined);
  }, [setBranding]);

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const res = await apiPost<{ accessToken: string; user: import("../../store/auth").AuthUser }>("/auth/login", values);
      if (!res.success || !res.data) throw new Error(res.message || "Login failed");
      setAuth(res.data.accessToken, res.data.user);
      toast.success(`Welcome back, ${res.data.user.firstName}!`);
      const home = res.data.user.role === "SUPER_ADMIN" ? "/admin" : res.data.user.role === "TEACHER" ? "/teacher" : "/student";
      navigate(from && !from.startsWith("/login") ? from : home, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-accent-50 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name || "logo"} className="mx-auto mb-3 h-12 w-12 rounded-2xl object-cover" />
          ) : (
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-xl font-bold text-white">
              {branding?.name ? branding.name.charAt(0) : "T"}
            </div>
          )}
          <h1 className="text-2xl font-bold">{branding?.name || "Testora"}</h1>
          <p className="text-sm text-muted-foreground">
            {branding?.tagline || "IELTS &amp; PTE test preparation platform"}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner className="size-4" /> : null}
                Sign in
              </Button>
            </form>
            <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Demo accounts</p>
              <p>
                Admin: admin@example.com / Admin@12345
                <br />
                Teacher: teacher@example.com / Teacher@12345
                <br />
                Student: student@example.com / Student@12345
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}