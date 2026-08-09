import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, FileText, CheckCircle2, Clock } from "lucide-react";
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
    { label: "Tests", value: data.totalTests, icon: FileText, to: "/admin/teachers", color: "text-accent-600" },
    { label: "Submitted", value: data.testsCompleted, icon: CheckCircle2, to: "/admin/teachers", color: "text-emerald-600" },
    { label: "Pending grading", value: data.pendingGrading, icon: Clock, to: "/admin/teachers", color: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform-wide overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-lg bg-muted p-2.5 ${c.color}`}>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
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
          <CardHeader>
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
        <CardHeader><CardTitle>Skill Performance (%)</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(s).length === 0 ? (
            <EmptyState title="No performance data yet" description="Published results will appear here." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(s).map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3 text-center">
                  <div className="text-lg font-bold">{v}%</div>
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