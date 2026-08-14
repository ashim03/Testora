import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
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

const BAR_COLORS = ["#1d4ed8", "#7c3aed", "#0d9488", "#d97706", "#dc2626", "#2563eb", "#0891b2", "#a21caf"];

export function StudentProgress() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "progress"],
    queryFn: async () => (await apiGet<ProgressData>("/student/progress")).data,
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load progress"} />;
  if (isLoading || !data) return <Spinner className="size-8 text-primary" />;

  const skills = Object.entries(data.skillAverages ?? {}).map(([name, value]) => ({
    name: titleCase(name).replace("IELTS_", "IELTS ").replace("PTE_", "PTE "),
    score: value,
  }));
  const trend = (data.trend ?? []).map((t, i) => ({
    name: `${t.label || "Result"}${data.trend && data.trend.length > 1 ? ` (${i + 1})` : ""}`,
    percentage: t.percentage ?? 0,
    score: t.score ?? 0,
  }));

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Skill averages</CardTitle></CardHeader>
          <CardContent>
            {skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skill data yet. Publish practice results to see your skill breakdown.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, skills.length * 44)}>
                <BarChart data={skills} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={120} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(value) => [`${value} avg. score`, "Skill"]} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 12, fill: "var(--muted-foreground)" }}>
                    {skills.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Score trend</CardTitle></CardHeader>
          <CardContent>
            {trend.length < 2 ? (
              <p className="text-sm text-muted-foreground">Complete at least two tests to see your trend.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 14)}…` : v)} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} unit="%" />
                  <Tooltip formatter={(value, name) => [name === "percentage" ? `${value}%` : value, name === "percentage" ? "Percentage" : "Score"]} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="percentage" name="Percentage" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent results</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                      <td className="p-3 font-medium">{data.trend?.[i]?.label || "—"}</td>
                      <td className="p-3">{data.trend?.[i]?.score ?? "—"}</td>
                      <td className="p-3">{data.trend?.[i]?.percentage != null ? `${data.trend?.[i]?.percentage}%` : "—"}</td>
                      <td className="p-3">
                        {data.trend?.[i]?.band != null ? <Badge variant="secondary">IELTS Practice Band: {data.trend?.[i]?.band?.toFixed(1)}</Badge>
                          : data.trend?.[i]?.pte != null ? <Badge variant="outline">PTE: {data.trend?.[i]?.pte}</Badge> : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}