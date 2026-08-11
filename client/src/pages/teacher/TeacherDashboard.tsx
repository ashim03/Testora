import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Layers, FileText, ClipboardList, Clock, CheckCircle2, PenLine, FolderOpen, ArrowRight, Briefcase, BookOpen } from "lucide-react";
import { apiGet } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { useBrandingStore } from "../../store/branding";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ErrorState, PageSpinner } from "../../components/ui/feedback";

interface TeacherDashboardData {
  studentCount: number;
  activeBatches: number;
  totalExams: number;
  totalAssignments: number;
  pendingGrading: number;
  gradedAttempts: number;
  courseCount: number;
}

export function TeacherDashboard() {
  const user = useAuthStore((s) => s.user);
  const branding = useBrandingStore((s) => s.branding);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "dashboard"],
    queryFn: async () => (await apiGet<TeacherDashboardData>("/teacher/dashboard")).data,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const cards = [
    { label: "Courses", value: data.courseCount, icon: BookOpen, color: "text-brand-600", to: "/teacher/courses" },
    { label: "Students", value: data.studentCount, icon: Users, color: "text-violet-600", to: "/teacher/students" },
    { label: "Batches", value: data.activeBatches, icon: Layers, color: "text-accent-600", to: "/teacher/batches" },
    { label: "Assignments", value: data.totalAssignments, icon: ClipboardList, color: "text-emerald-600", to: "/teacher/assignments" },
    { label: "Pending grading", value: data.pendingGrading, icon: Clock, color: "text-amber-600", to: "/teacher/submissions" },
    { label: "Graded", value: data.gradedAttempts, icon: CheckCircle2, color: "text-rose-600", to: "/teacher/results" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="logo" className="size-8 rounded-lg object-cover" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {branding?.name ? branding.name.charAt(0) : "T"}
              </span>
            )}
            <h1 className="text-2xl font-bold tracking-normal">{branding?.name || "Teacher"} dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage your classes, content and grading</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-card">
          <Briefcase className="size-4" /> Signed in as {user?.firstName} {user?.lastName}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group">
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-md bg-muted p-2.5 ${c.color}`}>
                  <c.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-none">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b"><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <QuickLink to="/teacher/courses" icon={BookOpen} label="Manage course content" count={data.courseCount} />
            <QuickLink to="/teacher/exams" icon={FileText} label="Build an exam" />
            <QuickLink to="/teacher/questions" icon={FolderOpen} label="Manage question bank" />
            <QuickLink to="/teacher/submissions" icon={PenLine} label="Grade submissions" count={data.pendingGrading} />
            <QuickLink to="/teacher/students" icon={Users} label="View students" count={data.studentCount} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b"><CardTitle>Grading queue</CardTitle></CardHeader>
          <CardContent>
            {data.pendingGrading === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" /> You're all caught up!
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You have <span className="font-semibold text-foreground">{data.pendingGrading}</span> submission{data.pendingGrading === 1 ? "" : "s"} awaiting your review.
                </p>
                <Link to="/teacher/submissions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Go to grading <ArrowRight className="size-4" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, count }: { to: string; icon: typeof Users; label: string; count?: number }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/25 hover:bg-muted/60">
      <span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /> {label}</span>
      {typeof count === "number" && count > 0 ? <Badge variant="secondary">{count}</Badge> : <ArrowRight className="size-4 text-muted-foreground" />}
    </Link>
  );
}
