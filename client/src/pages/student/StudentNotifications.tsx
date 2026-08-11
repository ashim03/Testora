import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { formatDateTime } from "../../utils";
import { notificationTarget } from "../../utils/notificationTargets";

interface NotificationRow {
  _id: string;
  type?: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export function StudentNotifications() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "notifications", { page }],
    queryFn: async () => {
      const res = await apiGet<NotificationRow[]>("/student/notifications", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination, unread: res.unread };
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => apiPost("/student/notifications/read-all"),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["student", "notifications"] });
      qc.invalidateQueries({ queryKey: ["header", "notifications"] });
    },
    onError: () => toast.error("Failed to update notifications"),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => apiPatch(`/student/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", "notifications"] });
      qc.invalidateQueries({ queryKey: ["header", "notifications"] });
    },
    onError: () => toast.error("Failed to update notification"),
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load notifications"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const unread = data?.unread ?? 0;

  async function openNotification(notification: NotificationRow) {
    if (!notification.read) {
      await apiPatch(`/student/notifications/${notification._id}/read`).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["student", "notifications"] });
      qc.invalidateQueries({ queryKey: ["header", "notifications"] });
    }
    navigate(notificationTarget(notification, user?.role));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread} unread</p>
        </div>
        <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={unread === 0 || markAllRead.isPending}>
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent notifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <TableEmptyState colSpan={5} title="No notifications" description="You're all caught up." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((n) => (
                  <TableRow key={n._id} className={n.read ? "" : "bg-muted/40"}>
                    <TableCell className="font-medium">
                      <button type="button" onClick={() => void openNotification(n)} className="text-left hover:text-primary">
                        {n.title}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button type="button" onClick={() => void openNotification(n)} className="text-left text-muted-foreground hover:text-foreground">
                        {n.body}
                      </button>
                    </TableCell>
                    <TableCell>{n.read ? "Read" : "New"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(n.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {!n.read ? (
                        <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n._id)} disabled={markRead.isPending}>
                          <Check className="size-4" /> Mark read
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
        </CardContent>
      </Card>
    </div>
  );
}
