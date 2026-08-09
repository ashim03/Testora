import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Spinner } from "../../components/ui/feedback";
import { formatDateTime, getErrorMessage } from "../../utils";

interface NotificationRow {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const isStudent = user?.role === "STUDENT";
  const url = isStudent ? "/student/notifications" : null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      if (!url) return [] as NotificationRow[];
      const res = await apiGet<NotificationRow[]>(url, { limit: 50 });
      return res.data ?? [];
    },
    enabled: !!url,
  });

  async function markAllRead() {
    if (!url) return;
    try {
      await apiPost(`${url}/read-all`);
      toast.success("All notifications marked as read");
      void refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function markRead(id: string) {
    if (!url) return;
    try {
      await apiPatch(`${url}/${id}/read`);
      void refetch();
    } catch {
      /* ignore */
    }
  }

  const unread = data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {isStudent ? `${unread} unread` : "Stay up to date with platform activity"}
          </p>
        </div>
        {isStudent && unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="size-4" /> Mark all read</Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All notifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !isStudent ? (
            <EmptyBell title="No notifications for this role" hint="System notifications for teachers and admins will appear here." />
          ) : !data?.length ? (
            <EmptyBell title="Nothing here yet" hint="Results, grades and announcements will appear here." />
          ) : (
            <ul className="divide-y">
              {data.map((n) => (
                <li key={n._id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-muted-foreground/40" : "bg-brand-500"}`} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => { if (!n.read) void markRead(n._id); }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.read && <Badge variant="secondary" className="text-[10px]">NEW</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyBell({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Bell className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}