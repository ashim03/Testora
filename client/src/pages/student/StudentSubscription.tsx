import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, CreditCard, RefreshCcw } from "lucide-react";
import * as shared from "@testora-platform/shared";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { cn, formatDate, getErrorMessage } from "../../utils";

interface SubscriptionData {
  active: boolean;
  subscription: {
    plan: string;
    status: string;
    startDate: string;
    endDate: string | null;
  } | null;
  daysLeft: number;
  daysTotal: number;
}

const PLANS = shared.SUBSCRIPTION_PLANS as unknown as Array<{
  key: string;
  label: string;
  days: number;
  price: number;
}>;

function toLocalInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function StudentSubscription() {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<string>("MONTHLY");
  const [startDate, setStartDate] = useState<string>(toLocalInputDate(new Date()));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "subscription"],
    queryFn: async () => (await apiGet<SubscriptionData>("/student/subscription")).data,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (payload: { plan: string; startDate: string }) =>
      apiPost("/student/subscription", { ...payload, startDate: new Date(`${payload.startDate}T00:00:00`).toISOString() }),
    onSuccess: () => {
      toast.success("Subscription activated");
      qc.invalidateQueries({ queryKey: ["student", "subscription"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => apiPost("/student/subscription/cancel"),
    onSuccess: () => {
      toast.success("Subscription cancelled");
      qc.invalidateQueries({ queryKey: ["student", "subscription"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load subscription"} />;

  const active = data?.active ?? false;
  const sub = data?.subscription ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-sm text-muted-foreground">Manage your practice plan</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4" /> Current plan</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner className="size-6 text-primary" />
          ) : !sub ? (
            <p className="text-sm text-muted-foreground">You don&apos;t have an active subscription yet. Choose a plan below to get started.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={active ? "secondary" : "destructive"}>{active ? "Active" : sub.status}</Badge>
                <span className="text-lg font-semibold">{sub.plan.replace(/_/g, " ")}</span>
                {active && data && (
                  <span className="text-sm text-muted-foreground">{data.daysLeft} of {data.daysTotal} days remaining</span>
                )}
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="flex items-center gap-2"><CalendarDays className="size-4" /> Starts: {formatDate(sub.startDate)}</span>
                <span className="flex items-center gap-2"><CalendarDays className="size-4" /> Ends: {formatDate(sub.endDate)}</span>
              </div>
              {active && (
                <Button variant="outline" size="sm" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  Cancel subscription
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlan(p.key)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  plan === p.key ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.label}</span>
                  {plan === p.key && <Badge variant="secondary">Selected</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.days} days</p>
                <p className="mt-2 text-xl font-bold">${p.price}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start date</Label>
              <input
                id="start-date"
                type="date"
                className="rounded-md border bg-transparent px-3 py-2 text-sm"
                value={startDate}
                min={toLocalInputDate(new Date())}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <Button disabled={!plan || subscribeMutation.isPending} onClick={() => subscribeMutation.mutate({ plan, startDate })}>
              {subscribeMutation.isPending ? <Spinner className="size-4" /> : <RefreshCcw className="size-4" />} Activate plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}