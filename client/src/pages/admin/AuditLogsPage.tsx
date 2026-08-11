import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState } from "../../components/ui/feedback";
import { Badge } from "../../components/ui/badge";
import { formatDateTime, titleCase } from "../../utils";

interface AuditRow {
  _id: string;
  action: string;
  actorId?: { firstName?: string; lastName?: string; email?: string } | null;
  actorRole?: string | null;
  entityType?: string;
  ip?: string | null;
  createdAt: string;
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "audit-logs", { page }],
    queryFn: async () => {
      const res = await apiGet<{ data: AuditRow[]; page: number; pages: number }>("/admin/audit-logs", { page, limit: 15 });
      return { data: res.data?.data ?? [], page: res.data?.page, pages: res.data?.pages };
    },
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load audit logs"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pages && data?.pages > 1 ? { page: data.page ?? 1, pages: data.pages } : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit logs</h1>
        <p className="text-sm text-muted-foreground">Recorded administrative actions</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={10} /> : rows.length === 0 ? (
            <PanelEmptyState title="No audit logs" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell className="font-medium">{a.action}</TableCell>
                    <TableCell>{a.actorId ? `${a.actorId.firstName} ${a.actorId.lastName}` : "System"}</TableCell>
                    <TableCell>{a.actorRole ? <Badge variant="outline">{titleCase(a.actorRole)}</Badge> : "—"}</TableCell>
                    <TableCell>{a.entityType ? titleCase(a.entityType) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.ip ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
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
