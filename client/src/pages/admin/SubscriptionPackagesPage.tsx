import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
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

interface Package {
  id: string;
  name: string;
  studentLimit: number;
  teacherLimit: number;
  durationDays: number;
  price: number;
  currency: string;
  description: string;
  features: string[];
  active: boolean;
}

export function SubscriptionPackagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [deleting, setDeleting] = useState<Package | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "packages"],
    queryFn: async () => (await apiGet<Package[]>("/admin/subscription-packages", { limit: 100 })).data ?? [],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "packages"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? apiPatch(`/admin/subscription-packages/${id}`, payload) : apiPost("/admin/subscription-packages", payload),
    onSuccess: (_r, v) => {
      toast.success(v.id ? "Package updated" : "Package created");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => apiPatch(`/admin/subscription-packages/${id}`, { active }),
    onSuccess: () => { toast.success("Package updated"); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/admin/subscription-packages/${id}`),
    onSuccess: () => { toast.success("Package deleted"); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      id: editing?.id,
      payload: {
        name: fd.get("name"),
        studentLimit: Number(fd.get("studentLimit")),
        teacherLimit: Number(fd.get("teacherLimit")),
        durationDays: Number(fd.get("durationDays")),
        price: Number(fd.get("price")),
        description: fd.get("description") || "",
      },
    });
  }

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscription packages</h1>
          <p className="text-sm text-muted-foreground">Billed in NPR. Prices are set per student seat.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Add package</Button>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No packages yet" description="Create a subscription package to sell student capacity." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className={p.active ? "" : "opacity-70"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <div className="text-xs text-muted-foreground">{p.durationDays} days</div>
                  </div>
                  <Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="mt-3 text-2xl font-bold text-primary">
                  {p.price.toLocaleString()}<span className="text-sm font-semibold text-muted-foreground"> {p.currency}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted/40 p-2 text-center">
                    <div className="font-bold">{p.studentLimit}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Student seats</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2 text-center">
                    <div className="font-bold">{p.teacherLimit}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Teacher seats</div>
                  </div>
                </div>
                {p.description && <p className="mt-3 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-3.5" /> Edit</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleMutation.mutate({ id: p.id, active: !p.active })}>
                    <Power className="size-3.5" /> {p.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={() => setDeleting(p)}><Trash2 className="size-3.5" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit package" : "Add package"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required defaultValue={editing?.name ?? ""} placeholder="e.g. Standard 50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Student limit</Label>
                <Input name="studentLimit" type="number" min={1} required defaultValue={editing?.studentLimit ?? 50} />
              </div>
              <div className="space-y-1.5">
                <Label>Teacher limit</Label>
                <Input name="teacherLimit" type="number" min={1} required defaultValue={editing?.teacherLimit ?? 10} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (days)</Label>
                <Input name="durationDays" type="number" min={1} required defaultValue={editing?.durationDays ?? 30} />
              </div>
              <div className="space-y-1.5">
                <Label>Price (NPR)</Label>
                <Input name="price" type="number" min={1} step="any" required defaultValue={editing?.price ?? 18000} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? "Save changes" : "Create package"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Delete package?"
        description={`"${deleting?.name}" cannot be deleted if a consultancy is currently subscribed to it.`}
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