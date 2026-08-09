import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { formatDateTime, titleCase } from "../../utils";

interface SubmissionRow {
  _id: string;
  examId?: { title?: string; category?: string } | null;
  studentId?: { firstName?: string; lastName?: string; email?: string } | null;
  status: string;
  finalScore?: number | null;
  updatedAt: string;
}

const SUBMISSION_BADGE: Record<string, "secondary" | "outline" | "destructive" | "default"> = {
  SUBMITTED: "secondary",
  GRADED: "default",
  PUBLISHED: "default",
  UNDER_REVIEW: "outline",
  IN_PROGRESS: "outline",
};

export function TeacherSubmissions() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exams", "submissions", { page }],
    queryFn: async () => {
      const res = await apiGet<SubmissionRow[]>("/exams/submissions", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load submissions"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="text-sm text-muted-foreground">Student attempts awaiting grading or review</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Attempt submissions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <TableEmptyState colSpan={5} title="No submissions" description="Student attempts will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell className="font-medium">{s.studentId ? `${s.studentId.firstName} ${s.studentId.lastName}` : "—"}</TableCell>
                    <TableCell>{s.examId?.title ?? "—"}</TableCell>
                    <TableCell>{s.examId?.category ? titleCase(s.examId.category) : "—"}</TableCell>
                    <TableCell><Badge variant={SUBMISSION_BADGE[s.status] ?? "outline"}>{titleCase(s.status)}</Badge></TableCell>
                    <TableCell>{s.finalScore != null ? s.finalScore : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(s.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
        </CardContent>
      </Card>
    </div>
  );
}