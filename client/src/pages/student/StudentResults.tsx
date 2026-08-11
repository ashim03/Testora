import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { formatDate } from "../../utils";

interface ResultRow {
  _id: string;
  examTitle: string;
  category: string;
  finalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
practiceBand: number | null;
  estimatedPteScore: number | null;
  status: string;
  published: boolean;
  createdAt: string;
}

export function StudentResults() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "results", { page }],
    queryFn: async () => {
      const res = await apiGet<ResultRow[]>("/student/results", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load results"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-sm text-muted-foreground">Your published practice results</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Published results</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <PanelEmptyState title="No results yet" description="Published results will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Band / PTE</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="font-medium">{r.examTitle}</TableCell>
                    <TableCell>{r.category.replace(/_/g, " ")}</TableCell>
                    <TableCell>{r.finalScore ?? "-"} / {r.maxScore ?? "-"}</TableCell>
                    <TableCell>{r.percentage != null ? `${r.percentage}%` : "-"}</TableCell>
                    <TableCell>
                      {r.practiceBand != null ? (
                        <Badge variant="secondary">IELTS Practice Band: {r.practiceBand.toFixed(1)}</Badge>
                      ) : r.estimatedPteScore != null ? (
                        <Badge variant="outline">PTE: {r.estimatedPteScore}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.published ? r.createdAt : undefined)}</TableCell>
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
