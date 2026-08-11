import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, GraduationCap, Layers3, Search, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiGet } from "../../api/client";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { formatDate } from "../../utils";

interface AdminBatchRow {
  _id: string;
  name: string;
  description?: string;
  course: { _id: string; name: string; code?: string; type?: string } | null;
  teacher: { _id: string; name: string; email?: string } | null;
  studentCount: number;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
}

interface BatchesResponse {
  rows: AdminBatchRow[];
  summary: {
    totalBatches: number;
    totalStudents: number;
    activeCourses: number;
    courseTypes: Record<string, number>;
  };
}

export function BatchesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "batches"],
    queryFn: async () => (await apiGet<BatchesResponse>("/admin/batches")).data,
  });

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.name, row.course?.name, row.course?.code, row.course?.type, row.teacher?.name, row.teacher?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load batches"} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="text-sm text-muted-foreground">Monitor course-based student groups across every teacher.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search batches..." className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active batches" value={data?.summary.totalBatches ?? 0} icon={Layers3} />
        <MetricCard title="Grouped students" value={data?.summary.totalStudents ?? 0} icon={Users} />
        <MetricCard title="Courses used" value={data?.summary.activeCourses ?? 0} icon={GraduationCap} />
        <MetricCard
          title="IELTS / PTE"
          value={`${data?.summary.courseTypes.IELTS ?? 0} / ${data?.summary.courseTypes.PTE ?? 0}`}
          icon={CalendarDays}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Batch overview</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Read-only view of batches created by teachers.</p>
          </div>
          <Badge variant="secondary">{filtered.length} shown</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5"><TableSkeleton rows={6} /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Schedule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableEmptyState colSpan={5} title="No batches found" description="Create batches from the teacher portal or adjust your search." />
                ) : filtered.map((batch) => (
                  <TableRow key={batch._id}>
                    <TableCell>
                      <div className="font-medium">{batch.name}</div>
                      {batch.description ? <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{batch.description}</div> : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{batch.course?.name ?? "Unassigned"}</div>
                      <div className="mt-1 flex items-center gap-2">
                        {batch.course?.type ? <Badge variant={batch.course.type === "IELTS" ? "default" : "secondary"}>{batch.course.type}</Badge> : null}
                        {batch.course?.code ? <span className="text-xs text-muted-foreground">{batch.course.code}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{batch.teacher?.name || "Unassigned"}</div>
                      {batch.teacher?.email ? <div className="text-xs text-muted-foreground">{batch.teacher.email}</div> : null}
                    </TableCell>
                    <TableCell>{batch.studentCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(batch.startDate)} - {formatDate(batch.endDate)}
                    </TableCell>
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

function MetricCard({ title, value, icon: Icon }: { title: string; value: number | string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
