import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send, Users, Paperclip, RotateCcw, ClipboardPen } from "lucide-react";
import { assignmentsApi } from "../../api/courses";
import { apiGet } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { Spinner } from "../../components/ui/feedback";
import { AssignmentGradeDialog, type AssignmentSubmissionRow } from "../../components/assignments/AssignmentGradeDialog";
import { getErrorMessage, formatDate, titleCase } from "../../utils";

interface AssignmentRow {
  _id: string;
  title: string;
  description: string;
  instructions?: string;
  submissionType?: string;
  dueAt?: string | null;
  maxMarks?: number;
  status: string;
  published: boolean;
  studentIds?: string[];
  batchIds?: string[];
  submissionCount?: number;
  pendingCount?: number;
  gradedCount?: number;
  createdAt: string;
}

function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface StudentRow { _id: string; firstName?: string; lastName?: string; email?: string }
interface BatchRow { _id: string; name: string }

export function TeacherAssignments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grading, setGrading] = useState<AssignmentSubmissionRow | null>(null);

  const studentsQuery = useQuery({
    queryKey: ["teacher", "students", "all"],
    queryFn: async () => {
      const res = await apiGet<StudentRow[]>("/teacher/students", { limit: 500 });
      return res.data ?? [];
    },
  });
  const batchesQuery = useQuery({
    queryKey: ["teacher", "batches", "all"],
    queryFn: async () => {
      const res = await apiGet<BatchRow[]>("/teacher/batches", { limit: 500 });
      return res.data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "assignments"],
    queryFn: async () => {
      const res = await assignmentsApi.listTeacher({ limit: 100 });
      return res.data ?? [];
    },
  });

  const { data: submissions, isLoading: subsLoading } = useQuery({
    queryKey: ["teacher", "assignment", "submissions", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const res = await assignmentsApi.listSubmissions(selectedId, { limit: 100 });
      return (res.data ?? []) as AssignmentSubmissionRow[];
    },
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => assignmentsApi.create(payload),
    onSuccess: () => { toast.success("Assignment created"); setOpen(false); qc.invalidateQueries({ queryKey: ["teacher", "assignments"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) => assignmentsApi.update(payload.id, payload.body),
    onSuccess: () => { toast.success("Assignment updated"); setEditing(null); qc.invalidateQueries({ queryKey: ["teacher", "assignments"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => assignmentsApi.publish(id),
    onSuccess: () => { toast.success("Assignment published"); qc.invalidateQueries({ queryKey: ["teacher", "assignments"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assignmentsApi.delete(id),
    onSuccess: () => { toast.success("Assignment deleted"); qc.invalidateQueries({ queryKey: ["teacher", "assignments"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const gradeMutation = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) => assignmentsApi.gradeSubmission(payload.id, payload.body),
    onSuccess: () => { toast.success("Submission graded"); setGrading(null); qc.invalidateQueries({ queryKey: ["teacher", "assignment", "submissions", selectedId] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      title: fd.get("title"),
      description: fd.get("description") || "",
      instructions: fd.get("instructions") || "",
      maxMarks: Number(fd.get("maxMarks")) || 100,
      submissionType: (fd.get("submissionType") as string) || "TEXT",
      dueAt: fd.get("dueAt") ? new Date(String(fd.get("dueAt"))).toISOString() : undefined,
      studentIds: fd.getAll("studentIds") as string[],
      batchIds: fd.getAll("batchIds") as string[],
    };
    if (editing) updateMutation.mutate({ id: editing._id, body: payload });
    else createMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground">Create, assign and grade coursework</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> New assignment</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Assignments</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <TableSkeleton rows={5} /> : !data?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max marks</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody><TableEmptyState colSpan={5} title="No assignments yet" /></TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max marks</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a) => {
                    const row = a as unknown as AssignmentRow;
                    return (
                      <TableRow key={row._id} className={selectedId === row._id ? "bg-primary/5" : ""}>
                        <TableCell>
                          <button className="font-medium hover:underline" onClick={() => setSelectedId(row._id)}>{row.title}</button>
                          {row.published ? null : <div className="text-xs text-amber-600">Unpublished draft</div>}
                          {typeof row.pendingCount === "number" && row.pendingCount > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                              <ClipboardPen className="size-3" /> {row.pendingCount} awaiting review
                            </div>
                          )}
                          {(row.submissionCount ?? 0) > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {row.submissionCount} submission{row.submissionCount === 1 ? "" : "s"}
                              {typeof row.gradedCount === "number" && row.gradedCount > 0 ? ` · ${row.gradedCount} graded` : ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={row.published ? "success" : "warning"}>{row.published ? titleCase(row.status) : "DRAFT"}</Badge></TableCell>
                        <TableCell>{row.maxMarks ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.dueAt ? formatDate(row.dueAt) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" title="Edit" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="size-3.5" /></Button>
                            {!row.published && (
                              <Button variant="ghost" size="icon" className="size-7" title="Publish" onClick={() => publishMutation.mutate(row._id)}><Send className="size-3.5 text-emerald-600" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="size-7" title="Delete" onClick={() => { if (confirm("Delete this assignment?")) deleteMutation.mutate(row._id); }}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-brand-600" /> Submissions {selectedId ? "for assignment" : ""}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!selectedId ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody><TableEmptyState colSpan={5} title="Select an assignment" description="Click an assignment title to view its submissions." /></TableBody>
              </Table>
            ) : subsLoading ? <TableSkeleton rows={4} /> : !submissions?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody><TableEmptyState colSpan={5} title="No submissions yet" /></TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((s) => {
                    const st = typeof s.studentId === "string" ? null : s.studentId;
                    const hasFiles = (s.files?.length ?? 0) > 0;
                    return (
                      <TableRow key={s._id}>
                        <TableCell className="font-medium">{st ? `${st.firstName ?? ""} ${st.lastName ?? ""}` : "Student"}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "RETURNED" ? "warning" : "secondary"}>{titleCase(s.status)}</Badge>
                          {hasFiles && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground" title="Has attachments"><Paperclip className="size-3" /></span>}
                        </TableCell>
                        <TableCell>{s.marks != null ? `${s.marks}/${s.maxMarks ?? "—"}` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.submittedAt ? formatDate(s.submittedAt) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setGrading(s)}><RotateCcw className="size-3.5" /> Review / Grade</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AssignmentDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        students={studentsQuery.data ?? []}
        batches={batchesQuery.data ?? []}
      />

      <AssignmentGradeDialog submission={grading} onClose={() => setGrading(null)} onSubmit={(body) => grading && gradeMutation.mutate({ id: grading._id, body })} submitting={gradeMutation.isPending} />
    </div>
  );
}

function AssignmentDialog({ open, onOpenChange, editing, onSubmit, submitting, students, batches }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AssignmentRow | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  students: StudentRow[];
  batches: BatchRow[];
}) {
  const selectedStudents = new Set((editing?.studentIds ?? []) as string[]);
  const selectedBatches = new Set((editing?.batchIds ?? []) as string[]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit assignment" : "New assignment"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5"><Label>Title</Label><Input name="title" required defaultValue={editing?.title ?? ""} /></div>
          <div className="space-y-1.5"><Label>Description</Label><textarea name="description" className="w-full rounded-md border px-3 py-2 text-sm" rows={2} defaultValue={editing?.description ?? ""} /></div>
          <div className="space-y-1.5"><Label>Instructions</Label><textarea name="instructions" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} defaultValue={editing?.instructions ?? ""} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Max marks</Label><Input name="maxMarks" type="number" defaultValue={editing?.maxMarks ?? 100} /></div>
            <div className="space-y-1.5">
              <Label>Submission type</Label>
              <select name="submissionType" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={editing?.submissionType ?? "TEXT"}>
                {["TEXT", "FILE", "TEXT_AND_FILE", "LINK", "AUDIO_VIDEO"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Due date</Label><Input name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(editing?.dueAt)} /></div>
          </div>

          {students.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign to students</Label>
              <div className="max-h-36 overflow-y-auto rounded-md border p-2">
                {students.map((s) => (
                  <label key={s._id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input type="checkbox" name="studentIds" value={s._id} defaultChecked={selectedStudents.has(s._id)} className="size-4" />
                    {s.firstName} {s.lastName} ({s.email})
                  </label>
                ))}
              </div>
            </div>
          )}

          {batches.length > 0 && (
            <div className="space-y-1.5">
              <Label>Or assign to batches</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                {batches.map((b) => (
                  <label key={b._id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input type="checkbox" name="batchIds" value={b._id} defaultChecked={selectedBatches.has(b._id)} className="size-4" />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={submitting}>{submitting ? <Spinner className="size-4" /> : null} {editing ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
