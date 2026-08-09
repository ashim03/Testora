import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState } from "../../components/ui/feedback";
import { Spinner } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { titleCase } from "../../utils";

interface ReportData {
  studentCount: number;
  resultCount: number;
  attemptCount: number;
  pendingGrading: number;
  averagePerformance: number;
  skillPerformance?: Record<string, number>;
}

export function TeacherReports() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "reports"],
    queryFn: async () => (await apiGet<ReportData>("/teacher/reports")).data,
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load reports"} />;
  if (isLoading || !data) return <Spinner className="size-8 text-primary" />;

  const skills = Object.entries(data.skillPerformance ?? {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Performance summary across your students</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Students" value={data.studentCount} />
        <StatCard label="Published results" value={data.resultCount} />
        <StatCard label="Attempts" value={data.attemptCount} />
        <StatCard label="Pending grading" value={data.pendingGrading} />
        <StatCard label="Avg performance" value={`${data.averagePerformance}%`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Skill breakdown</CardTitle></CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scored results yet to break down by skill.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map(([k, v]) => (
                <Badge key={k} variant="secondary">{titleCase(k)}: {v}%</Badge>
              ))}
            </div>
          )}
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