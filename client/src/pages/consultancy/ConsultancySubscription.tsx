import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Ban, Users, UserCog, Clock, FileText } from "lucide-react";
import { apiGet } from "../../api/client";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { InvoiceDialog } from "../../components/shared/InvoiceDialog";
import { formatDateTime } from "../../utils";

interface Package {
  id: string;
  name: string;
  studentLimit: number;
  teacherLimit: number;
  durationDays: number;
  price: number;
  currency: string;
}

interface Consultancy {
  id: string;
  name: string;
  subscriptionStatus: string;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  package?: Package | null;
  studentLimit?: number | null;
  teacherLimit?: number | null;
  studentCount: number;
  teacherCount: number;
  daysLeft: number;
  ledger?: Array<{
    index: number;
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
  }>;
}

export function ConsultancySubscription() {
  const [invoiceIndex, setInvoiceIndex] = useState<number | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["consultancy", "subscription"],
    queryFn: async () => {
      const res = await apiGet<{ consultancy: Consultancy; packages: Package[] }>("/consultancy/subscription");
      return res.data;
    },
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const c = data.consultancy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscription</h1>
          <p className="text-sm text-muted-foreground">Your consultancy plan and capacity</p>
        </div>
        {c.subscriptionStatus === "ACTIVE" ? (
          <Badge variant="secondary" className="gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-600" /> Active</Badge>
        ) : (
          <Badge variant="destructive" className="gap-1.5"><Ban className="size-3.5" /> {c.subscriptionStatus}</Badge>
        )}
      </div>

      {c.package ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{c.package.name}</div>
                <div className="mt-1 text-3xl font-bold text-primary">
                  {c.package.price.toLocaleString()}<span className="text-sm font-semibold text-muted-foreground"> {c.package.currency}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">per {c.package.durationDays} days</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md bg-muted/40 p-3 text-center">
                  <Users className="mx-auto size-4 text-muted-foreground" />
                  <div className="mt-1 text-lg font-bold">{c.studentCount}/{c.studentLimit}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Students</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-center">
                  <UserCog className="mx-auto size-4 text-muted-foreground" />
                  <div className="mt-1 text-lg font-bold">{c.teacherCount}/{c.teacherLimit}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Teachers</div>
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-center">
                  <Clock className="mx-auto size-4 text-muted-foreground" />
                  <div className="mt-1 text-lg font-bold">{c.daysLeft}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Days left</div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex justify-between border-t py-2"><span className="text-muted-foreground">Started</span><span>{c.subscriptionStartDate ? formatDateTime(c.subscriptionStartDate) : "-"}</span></div>
              <div className="flex justify-between border-t py-2"><span className="text-muted-foreground">Expires</span><span>{c.subscriptionEndDate ? formatDateTime(c.subscriptionEndDate) : "-"}</span></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No subscription yet" description="Your consultancy is on trial. Contact the platform administrator to subscribe." />
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Available packages</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.packages.length === 0 ? (
            <EmptyState title="No packages available" />
          ) : (
            data.packages.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="text-base font-semibold">{p.name}</div>
                  <div className="mt-1 text-2xl font-bold text-primary">{p.price.toLocaleString()}<span className="text-sm text-muted-foreground"> {p.currency}</span></div>
                  <div className="mt-2 text-sm text-muted-foreground">{p.studentLimit} student seats · {p.teacherLimit} teacher seats · {p.durationDays} days</div>
                  <p className="mt-2 text-xs text-muted-foreground">Contact the platform admin to activate a package for your consultancy.</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {c.ledger && c.ledger.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Billing history</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Package</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Period</th>
                      <th className="px-4 py-2.5 font-medium">Seats</th>
                      <th className="px-4 py-2.5 font-medium">Assigned</th>
                      <th className="px-4 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...c.ledger].reverse().map((entry, idx) => (
                      <tr key={`${entry.packageName}-${idx}`}>
                        <td className="px-4 py-2.5 font-medium">{entry.packageName}</td>
                        <td className="px-4 py-2.5">{entry.price.toLocaleString()} {entry.currency}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDateTime(entry.startDate)} — {formatDateTime(entry.endDate)}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{entry.studentLimit} students · {entry.teacherLimit} teachers</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(entry.assignedAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setInvoiceIndex(entry.index)}>
                            <FileText className="size-3.5" /> Invoice
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <InvoiceDialog
        open={invoiceIndex !== null}
        onOpenChange={(o) => { if (!o) setInvoiceIndex(null); }}
        url={invoiceIndex !== null ? `/consultancy/subscription/invoice/${invoiceIndex}` : ""}
      />
    </div>
  );
}