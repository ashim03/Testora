import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { apiGet } from "../../api/client";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableToolbar, Pagination, TableSkeleton } from "../../components/ui/table-toolbar";
import { EmptyState, ErrorState } from "../../components/ui/feedback";
import { formatDate, formatDuration, titleCase } from "../../utils";

const EXAM_TYPES = ["", "MOCK", "PRACTICE", "SECTIONAL", "CUSTOM"];
const STATUSES = ["", "DRAFT", "PUBLISHED", "SCHEDULED", "COMPLETED", "ARCHIVED"];

interface ExamRow {
  _id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  durationSec?: number | null;
  createdBy?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  createdAt?: string;
}

export function ConsultancyExams() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["consultancy", "exams", page, search, type, category, status],
    queryFn: async () => {
      const res = await apiGet<ExamRow[]>("/consultancy/exams", {
        page,
        limit: 10,
        search: search || undefined,
        type: type || undefined,
        category: category || undefined,
        status: status || undefined,
      });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const authorName = (author: ExamRow["createdBy"]) => {
    if (!author) return "—";
    if (typeof author === "string") return author;
    return [author.firstName, author.lastName].filter(Boolean).join(" ") || author.email || "—";
  };

  const statusVariant = (s: string): "success" | "secondary" | "warning" | "outline" | "destructive" => {
    if (s === "PUBLISHED") return "success";
    if (s === "DRAFT") return "secondary";
    if (s === "SCHEDULED") return "warning";
    if (s === "ARCHIVED") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exams &amp; tests</h1>
        <p className="text-sm text-muted-foreground">Tests created by your teachers</p>
      </div>

      <TableToolbar searchPlaceholder="Search tests..." search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by type">
          <option value="">All types</option>
          {EXAM_TYPES.slice(1).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by category">
          <option value="">All categories</option>
          <option value="IELTS_LISTENING">IELTS Listening</option>
          <option value="IELTS_READING">IELTS Reading</option>
          <option value="IELTS_WRITING">IELTS Writing</option>
          <option value="IELTS_SPEAKING">IELTS Speaking</option>
          <option value="PTE_LISTENING">PTE Listening</option>
          <option value="PTE_READING">PTE Reading</option>
          <option value="PTE_WRITING">PTE Writing</option>
          <option value="PTE_SPEAKING">PTE Speaking</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.slice(1).map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
      </TableToolbar>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : "Failed to load tests"} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FileText} title="No tests yet" description="Tests your teachers create will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell className="text-muted-foreground">{titleCase(e.category)}</TableCell>
                    <TableCell><Badge variant="secondary">{titleCase(e.type)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{e.durationSec ? formatDuration(e.durationSec) : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(e.status)}>{titleCase(e.status)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{authorName(e.createdBy)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
      </Card>
    </div>
  );
}