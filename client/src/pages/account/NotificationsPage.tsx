import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Spinner } from "../../components/ui/feedback";
import { formatDateTime, getErrorMessage } from "../../utils";
import { notificationTarget } from "../../utils/notificationTargets";

interface NotificationRow {
  _id: string;
  type?: string;
  title: string;
  body?: string;
  message?: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const url = "/notifications";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const res = await apiGet<NotificationRow[]>(url, { limit: 50 });
      return res.data ?? [];
    },
    enabled: !!user,
  });

  async function markAllRead() {
    try {
      await apiPost(`${url}/read-all`);
      toast.success("All notifications marked as read");
      void refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function markRead(id: string) {
    try {
      await apiPatch(`${url}/${id}/read`);
      toast.success("Notification marked as read");
      void refetch();
    } catch {
      /* ignore */
    }
  }

  async function openNotification(notification: NotificationRow) {
    if (!notification.read) {
      await apiPatch(`${url}/${notification._id}/read`).catch(() => undefined);
      void refetch();
    }
    navigate(notificationTarget(notification, user?.role));
  }

  const unread = data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread} unread
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="size-4" /> Mark all read</Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All notifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !data?.length ? (
            <EmptyBell title="Nothing here yet" hint="Results, grades and announcements will appear here." />
          ) : (
            <ul className="divide-y">
              {data.map((n) => (
                <li key={n._id} className={`flex items-start gap-3 px-4 py-3 ${n.read ? "" : "bg-primary/5"}`}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-muted-foreground/40" : "bg-brand-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.read && <Badge variant="secondary" className="text-[10px]">NEW</Badge>}
                    </div>
                    <button type="button" onClick={() => void openNotification(n)} className="block w-full text-left">
                      <p className="text-sm text-muted-foreground">{n.body || n.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
                    </button>
                  </div>
                  {!n.read ? (
                    <Button variant="ghost" size="sm" onClick={() => void markRead(n._id)}>
                      <Check className="size-4" /> Mark read
                    </Button>
                  ) : null}
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
