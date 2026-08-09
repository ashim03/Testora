import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FileText, ClipboardList, CheckCircle2, PenSquare, Target, User, ArrowRight, CalendarDays,
} from "lucide-react";
import { apiGet } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { initialOf } from "../../utils";
import { profileCompletion, type AccountProfile } from "../../lib/profile";

interface DashboardData {
  teacherName: string | null;
  batchCount: number;
  availableExams: number;
  totalAssignedExams: number;
  completedExams: number;
  pendingAssignments: number;
  recentResults: Array<{ _id: string; examTitle: string; category: string; practiceBand: number | null; estimatedPteScore: number | null; percentage: number | null; finalScore: number | null; maxScore: number | null }>;
  currentBatch: { _id: string; name: string; courseId: { name?: string } | null } | null;
}

export function StudentDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: async () => (await apiGet<DashboardData>("/student/dashboard")).data,
  });

  const profileQuery = useQuery({
    queryKey: ["me", "full"],
    queryFn: async () => (await apiGet<AccountProfile>("/auth/me/full")).data,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load dashboard"} />;

  const profile = profileQuery.data;
  const completion = profile ? profileCompletion(profile) : 0;
  const countdown = profile?.preferredTestDate ? daysUntil(profile.preferredTestDate) : null;

  const cards = [
    { label: "Available tests", value: data.availableExams, icon: FileText, to: "/student/tests" },
    { label: "Assigned", value: data.totalAssignedExams, icon: ClipboardList, to: "/student/tests" },
    { label: "Completed", value: data.completedExams, icon: CheckCircle2, to: "/student/results" },
    { label: "Assignments", value: data.pendingAssignments, icon: ClipboardList, to: "/student/assignments" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback>{initialOf(user?.firstName)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.firstName}!</h1>
            <p className="text-sm text-muted-foreground">
              {data.teacherName ? `Your teacher: ${data.teacherName}` : "No teacher assigned yet"}
              {data.currentBatch ? ` · Batch: ${data.currentBatch.name}` : ""}
            </p>
          </div>
        </div>
        <Button asChild><Link to="/student/practice"><PenSquare className="size-4" /> Start practice</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group">
            <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-muted p-2.5 text-brand-600">
                  <c.icon className="size-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="size-4 text-brand-600" />
            <CardTitle className="text-base">Your goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Exam</p>
              <p className="font-semibold">{profile?.examType || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Target score</p>
              <p className="font-semibold">{profile?.targetScore || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current level</p>
              <p className="font-semibold">{profile?.currentLevel || "Not set"}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/student/profile">Edit exam details</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CalendarDays className="size-4 text-brand-600" />
            <CardTitle className="text-base">Test date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {countdown != null ? (
              <>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-brand-600">{countdown}</span>
                  <span className="mb-1 text-sm text-muted-foreground">{countdown === 1 ? "day to go" : "days to go"}</span>
                </div>
                <p className="text-sm text-muted-foreground">Set for {formatDateShort(profile?.preferredTestDate)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Add a preferred test date to see a countdown here.</p>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Profile completion</span><span className="font-semibold">{completion}%</span>
                </div>
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
                </div>
              </div>
              <Button asChild variant="ghost" size="sm"><Link to="/student/profile"><ArrowRight className="size-4" /></Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <QuickAction to="/student/tests" icon={FileText} label="Take a test" />
            <QuickAction to="/student/practice" icon={PenSquare} label="Practice questions" />
            <QuickAction to="/student/assignments" icon={ClipboardList} label="Pending assignments" count={data.pendingAssignments} />
            <QuickAction to="/student/profile" icon={User} label="Update profile" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent results</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/student/results">View all</Link></Button>
        </CardHeader>
        <CardContent>
          {data.recentResults.length === 0 ? (
            <EmptyState title="No results yet" description="Complete a test to see your practice performance here." />
          ) : (
            <div className="space-y-3">
              {data.recentResults.map((r) => (
                <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{r.examTitle}</div>
                    <div className="text-xs text-muted-foreground">{r.category.replace(/_/g, " ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.practiceBand != null && <Badge variant="secondary">IELTS Practice Band: {r.practiceBand.toFixed(1)}</Badge>}
                    {r.estimatedPteScore != null && <Badge variant="outline">PTE: {r.estimatedPteScore}</Badge>}
                    {r.percentage != null && <span className="text-sm font-semibold">{r.percentage}%</span>}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Practice scores are indicative only and are not official IELTS or PTE results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, count }: { to: string; icon: typeof FileText; label: string; count?: number }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted">
      <span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /> {label}</span>
      {typeof count === "number" && count > 0 ? <Badge variant="secondary">{count}</Badge> : <ArrowRight className="size-4 text-muted-foreground" />}
    </Link>
  );
}

function daysUntil(value: string): number {
  const target = new Date(value).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target - now) / 86400000));
}

function formatDateShort(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}