import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send, Archive, Rocket, Pencil } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { ExamBuilder } from "./ExamBuilder";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { TableToolbar, Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { Spinner } from "../../components/ui/feedback";
import { getErrorMessage, formatDate, formatDuration, titleCase } from "../../utils";

interface ExamRow {
  _id: string;
  title: string;
  type: string;
  category: string;
  status: string;
  durationSec?: number | null;
  createdAt: string;
  attemptLimit?: number;
}

export function TeacherExams() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [building, setBuilding] = useState<{ mode: "create" } | { mode: "edit"; id: string } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; title: string; action: "publish" | "archive" } | null>(null);

  const listQuery = useQuery({
    queryKey: ["teacher", "exams", { page, search }],
    queryFn: async () => {
      const res = await apiGet<ExamRow[]>("/exams", { page, limit: 10, search });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["teacher", "students", "assign"],
    queryFn: async () => (await apiGet<Array<{ id: string; firstName: string; lastName: string; email: string }>>("/teacher/students", { limit: 200 })).data ?? [],
    enabled: !!assignId,
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => apiPost(`/exams/${id}/publish`),
    onSuccess: () => { toast.success("Exam published"); qc.invalidateQueries({ queryKey: ["teacher", "exams"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => apiPost(`/exams/${id}/archive`),
    onSuccess: () => { toast.success("Exam archived"); qc.invalidateQueries({ queryKey: ["teacher", "exams"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { examId: string; studentIds: string[] }) => apiPost(`/exams/${payload.examId}/assign`, { studentIds: payload.studentIds }),
    onSuccess: () => {
      toast.success("Exam assigned");
      setAssignId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const exams = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;

  if (building) {
    return (
      <ExamBuilder
        examId={building.mode === "edit" ? building.id : undefined}
        onCancel={() => setBuilding(null)}
        onDone={() => { setBuilding(null); qc.invalidateQueries({ queryKey: ["teacher", "exams"] }); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Examinations</h1>
          <p className="text-sm text-muted-foreground">Create and manage tests. Published PRACTICE / SECTIONAL tests appear in your students' Practice library.</p>
        </div>
        <Button onClick={() => setBuilding({ mode: "create" })}><Plus className="size-4" /> New exam</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Exam list</CardTitle></CardHeader>
        <CardContent className="p-0">
          <TableToolbar searchPlaceholder="Search exams..." search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} />
          {listQuery.isLoading ? (
            <TableSkeleton rows={6} />
          ) : exams.length === 0 ? (
            <PanelEmptyState title="No exams yet" description="Create your first exam to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell>
                      <Badge variant={e.type === "PRACTICE" || e.type === "SECTIONAL" ? "secondary" : "outline"}>
                        {titleCase(e.type)}
                        {(e.type === "PRACTICE" || e.type === "SECTIONAL") && e.status === "PUBLISHED" && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">· practice</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{e.durationSec ? formatDuration(e.durationSec) : "—"}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => setBuilding({ mode: "edit", id: e._id })}><Pencil className="size-4" /></Button>
                        {e.status === "DRAFT" && (
                          <Button variant="ghost" size="icon" title="Publish" onClick={() => setConfirm({ id: e._id, title: e.title, action: "publish" })}><Rocket className="size-4" /></Button>
                        )}
                        {e.status !== "ARCHIVED" && (
                          <Button variant="ghost" size="icon" title="Assign" onClick={() => setAssignId(e._id)}><Send className="size-4" /></Button>
                        )}
                        {e.status !== "ARCHIVED" && (
                          <Button variant="ghost" size="icon" title="Archive" onClick={() => setConfirm({ id: e._id, title: e.title, action: "archive" })}><Archive className="size-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New exam</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Use the full exam builder for sections and question picking.</p>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => { setOpen(false); setBuilding({ mode: "create" }); }}>Open builder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignId} onOpenChange={(o) => { if (!o) setAssignId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign exam</DialogTitle></DialogHeader>
          {studentsQuery.isLoading ? (
            <Spinner />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const ids = new FormData(e.currentTarget).getAll("studentIds") as string[];
                if (assignId && ids.length) assignMutation.mutate({ examId: assignId, studentIds: ids });
              }}
              className="space-y-3"
            >
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {studentsQuery.data?.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <input type="checkbox" name="studentIds" value={s.id} className="accent-brand-600" />
                    {s.firstName} {s.lastName} <span className="text-xs text-muted-foreground">({s.email})</span>
                  </label>
                ))}
                {!studentsQuery.data?.length && <p className="text-sm text-muted-foreground">No students assigned to you yet.</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={assignMutation.isPending}>Assign</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm?.action === "archive" ? "Archive exam?" : "Publish exam?"}
        description={
          confirm?.action === "archive"
            ? `"${confirm?.title}" will be archived and removed from student access. Students with an in-progress attempt can still finish it.`
            : `"${confirm?.title}" will be published. PRACTICE / SECTIONAL tests appear in your students' Practice library.`
        }
        confirmLabel={confirm?.action === "archive" ? "Archive" : "Publish"}
        destructive={confirm?.action === "archive"}
        loading={publishMutation.isPending || archiveMutation.isPending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "archive") archiveMutation.mutate(confirm.id);
          else publishMutation.mutate(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "ACTIVE" || status === "PUBLISHED" || status === "SUBMITTED" || status === "GRADED"
      ? "secondary"
      : status === "SUSPENDED" || status === "ARCHIVED" || status === "DRAFT"
        ? "outline"
        : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
