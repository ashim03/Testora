import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Layers3, Plus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../api/client";
import { courseApi, type CourseRow } from "../../api/courses";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { formatDate, getErrorMessage } from "../../utils";

interface BatchRow {
  _id: string;
  name: string;
  description?: string;
  courseId?: { _id: string; name?: string; code?: string; type?: string } | null;
  studentIds: string[];
  startDate?: string | null;
  endDate?: string | null;
}

interface BatchForm {
  name: string;
  courseId: string;
  startDate: string;
  endDate: string;
  description: string;
}

const emptyForm: BatchForm = {
  name: "",
  courseId: "",
  startDate: "",
  endDate: "",
  description: "",
};

export function TeacherBatches() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BatchForm>(emptyForm);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "batches"],
    queryFn: async () => (await apiGet<BatchRow[]>("/teacher/batches")).data ?? [],
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["teacher", "courses", "batch-options"],
    queryFn: async () => (await courseApi.listTeacherCourses({ limit: 100 })).data ?? [],
  });

  const createBatch = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        courseId: form.courseId,
        description: form.description.trim(),
      };
      if (form.startDate) body.startDate = new Date(`${form.startDate}T00:00:00`).toISOString();
      if (form.endDate) body.endDate = new Date(`${form.endDate}T23:59:59`).toISOString();
      return apiPost("/teacher/batches", body);
    },
    onSuccess: () => {
      toast.success("Batch created");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["teacher", "batches"] });
      qc.invalidateQueries({ queryKey: ["admin", "batches"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rows = useMemo(() => data ?? [], [data]);
  const summary = useMemo(() => ({
    batches: rows.length,
    students: rows.reduce((sum, row) => sum + (row.studentIds?.length ?? 0), 0),
    courses: new Set(rows.map((row) => row.courseId?._id).filter(Boolean)).size,
  }), [rows]);

  function updateField(field: keyof BatchForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Batch name is required");
    if (!form.courseId) return toast.error("Select a course");
    createBatch.mutate();
  }

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load batches"} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Batches</h1>
          <p className="text-sm text-muted-foreground">Create course groups and track the students assigned to each batch.</p>
        </div>
        <CreateBatchDialog
          open={open}
          onOpenChange={setOpen}
          form={form}
          courses={courses}
          onChange={updateField}
          onSubmit={submit}
          loading={createBatch.isPending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="My batches" value={summary.batches} icon={Layers3} />
        <MetricCard title="Grouped students" value={summary.students} icon={Users} />
        <MetricCard title="Courses covered" value={summary.courses} icon={GraduationCap} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Batch list</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Use batches when assigning exams, courses, and assignments.</p>
          </div>
          <Badge variant="secondary">{rows.length} total</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5"><TableSkeleton rows={5} /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Schedule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmptyState colSpan={4} title="No batches yet" description="Create your first batch to group students by course." />
                ) : rows.map((batch) => (
                  <TableRow key={batch._id}>
                    <TableCell>
                      <div className="font-medium">{batch.name}</div>
                      {batch.description ? <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{batch.description}</div> : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{batch.courseId?.name ?? "Unassigned"}</div>
                      <div className="mt-1 flex items-center gap-2">
                        {batch.courseId?.type ? <Badge variant={batch.courseId.type === "IELTS" ? "default" : "secondary"}>{batch.courseId.type}</Badge> : null}
                        {batch.courseId?.code ? <span className="text-xs text-muted-foreground">{batch.courseId.code}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>{batch.studentIds?.length ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(batch.startDate)} - {formatDate(batch.endDate)}</TableCell>
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

function CreateBatchDialog({
  open,
  onOpenChange,
  form,
  courses,
  onChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: BatchForm;
  courses: CourseRow[];
  onChange: (field: keyof BatchForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Create batch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create batch</DialogTitle>
          <DialogDescription>Set up a course group. Students can be added from student management and assignment flows.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input id="batch-name" value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="IELTS Morning Batch A" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="batch-course">Course</Label>
            <select
              id="batch-course"
              value={form.courseId}
              onChange={(event) => onChange("courseId", event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.name} ({course.type})</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="batch-start">Start date</Label>
              <Input id="batch-start" type="date" value={form.startDate} onChange={(event) => onChange("startDate", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="batch-end">End date</Label>
              <Input id="batch-end" type="date" value={form.endDate} onChange={(event) => onChange("endDate", event.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="batch-description">Description</Label>
            <textarea
              id="batch-description"
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              rows={3}
              className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
              placeholder="Timing, level, or notes for this batch"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create batch"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
