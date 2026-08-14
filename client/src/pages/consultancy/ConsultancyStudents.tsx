import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Power, UserPlus } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { EmptyState, ErrorState } from "../../components/ui/feedback";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableToolbar, TableSkeleton } from "../../components/ui/table-toolbar";
import { getErrorMessage, formatDateTime, titleCase } from "../../utils";

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  teacherId?: string | null;
  batchId?: string | null;
  createdAt: string;
}

interface PageData {
  data: Student[];
  pagination: { total: number; pages: number };
}

export function ConsultancyStudents() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState("");
  const [assignStudent, setAssignStudent] = useState<Student | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["consultancy", "students", page, search],
    queryFn: async () => {
      const res = await apiGet<Student[]>("/consultancy/students", { page, limit: 10, search: search || undefined });
      return { data: res.data ?? [], pagination: res.pagination ?? { total: 0, pages: 1 } } as PageData;
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ["consultancy", "teachers", "all"],
    queryFn: async () => (await apiGet<Teacher[]>("/consultancy/teachers", { limit: 100 })).data ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["consultancy", "students"] });
    qc.invalidateQueries({ queryKey: ["consultancy", "overview"] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiPost("/consultancy/students", payload),
    onSuccess: () => { toast.success("Student created"); setOpen(false); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiPatch(`/consultancy/students/${id}/status`, { status }),
    onSuccess: (_r, v) => { toast.success(`Student ${v.status.toLowerCase()}`); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/consultancy/students/${id}`),
    onSuccess: () => { toast.success("Student deleted"); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => apiPatch(`/consultancy/students/${id}/reset-password`, { password }),
    onSuccess: () => { toast.success("Password reset"); setPasswordTarget(null); setNewPassword(""); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ studentIds, teacherId }: { studentIds: string[]; teacherId: string }) =>
      apiPost("/consultancy/students/assign", { studentIds, teacherId }),
    onSuccess: () => { toast.success("Student assigned to teacher"); setAssignOpen(false); setAssignStudent(null); setAssignTeacher(""); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      role: "STUDENT",
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      password: fd.get("password"),
      teacherId: fd.get("teacherId") || null,
    });
  }

  if (isError) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">Manage the students in your consultancy</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add student</Button>
      </div>

      <Card>
        <TableToolbar
          searchPlaceholder="Search students..."
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
        />
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="No students yet" description="Add your first student to get started." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((s) => {
                const teacher = (teachers ?? []).find((t) => t.id === s.teacherId);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned"}</TableCell>
                    <TableCell><Badge variant={s.status === "ACTIVE" ? "secondary" : s.status === "SUSPENDED" ? "destructive" : "outline"}>{titleCase(s.status)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" title="Assign teacher" onClick={() => { setAssignStudent(s); setAssignTeacher(s.teacherId ?? ""); setAssignOpen(true); }}><UserPlus className="size-3.5" /></Button>
                        {s.status === "ACTIVE" ? (
                          <Button variant="ghost" size="icon" title="Suspend" onClick={() => statusMutation.mutate({ id: s.id, status: "SUSPENDED" })}><Power className="size-4" /></Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Activate" onClick={() => statusMutation.mutate({ id: s.id, status: "ACTIVE" })}><Power className="size-4 text-emerald-600" /></Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 text-xs" title="Reset password" onClick={() => setPasswordTarget(s)}>Reset</Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(s)}><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First name</Label><Input name="firstName" required /></div>
              <div className="space-y-1.5"><Label>Last name</Label><Input name="lastName" required /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
            <div className="space-y-1.5"><Label>Temporary password</Label><Input name="password" required minLength={8} /></div>
            <div className="space-y-1.5">
              <Label>Assign teacher (optional)</Label>
              <select name="teacherId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Unassigned</option>
                {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>Create student</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={(o) => { if (!o) { setAssignOpen(false); setAssignStudent(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign to teacher</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Assign {assignStudent?.firstName} {assignStudent?.lastName} to a teacher.</p>
          <div className="space-y-1.5">
            <Label>Teacher</Label>
            <select value={assignTeacher} onChange={(e) => setAssignTeacher(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select teacher</option>
              {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button disabled={!assignTeacher || assignMutation.isPending} onClick={() => assignStudent && assignMutation.mutate({ studentIds: [assignStudent.id], teacherId: assignTeacher })}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordTarget} onOpenChange={(o) => { if (!o) setPasswordTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Set a new password for {passwordTarget?.firstName} {passwordTarget?.lastName}.</p>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="text" minLength={8} placeholder="At least 8 characters" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button disabled={newPassword.length < 8 || resetMutation.isPending} onClick={() => passwordTarget && resetMutation.mutate({ id: passwordTarget.id, password: newPassword })}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Delete student?"
        description={`${deleting?.firstName} ${deleting?.lastName} will be removed from your consultancy and deactivated.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}