import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { EmptyState, PageSpinner, ErrorState } from "../../components/ui/feedback";
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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: async () => (await apiGet<Course[]>("/admin/courses")).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => apiPost("/admin/courses", payload),
    onSuccess: () => {
      toast.success("Course created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: fd.get("name"),
      code: fd.get("code"),
      type: fd.get("type"),
      description: fd.get("description") || "",
    });
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
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add course</Button>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add course</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input name="code" required placeholder="IELTS-101" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select name="type" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="IELTS">
                <option value="IELTS">IELTS</option>
                <option value="PTE">PTE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea name="description" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}