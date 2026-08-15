import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { apiGet } from "../../api/client";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableToolbar, Pagination, TableSkeleton } from "../../components/ui/table-toolbar";
import { EmptyState, ErrorState } from "../../components/ui/feedback";
import { formatDate, titleCase } from "../../utils";

interface CourseRow {
  _id: string;
  name: string;
  code: string;
  type: "IELTS" | "PTE";
  level?: string;
  active?: boolean;
  instructorId?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  createdAt?: string;
}

export function ConsultancyCourses() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["consultancy", "courses", page, search, type],
    queryFn: async () => {
      const res = await apiGet<CourseRow[]>("/consultancy/courses", { page, limit: 10, search: search || undefined, type: type || undefined });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const instructorName = (instructor: CourseRow["instructorId"]) => {
    if (!instructor) return "—";
    if (typeof instructor === "string") return instructor;
    return [instructor.firstName, instructor.lastName].filter(Boolean).join(" ") || instructor.email || "—";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Courses</h1>
        <p className="text-sm text-muted-foreground">Courses created by your teachers</p>
      </div>

      <TableToolbar searchPlaceholder="Search courses..." search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by type">
          <option value="">All types</option>
          <option value="IELTS">IELTS</option>
          <option value="PTE">PTE</option>
        </select>
      </TableToolbar>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : "Failed to load courses"} />
        ) : rows.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses yet" description="Courses your teachers create will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.code}</div>
                    </TableCell>
                    <TableCell><Badge variant={c.type === "PTE" ? "outline" : "secondary"}>{c.type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{c.level ? titleCase(c.level) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{instructorName(c.instructorId)}</TableCell>
                    <TableCell>
                      <Badge variant={c.active === false ? "destructive" : "success"}>{c.active === false ? "Inactive" : "Active"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
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