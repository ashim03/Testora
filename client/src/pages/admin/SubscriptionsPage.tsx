import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Ban, History } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { EmptyState, PageSpinner, ErrorState } from "../../components/ui/feedback";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { getErrorMessage, formatDateTime } from "../../utils";

interface Package {
  id: string;
  name: string;
  studentLimit: number;
  teacherLimit: number;
  durationDays: number;
  price: number;
  currency: string;
  active: boolean;
}

interface LedgerEntry {
  packageName: string;
  price: number;
  currency: string;
  durationDays: number;
  studentLimit: number;
  teacherLimit: number;
  startDate: string;
  endDate: string;
  assignedAt: string;
  note?: string | null;
}

interface Consultancy {
  id: string;
  name: string;
  code: string;
  status: string;
  subscriptionStatus: string;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  package?: Package | null;
  studentLimit?: number | null;
  teacherLimit?: number | null;
  studentCount: number;
  teacherCount: number;
  ledger?: LedgerEntry[];
}

export function SubscriptionsPage() {
  const qc = useQueryClient();
  const [assignTarget, setAssignTarget] = useState<Consultancy | null>(null);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [historyTarget, setHistoryTarget] = useState<Consultancy | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: async () => (await apiGet<Consultancy[]>("/admin/subscriptions")).data ?? [],
  });

  const { data: packages } = useQuery({
    queryKey: ["admin", "packages"],
    queryFn: async () => (await apiGet<Package[]>("/admin/subscription-packages", { limit: 100 })).data ?? [],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, packageId }: { id: string; packageId: string }) => apiPost(`/admin/consultancies/${id}/assign-package`, { packageId }),
    onSuccess: (_r, v) => {
      toast.success("Subscription activated");
      setAssignTarget(null);
      setSelectedPackage("");
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["admin", "consultancies"] });
      void v;
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions & billing</h1>
          <p className="text-sm text-muted-foreground">Consultancy subscriptions billed in NPR</p>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No consultancies" description="Create a consultancy to start selling subscriptions." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultancy</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Renews / expires</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.code}</div>
                    </TableCell>
                    <TableCell>{c.package?.name ?? "-"}</TableCell>
                    <TableCell>
                      {c.subscriptionStatus === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="size-3.5" /> Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-600"><Ban className="size-3.5" /> {c.subscriptionStatus}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{c.studentCount}/{c.studentLimit ?? "∞"} students</div>
                      <div className="text-muted-foreground">{c.teacherCount}/{c.teacherLimit ?? "∞"} teachers</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.subscriptionEndDate ? formatDateTime(c.subscriptionEndDate) : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setHistoryTarget(c)}>
                          <History className="size-3.5" /> History
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAssignTarget(c); setSelectedPackage(c.package?.id ?? ""); }}>
                          {c.subscriptionStatus === "ACTIVE" ? "Renew / change" : "Assign package"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!assignTarget} onOpenChange={(o) => { if (!o) setAssignTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign subscription package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Activate a package for <span className="font-medium text-foreground">{assignTarget?.name}</span>. A new billing period starts from today.
            </p>
            <div className="space-y-2">
              <Label>Package</Label>
              <div className="space-y-2">
                {(packages ?? []).filter((p) => p.active).map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${selectedPackage === p.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <input type="radio" name="pkg" value={p.id} checked={selectedPackage === p.id} onChange={() => setSelectedPackage(p.id)} className="accent-brand-600" />
                      <span>
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.studentLimit} students · {p.teacherLimit} teachers · {p.durationDays} days</span>
                      </span>
                    </span>
                    <span className="font-semibold text-primary">{p.price.toLocaleString()} {p.currency}</span>
                  </label>
                ))}
                {(packages ?? []).filter((p) => p.active).length === 0 && (
                  <p className="text-sm text-muted-foreground">No active packages. Create one first.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button
              disabled={!selectedPackage || assignMutation.isPending}
              onClick={() => assignTarget && assignMutation.mutate({ id: assignTarget.id, packageId: selectedPackage })}
            >
              Activate subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyTarget} onOpenChange={(o) => { if (!o) setHistoryTarget(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Billing history — {historyTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!historyTarget?.ledger || historyTarget.ledger.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No billing history yet.</TableCell>
                  </TableRow>
                ) : (
                  [...historyTarget.ledger].reverse().map((entry, idx) => (
                    <TableRow key={`${entry.packageName}-${idx}`}>
                      <TableCell className="font-medium">{entry.packageName}</TableCell>
                      <TableCell>{entry.price.toLocaleString()} {entry.currency}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(entry.startDate)} — {formatDateTime(entry.endDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.studentLimit} students · {entry.teacherLimit} teachers</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(entry.assignedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}