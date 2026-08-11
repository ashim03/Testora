import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, Users, FileText, CheckCircle2, Clock } from "lucide-react";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatDateTime, titleCase } from "../../utils";

interface AdminDashboardData {
  totalTeachers: number;
  totalStudents: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  totalTests: number;
  testsCompleted: number;
  pendingGrading: number;
  averagePerformance: number;
  recentRegistrations: Array<{ _id: string; firstName: string; lastName: string; email: string; role: string; status: string; createdAt: string }>;
  recentActivity: Array<{ _id: string; studentId: { firstName: string; lastName: string }; examId?: { title?: string }; status: string; createdAt: string }>;
  enrollment: { ieltsCourses: number; pteCourses: number; batches: number };
  skillScores: Record<string, number>;
}

export function AdminDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await apiGet<AdminDashboardData>("/admin/dashboard");
      return res.data;
    },
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const s = data.skillScores ?? {};
  const cards = [
    { label: "Students", value: data.totalStudents, icon: Users, to: "/admin/students", color: "text-brand-600" },
    { label: "Teachers", value: data.totalTeachers, icon: Users, to: "/admin/teachers", color: "text-violet-600" },
    { label: "Tests", value: data.totalTests, icon: FileText, to: "/admin/exams", color: "text-accent-700" },
    { label: "Submitted", value: data.testsCompleted, icon: CheckCircle2, to: "/admin/submissions", color: "text-emerald-700" },
    { label: "Pending grading", value: data.pendingGrading, icon: Clock, to: "/admin/submissions", color: "text-rose-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform-wide overview and operational status</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-card">
          <Activity className="size-4 text-accent-700" />
          <span><span className="font-semibold text-foreground">{data.activeUsers}</span> active users</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group">
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover">
              <CardContent className="flex h-full items-center gap-4 p-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentRegistrations.length === 0 ? (
              <EmptyState title="No registrations" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentRegistrations.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                      <TableCell>{titleCase(u.role.replace("_", " "))}</TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(u.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentActivity.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">
                        {a.studentId.firstName} {a.studentId.lastName}
                      </TableCell>
                      <TableCell>{a.examId?.title ?? "-"}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b"><CardTitle>Skill Performance (%)</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(s).length === 0 ? (
            <EmptyState title="No performance data yet" description="Published results will appear here." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(s).map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-muted/25 p-3 text-center">
                  <div className="text-lg font-bold text-primary">{v}%</div>
                  <div className="text-xs text-muted-foreground">{titleCase(k.replace(/_/g, " "))}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "ACTIVE" || status === "SUBMITTED" || status === "PUBLISHED" || status === "GRADED"
      ? "secondary"
      : status === "SUSPENDED" || status === "ARCHIVED"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{titleCase(status.replace(/_/g, " "))}</Badge>;
}
