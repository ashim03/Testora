import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Power } from "lucide-react";
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
  status: string;
  qualification?: string;
  activeStudentCount: number;
  createdAt: string;
}

interface PageData {
  data: Teacher[];
  pagination: { total: number; pages: number };
}

export function ConsultancyTeachers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["consultancy", "teachers", page, search],
    queryFn: async () => {
      const res = await apiGet<Teacher[]>("/consultancy/teachers", { page, limit: 10, search: search || undefined });
      return { data: res.data ?? [], pagination: res.pagination ?? { total: 0, pages: 1 } } as PageData;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["consultancy", "teachers"] });
    qc.invalidateQueries({ queryKey: ["consultancy", "overview"] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiPost("/consultancy/teachers", payload),
    onSuccess: () => { toast.success("Teacher created"); setOpen(false); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiPatch(`/consultancy/teachers/${id}/status`, { status }),
    onSuccess: (_r, v) => { toast.success(`Teacher ${v.status.toLowerCase()}`); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/consultancy/teachers/${id}`),
    onSuccess: () => { toast.success("Teacher deleted"); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => apiPatch(`/consultancy/teachers/${id}/reset-password`, { password }),
    onSuccess: () => { toast.success("Password reset"); setPasswordTarget(null); setNewPassword(""); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      role: "TEACHER",
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      password: fd.get("password"),
      qualification: fd.get("qualification") || "",
    });
  }

  if (isError) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="text-sm text-muted-foreground">Manage the teachers in your consultancy</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add teacher</Button>
      </div>

      <Card>
        <TableToolbar
          searchPlaceholder="Search teachers..."
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
        />
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="No teachers yet" description="Add your first teacher to get started." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.firstName} {t.lastName}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.qualification || "-"}</TableCell>
                  <TableCell>{t.activeStudentCount}</TableCell>
                  <TableCell><Badge variant={t.status === "ACTIVE" ? "secondary" : t.status === "SUSPENDED" ? "destructive" : "outline"}>{titleCase(t.status)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {t.status === "ACTIVE" ? (
                        <Button variant="ghost" size="icon" title="Suspend" onClick={() => statusMutation.mutate({ id: t.id, status: "SUSPENDED" })}><Power className="size-4" /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Activate" onClick={() => statusMutation.mutate({ id: t.id, status: "ACTIVE" })}><Power className="size-4 text-emerald-600" /></Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 text-xs" title="Reset password" onClick={() => setPasswordTarget(t)}>Reset</Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(t)}><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add teacher</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>First name</Label><Input name="firstName" required /></div>
              <div className="space-y-1.5"><Label>Last name</Label><Input name="lastName" required /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
            <div className="space-y-1.5"><Label>Temporary password</Label><Input name="password" required minLength={8} /></div>
            <div className="space-y-1.5"><Label>Qualification</Label><Input name="qualification" /></div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>Create teacher</Button>
            </DialogFooter>
          </form>
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
        title="Delete teacher?"
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