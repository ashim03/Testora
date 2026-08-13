import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { EmptyState, PageSpinner, ErrorState } from "../../components/ui/feedback";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { getErrorMessage } from "../../utils";

interface Course {
  _id: string;
  name: string;
  code: string;
  type: "IELTS" | "PTE";
  description: string;
  createdAt: string;
}

export function CoursesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: async () => (await apiGet<Course[]>("/admin/courses")).data ?? [],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "courses"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? apiPatch(`/admin/courses/${id}`, payload) : apiPost("/admin/courses", payload),
    onSuccess: () => {
      toast.success(editing ? "Course updated" : "Course created");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/admin/courses/${id}`),
    onSuccess: () => {
      toast.success("Course deleted");
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      id: editing?._id,
      payload: {
        name: fd.get("name"),
        code: fd.get("code"),
        type: fd.get("type"),
        description: fd.get("description") || "",
      },
    });
  }

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setOpen(true);
  }

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground">Manage IELTS and PTE courses</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Add course</Button>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No courses yet" description="Create your first course." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{c.name}</h3>
                    <div className="text-xs text-muted-foreground">{c.code}</div>
                  </div>
                  <Badge>{c.type}</Badge>
                </div>
                {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
                <div className="mt-3 flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(c)}><Trash2 className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit course" : "Add course"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required defaultValue={editing?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input name="code" required placeholder="IELTS-101" defaultValue={editing?.code ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select name="type" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={editing?.type ?? "IELTS"}>
                <option value="IELTS">IELTS</option>
                <option value="PTE">PTE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea name="description" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} defaultValue={editing?.description ?? ""} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? "Save changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Delete course?"
        description={`"${deleting?.name}" will be hidden and no longer available. Existing enrollments are preserved.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting._id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
