import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { formatDate, titleCase } from "../../utils";

interface ResultRow {
  _id: string;
  examTitle: string;
  category: string;
  objectiveScore: number | null;
  subjectiveScore: number | null;
  finalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  practiceBand: number | null;
  estimatedPteScore: number | null;
  skillScores?: Record<string, number>;
  published: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

interface ResultDetail {
  result: ResultRow;
  attempt: { _id: string; status: string; attemptNumber: number } | null;
  disclaimer: string;
}

function ResultDetailDialog({ resultId, open, onClose }: { resultId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "result", resultId],
    queryFn: async () => (await apiGet<ResultDetail>(`/student/results/${resultId}`)).data,
    enabled: open && !!resultId,
  });

  const result = data?.result;
  const skills = Object.entries(result?.skillScores ?? {});

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">Result details</DialogTitle>
        </DialogHeader>
        {isLoading || !result ? (
          <div className="flex justify-center py-8"><Spinner className="size-8 text-primary" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{result.examTitle}</p>
              <p className="text-sm text-muted-foreground">{result.category.replace(/_/g, " ")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-lg font-bold">{result.finalScore ?? "-"} / {result.maxScore ?? "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Percentage</p>
                <p className="text-lg font-bold">{result.percentage != null ? `${result.percentage}%` : "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{data?.disclaimer === "PTE" ? "PTE score" : "Practice band"}</p>
                <p className="text-lg font-bold">
                  {result.practiceBand != null ? result.practiceBand.toFixed(1) : result.estimatedPteScore != null ? result.estimatedPteScore : "-"}
                </p>
              </div>
            </div>
            {skills.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Skill breakdown</p>
                <div className="space-y-2">
                  {skills.map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{titleCase(k).replace("IELTS_", "IELTS ").replace("PTE_", "PTE ")}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">Published {formatDate(result.publishedAt ?? result.createdAt)}</span>
              <Badge variant={result.practiceBand != null ? "secondary" : "outline"}>
                {data?.disclaimer === "PTE" ? "PTE" : "IELTS"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Practice scores are indicative only and are not official IELTS or PTE results.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StudentResults() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
        <p className="text-sm text-muted-foreground">Click a row to see the full breakdown for a result</p>
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
                  <TableRow key={r._id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setSelectedId(r._id)}>
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
          {pagination && pagination.pages > 1 && (
            <div className="border-t p-3"><Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} /></div>
          )}
        </CardContent>
      </Card>
      <ResultDetailDialog resultId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}