import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { titleCase } from "../../utils";

interface ReportData {
  enrollment: { teachers: number; students: number };
  testsPerformed: number;
  testsAvailable: number;
  completionRate: number;
  pendingGrading: number;
  assignedPairs: number;
  skillPerformance?: Record<string, number>;
  studentPerformance?: Array<{ id: string; name: string; email: string; results: number; avgPercentage: number }>;
}

export function ReportsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => (await apiGet<ReportData>("/admin/reports")).data,
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load reports"} />;
  if (isLoading || !data) return <Spinner className="size-8 text-primary" />;

  const skills = Object.entries(data.skillPerformance ?? {});
  const perf = data.studentPerformance ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Institute-wide performance overview</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Teachers" value={data.enrollment.teachers} />
        <StatCard label="Students" value={data.enrollment.students} />
        <StatCard label="Tests performed" value={data.testsPerformed} />
        <StatCard label="Tests available" value={data.testsAvailable} />
        <StatCard label="Completion rate" value={`${data.completionRate}%`} />
        <StatCard label="Pending grading" value={data.pendingGrading} />
        <StatCard label="Active assignments" value={data.assignedPairs} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Skill performance</CardTitle></CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scored results yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map(([k, v]) => (
                <Badge key={k} variant="secondary">{titleCase(k)}: {v}%</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Student performance</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Results</th>
                <th className="p-3 font-medium">Avg %</th>
              </tr>
            </thead>
            <tbody>
              {perf.length === 0 ? (
                <tr><td className="p-3 text-muted-foreground">No performance data yet.</td></tr>
              ) : (
                perf.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.results}</td>
                    <td className="p-3">{p.avgPercentage}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}