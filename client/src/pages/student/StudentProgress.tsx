import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { titleCase } from "../../utils";

interface ProgressData {
  totalResults: number;
  averagePercentage: number;
  trend?: Array<{ label?: string; score?: number | null; percentage?: number | null; band?: number | null; pte?: number | null }>;
  skillAverages?: Record<string, number>;
}

export function StudentProgress() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "progress"],
    queryFn: async () => (await apiGet<ProgressData>("/student/progress")).data,
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load progress"} />;
  if (isLoading || !data) return <Spinner className="size-8 text-primary" />;

  const skills = Object.entries(data.skillAverages ?? {});
  const trend = data.trend ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted-foreground">Your learning journey</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Average performance</p>
            <p className="mt-1 text-2xl font-bold">{data.averagePercentage}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Published results</p>
            <p className="mt-1 text-2xl font-bold">{data.totalResults}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Skill averages</CardTitle></CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skill data yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map(([k, v]) => (
                <Badge key={k} variant="secondary">{titleCase(k)}: {v}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Score trend</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Exam</th>
                <th className="p-3 font-medium">Score</th>
                <th className="p-3 font-medium">Percentage</th>
                <th className="p-3 font-medium">Band / PTE</th>
              </tr>
            </thead>
            <tbody>
              {trend.length === 0 ? (
                <tr><td className="p-3 text-muted-foreground">No results yet.</td></tr>
              ) : (
                trend.map((t, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3 font-medium">{t.label || "—"}</td>
                    <td className="p-3">{t.score ?? "—"}</td>
                    <td className="p-3">{t.percentage != null ? `${t.percentage}%` : "—"}</td>
                    <td className="p-3">
                      {t.band != null ? <Badge variant="secondary">IELTS Practice Band: {t.band.toFixed(1)}</Badge>
                        : t.pte != null ? <Badge variant="outline">PTE: {t.pte}</Badge> : "—"}
                    </td>
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