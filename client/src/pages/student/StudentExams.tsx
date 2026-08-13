import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { getErrorMessage, formatDate, formatDuration } from "../../utils";

interface ExamListItem {
  exam: { _id: string; title: string; category: string; type: string; status: string; durationSec?: number | null; endAt?: string | null; startAt?: string | null };
  assignment: { _id: string; status: string; dueAt?: string | null } | null;
  attempt: { _id: string; status: string; attemptNumber: number } | null;
}

export function StudentExams() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "exams", { page }],
    queryFn: async () => {
      const res = await apiGet<ExamListItem[]>("/student/exams", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const startMutation = useMutation({
    mutationFn: async (examId: string) => {
      const res = await apiPost<{ attempt: { _id: string } }>(`/student/exams/${examId}/start`);
      return res.data?.attempt;
    },
    onSuccess: (attempt) => {
      if (attempt) navigate(`/student/exam/${attempt._id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const exams = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My tests</h1>
        <p className="text-sm text-muted-foreground">Assigned examinations</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Available tests</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : exams.length === 0 ? (
            <PanelEmptyState title="No tests assigned" description="Your teacher will assign tests to you." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map(({ exam, attempt }) => (
                  <TableRow key={exam._id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{exam.category}</TableCell>
                    <TableCell className="text-muted-foreground">{exam.durationSec ? formatDuration(exam.durationSec) : "—"}</TableCell>
                    <TableCell>
                      {attempt ? (
                        <Badge variant={attempt.status === "IN_PROGRESS" ? "secondary" : "outline"}>
                          {attempt.status.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{exam.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{exam.endAt ? formatDate(exam.endAt) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {attempt && ["SUBMITTED", "UNDER_REVIEW", "GRADED", "PUBLISHED"].includes(attempt.status) ? (
                        <Button size="sm" variant="outline" onClick={() => navigate("/student/results")}>View result</Button>
                      ) : (
                        <Button size="sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate(exam._id)}>
                          <Play className="size-4" /> {attempt?.status === "IN_PROGRESS" ? "Resume" : "Start"}
                        </Button>
                      )}
                    </TableCell>
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
