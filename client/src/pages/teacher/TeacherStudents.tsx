import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { formatDate, getErrorMessage } from "../../utils";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
  accessible?: boolean;
}

export function TeacherStudents() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "students", { page }],
    queryFn: async () => {
      const res = await apiGet<StudentRow[]>("/teacher/students", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiPost("/teacher/students", payload),
    onSuccess: () => {
      toast.success("Student ID created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      password: fd.get("password"),
      phone: fd.get("phone") || null,
      role: "STUDENT",
    });
  }

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load students"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My students</h1>
          <p className="text-sm text-muted-foreground">Students currently assigned to you</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add student</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Student list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <PanelEmptyState title="No students yet" description="Assigned students will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell><Badge variant={s.status === "ACTIVE" ? "secondary" : "outline"}>{s.status}</Badge></TableCell>
                    <TableCell>{s.accessible ? <Badge variant="secondary">Accessible</Badge> : <Badge variant="outline">Not assigned</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
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
            <DialogTitle>Create student ID</DialogTitle>
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
              <Input name="password" type="text" defaultValue="Student@12345" required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" placeholder="Optional" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner className="size-4" /> : null} Create student
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
