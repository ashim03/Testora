import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, UserCog, CheckCircle2, Ban } from "lucide-react";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ErrorState, PageSpinner } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";

interface ConsultancyData {
  id: string;
  name: string;
  code: string;
  status: string;
  subscriptionStatus: string;
  subscriptionEndDate?: string | null;
  package?: { name: string; studentLimit: number; teacherLimit: number; price: number; currency: string } | null;
  studentLimit?: number | null;
  teacherLimit?: number | null;
  teacherCount: number;
  studentCount: number;
  daysLeft: number;
}

interface Overview {
  consultancy: ConsultancyData;
  counts: { teachers: number; students: number };
  recentTeachers: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  recentStudents: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

export function ConsultancyDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["consultancy", "overview"],
    queryFn: async () => (await apiGet<Overview>("/consultancy/overview")).data,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const c = data.consultancy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="text-sm text-muted-foreground">{c.code} · Consultancy portal</p>
        </div>
        {c.subscriptionStatus === "ACTIVE" ? (
          <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-600" /> Subscription active · {c.daysLeft} days left</Badge>
        ) : (
          <Badge variant="destructive" className="gap-1.5"><Ban className="size-3.5" /> Subscription {c.subscriptionStatus}</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/consultancy/students">
          <Card className="transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-md bg-muted p-2.5 text-brand-600"><Users className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold leading-none">{data.counts.students}<span className="text-sm font-normal text-muted-foreground">/{c.studentLimit ?? "∞"}</span></div>
                <div className="text-xs text-muted-foreground">Students</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/consultancy/teachers">
          <Card className="transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-md bg-muted p-2.5 text-violet-600"><UserCog className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold leading-none">{data.counts.teachers}<span className="text-sm font-normal text-muted-foreground">/{c.teacherLimit ?? "∞"}</span></div>
                <div className="text-xs text-muted-foreground">Teachers</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-md bg-muted p-2.5 text-accent-700"><CheckCircle2 className="size-5" /></div>
            <div>
              <div className="text-2xl font-bold leading-none">{c.package?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {c.package ? `${c.package.price.toLocaleString()} ${c.package.currency}` : "No package assigned"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle>Recent teachers</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link to="/consultancy/teachers">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentTeachers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No teachers yet. Add teachers from the Teachers page.</p>
            ) : (
              <ul className="divide-y">
                {data.recentTeachers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{t.firstName} {t.lastName}</span>
                    <span className="text-xs text-muted-foreground">{t.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle>Recent students</CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs"><Link to="/consultancy/students">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentStudents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No students yet. Add students from the Students page.</p>
            ) : (
              <ul className="divide-y">
                {data.recentStudents.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="text-xs text-muted-foreground">{s.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}