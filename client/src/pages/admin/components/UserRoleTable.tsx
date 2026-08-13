import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../../api/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import { TableToolbar, Pagination, PanelEmptyState, TableSkeleton } from "../../../components/ui/table-toolbar";
import { Spinner } from "../../../components/ui/feedback";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { getErrorMessage, formatDate } from "../../../utils";

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: string;
  role: string;
  avatarUrl?: string | null;
  createdAt: string;
  toeflRole?: string;
  qualification?: string;
}

export function UserRoleTable({ role, title, basePath, resource }: { role: string; title: string; basePath: string; resource: "TEACHER" | "STUDENT" }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState(generateTemporaryPassword);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const listQuery = useQuery({
    queryKey: [basePath, "users", { page, search }],
    queryFn: async () => {
      const res = await apiGet<UserRow[]>(basePath, { page, limit: 10, search });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiPost(basePath, payload);
      return res;
    },
    onSuccess: () => {
      toast.success(`${title} created`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: [basePath, "users"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`${basePath}/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: [basePath, "users"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetPw = useMutation({
    mutationFn: async (id: string) => {
      const tempPassword = generateTemporaryPassword();
      const res = await apiPatch(`${basePath}/${id}/reset-password`, { password: tempPassword });
      return { res, tempPassword };
    },
    onSuccess: (data) => toast.success(`Password reset. Temporary password: ${data.tempPassword}`),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const users = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      password: fd.get("password"),
      phone: fd.get("phone") || null,
      role: resource,
      ...(resource === "TEACHER" ? { qualification: fd.get("qualification") || "" } : {}),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">Manage {title.toLowerCase()}</p>
        </div>
        <Button onClick={() => { setTempPassword(generateTemporaryPassword()); setOpen(true); }}><Plus className="size-4" /> Add {title}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title} list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableToolbar searchPlaceholder={`Search ${title.toLowerCase()}...`} search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} />
          {listQuery.isLoading ? (
            <TableSkeleton rows={6} />
          ) : users.length === 0 && !listQuery.isLoading ? (
            <PanelEmptyState title="No users found" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><StatusBadge status={u.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => resetPw.mutate(u.id)} title="Reset password"><KeyRound className="size-4" /></Button>
                        <Button variant="ghost" size="icon" disabled={role === "SUPER_ADMIN"} onClick={() => setDeleteTarget(u)} title="Delete"><Trash2 className="size-4" /></Button>
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
          <DialogHeader>
            <DialogTitle>Add {title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input name="lastName" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input name="password" type="text" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" placeholder="Optional" />
            </div>
            {resource === "TEACHER" && (
              <div className="space-y-1.5">
                <Label>Qualification</Label>
                <Input name="qualification" placeholder="Optional" />
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner className="size-4" /> : null} Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete user?"
        description={`${deleteTarget?.firstName} ${deleteTarget?.lastName} (${deleteTarget?.email}) and their data will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export function generateTemporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += chars[arr[i] % chars.length];
  return "Tp!" + s;
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status === "ACTIVE" ? "secondary" : status === "SUSPENDED" ? "destructive" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
