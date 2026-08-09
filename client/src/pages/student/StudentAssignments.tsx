import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { formatDateTime, titleCase } from "../../utils";

interface AssignmentItem {
  assignment: {
    _id: string;
    title: string;
    type?: string;
    status: string;
    dueAt?: string | null;
    maxMarks?: number;
  };
  submission?: unknown;
}

export function StudentAssignments() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "assignments", { page }],
    queryFn: async () => {
      const res = await apiGet<AssignmentItem[]>("/student/assignments", { page, limit: 10 });
      return { data: (res.data ?? []).map((i) => i.assignment), pagination: res.pagination };
    },
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load assignments"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground">Tasks assigned to you by your teacher</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Your assignments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <TableEmptyState colSpan={6} title="No assignments" description="Assignments from your teacher will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max marks</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.type ? titleCase(a.type) : "—"}</TableCell>
                    <TableCell><Badge variant={a.status === "OPEN" ? "secondary" : "outline"}>{titleCase(a.status)}</Badge></TableCell>
                    <TableCell>{a.maxMarks ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(a.dueAt)}</TableCell>
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