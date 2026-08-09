import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { formatDate } from "../../utils";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
  accessible?: boolean;
}

export function TeacherStudents() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "students", { page }],
    queryFn: async () => {
      const res = await apiGet<StudentRow[]>("/teacher/students", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load students"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My students</h1>
        <p className="text-sm text-muted-foreground">Students currently assigned to you</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Student list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <TableEmptyState colSpan={5} title="No students yet" description="Assigned students will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell><Badge variant={s.status === "ACTIVE" ? "secondary" : "outline"}>{s.status}</Badge></TableCell>
                    <TableCell>{s.accessible ? <Badge variant="secondary">Accessible</Badge> : <Badge variant="outline">Not assigned</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
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