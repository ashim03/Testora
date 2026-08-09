import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { formatDate } from "../../utils";

interface BatchRow {
  _id: string;
  name: string;
  courseId?: { _id: string; name?: string } | null;
  studentIds: string[];
  startDate?: string | null;
  endDate?: string | null;
}

export function TeacherBatches() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "batches"],
    queryFn: async () => (await apiGet<BatchRow[]>("/teacher/batches")).data ?? [],
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load batches"} />;
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Batches</h1>
        <p className="text-sm text-muted-foreground">Group your students into batches by course</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Batch list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={5} /> : rows.length === 0 ? (
            <TableEmptyState colSpan={5} title="No batches yet" description="Batches you create will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.courseId?.name ?? "—"}</TableCell>
                    <TableCell>{b.studentIds?.length ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(b.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(b.endDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}