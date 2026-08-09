import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { Spinner } from "../../components/ui/feedback";
import { getErrorMessage, formatDate } from "../../utils";

interface AssignmentRow {
  _id: string;
  title: string;
  description: string;
  dueAt?: string | null;
  maxMarks?: number;
  createdAt: string;
}

export function TeacherAssignments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "assignments"],
    queryFn: async () => {
      const res = await apiGet<AssignmentRow[]>("/exams/assignments", { limit: 50 });
      return res.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiPost("/exams/assignments", payload),
    onSuccess: () => { toast.success("Assignment created"); setOpen(false); qc.invalidateQueries({ queryKey: ["teacher", "assignments"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get("title"),
      description: fd.get("description") || "",
      maxMarks: Number(fd.get("maxMarks")) || 100,
      dueAt: fd.get("dueAt") ? new Date(String(fd.get("dueAt"))).toISOString() : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground">Create and track assignments</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New assignment</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assignments list</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={5} /> : !data?.length ? (
            <TableEmptyState colSpan={4} title="No assignments yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Max marks</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{a.maxMarks ?? "-"}</TableCell>
                    <TableCell>{a.dueAt ? formatDate(a.dueAt) : "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New assignment</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea name="description" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Max marks</Label>
                <Input name="maxMarks" type="number" defaultValue={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input name="dueAt" type="datetime-local" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Spinner className="size-4" /> : null} Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}