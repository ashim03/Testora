import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpenCheck, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { useBrandingStore, type Branding } from "../../store/branding";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Spinner } from "../../components/ui/feedback";
import { getErrorMessage } from "../../utils";
import portalBackdrop from "../../assets/portal-ai-background.png";

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
    <div className="auth-shell min-h-screen bg-background px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_480px] lg:p-0" style={{ "--portal-backdrop": `url(${portalBackdrop})` } as CSSProperties}>
      <section className="relative z-10 hidden min-h-screen flex-col justify-between border-r bg-card/20 px-10 py-10 backdrop-blur-[2px] lg:flex">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name || "logo"} className="size-10 rounded-lg object-cover" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
              {branding?.name ? branding.name.charAt(0) : "T"}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{branding?.name || "Testora"}</p>
            <p className="text-xs text-muted-foreground">{branding?.tagline || "IELTS and PTE preparation"}</p>
          </div>
        </div>

        <div className="max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-card backdrop-blur-xl">
            <ShieldCheck className="size-4 text-accent-700" />
            Secure practice and assessment workspace
          </div>
          <div className="space-y-3">
            <h1 className="max-w-xl text-4xl font-bold tracking-normal text-foreground drop-shadow-sm">Focused exam operations for every role.</h1>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Manage IELTS and PTE courses, exams, submissions, grading, and progress from one structured dashboard.
            </p>
          </div>
        </div>

        <div className="grid max-w-xl grid-cols-3 gap-3">
          {["Admin", "Teacher", "Student"].map((role) => (
            <div key={role} className="rounded-lg border bg-background/80 p-4 shadow-card backdrop-blur-xl">
              <BookOpenCheck className="mb-3 size-5 text-primary" />
              <p className="text-sm font-semibold">{role}</p>
              <p className="text-xs text-muted-foreground">Workspace</p>
            </div>
          ))}
        </div>
      </section>

      <main className="relative z-10 flex min-h-[calc(100vh-3rem)] items-center justify-center lg:min-h-screen lg:bg-background/70 lg:backdrop-blur-xl">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center lg:hidden">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name || "logo"} className="mx-auto mb-3 size-12 rounded-lg object-cover" />
            ) : (
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
                {branding?.name ? branding.name.charAt(0) : "T"}
              </div>
            )}
            <h1 className="text-2xl font-bold">{branding?.name || "Testora"}</h1>
            <p className="text-sm text-muted-foreground">
              {branding?.tagline || "IELTS and PTE test preparation platform"}
            </p>
          </div>
          <Card className="bg-card/95 shadow-card-hover backdrop-blur-xl">
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
              <div className="mt-4 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
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
      </main>
    </div>
  );
}
