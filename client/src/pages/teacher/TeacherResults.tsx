import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatDateTime } from "../../utils";

interface ResultRow {
  _id: string;
  examId: { title: string };
  studentId: { firstName: string; lastName: string; email: string };
  finalScore: number | null;
  objectiveScore: number | null;
  subjectiveScore: number | null;
  maxScore: number | null;
  practiceBand: number | null;
  estimatedPteScore: number | null;
  status: string;
  createdAt: string;
}

export function TeacherResults() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "results"],
    queryFn: async () => (await apiGet<ResultRow[]>("/exams/results")).data ?? [],
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-sm text-muted-foreground">Graded and published results</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Submitted tests</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <EmptyState title="No results yet" description="Graded results will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Band / PTE</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-medium">{r.studentId.firstName} {r.studentId.lastName}</TableCell>
                    <TableCell>{r.examId.title}</TableCell>
                    <TableCell>{r.finalScore ?? "-"} / {r.maxScore ?? "-"}</TableCell>
                    <TableCell>
                      {r.practiceBand != null ? `${r.practiceBand.toFixed(1)} band` : r.estimatedPteScore != null ? `${r.estimatedPteScore} PTE` : "-"}
                    </TableCell>
                    <TableCell><Badge variant={r.status === "PUBLISHED" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Note: "IELTS Practice Band" and "Estimated PTE Practice Score" are indicative practice estimates, not official test scores.
      </p>
    </div>
  );
}