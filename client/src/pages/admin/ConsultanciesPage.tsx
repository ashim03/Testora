import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, Ban, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { EmptyState, PageSpinner, ErrorState } from "../../components/ui/feedback";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { getErrorMessage, formatDateTime } from "../../utils";

interface Package {
  id: string;
  name: string;
  studentLimit: number;
  teacherLimit: number;
  price: number;
  currency: string;
}

interface Consultancy {
  id: string;
  name: string;
  code: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  subscriptionStatus: string;
  subscriptionEndDate?: string | null;
  package?: Package | null;
  studentLimit?: number | null;
  teacherLimit?: number | null;
  teacherCount: number;
  studentCount: number;
  daysLeft: number;
  createdAt: string;
  account?: { id: string; email: string; temporaryPassword: string };
}

export function ConsultanciesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Consultancy | null>(null);
  const [deleting, setDeleting] = useState<Consultancy | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; name: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "consultancies"],
    queryFn: async () => {
      const res = await apiGet<Consultancy[]>("/admin/consultancies", { limit: 100 });
      return res.data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "consultancies"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? apiPatch<Consultancy>(`/admin/consultancies/${id}`, payload) : apiPost<Consultancy>(`/admin/consultancies`, payload),
    onSuccess: (res, vars) => {
      if (!vars.id && res.data?.account) {
        setCreatedCreds({
          email: res.data.account.email,
          password: res.data.account.temporaryPassword,
          name: res.data.name as string,
        });
      } else {
        toast.success("Consultancy updated");
      }
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiPatch(`/admin/consultancies/${id}/status`, { status }),
    onSuccess: (_r, v) => { toast.success(`Consultancy ${v.status.toLowerCase()}`); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/admin/consultancies/${id}`),
    onSuccess: () => { toast.success("Consultancy deleted"); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMutation.mutate({
      id: editing?.id,
      payload: {
        name: fd.get("name"),
        code: fd.get("code"),
        contactName: fd.get("contactName") || null,
        contactEmail: fd.get("contactEmail") || null,
        contactPhone: fd.get("contactPhone") || null,
        address: fd.get("address") || null,
      },
    });
  }

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const rows = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Consultancies</h1>
          <p className="text-sm text-muted-foreground">Create and manage consultancy accounts and their subscriptions</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Add consultancy</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No consultancies yet" description="Create your first consultancy account." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <div className="text-xs text-muted-foreground">{c.code}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={c.status === "ACTIVE" ? "secondary" : c.status === "SUSPENDED" ? "destructive" : "outline"}>{c.status}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-lg font-bold">{c.teacherCount}<span className="text-xs font-normal text-muted-foreground">/{c.teacherLimit ?? "∞"}</span></div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Teachers</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-lg font-bold">{c.studentCount}<span className="text-xs font-normal text-muted-foreground">/{c.studentLimit ?? "∞"}</span></div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Students</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <div className="text-lg font-bold">{c.daysLeft}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Days left</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {c.subscriptionStatus === "ACTIVE" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <Ban className="size-3.5 text-rose-600" />
                    )}
                    <span className="text-muted-foreground">
                      {c.subscriptionStatus === "ACTIVE" ? (c.package?.name ?? "Active") : c.subscriptionStatus}
                    </span>
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(c.createdAt).split(",")[0]}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-3.5" /> Edit</Button>
                  {c.status === "ACTIVE" ? (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={() => statusMutation.mutate({ id: c.id, status: "SUSPENDED" })}><Power className="size-3.5" /> Suspend</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => statusMutation.mutate({ id: c.id, status: "ACTIVE" })}><CheckCircle2 className="size-3.5" /> Activate</Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-600" onClick={() => setDeleting(c)}><Trash2 className="size-3.5" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit consultancy" : "Add consultancy"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input name="name" required defaultValue={editing?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input name="code" required defaultValue={editing?.code ?? ""} placeholder="e.g. ACADEMY01" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input name="contactName" defaultValue={editing?.contactName ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email <span className="text-xs text-muted-foreground">(used as login)</span></Label>
              <Input name="contactEmail" type="email" defaultValue={editing?.contactEmail ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact phone</Label>
              <Input name="contactPhone" defaultValue={editing?.contactPhone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input name="address" defaultValue={editing?.address ?? ""} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={saveMutation.isPending}>{editing ? "Save changes" : "Create consultancy"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Delete consultancy?"
        description={`"${deleting?.name}" and its staff/student accounts will be deactivated. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
          setDeleting(null);
        }}
      />

      <Dialog open={!!createdCreds} onOpenChange={(o) => { if (!o) setCreatedCreds(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Consultancy account created</DialogTitle></DialogHeader>
          <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
            <p>Share these credentials with the consultancy admin. The password is shown once.</p>
            <div><span className="text-muted-foreground">Consultancy:</span> <span className="font-semibold">{createdCreds?.name}</span></div>
            <div><span className="text-muted-foreground">Login:</span> <span className="font-semibold">{createdCreds?.email}</span></div>
            <div><span className="text-muted-foreground">Password:</span> <code className="rounded bg-background px-1.5 py-0.5">{createdCreds?.password}</code></div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedCreds(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}