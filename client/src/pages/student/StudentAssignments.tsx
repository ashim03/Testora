import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, CheckCircle2, Star } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Pagination, TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { getErrorMessage, formatDate, titleCase } from "../../utils";

interface AssignmentItem {
  assignment: {
    _id: string;
    title: string;
    description?: string;
    instructions?: string;
    status: string;
    dueAt?: string | null;
    maxMarks?: number;
    submissionType?: string;
  };
  submission?: {
    _id: string;
    status: string;
    marks?: number | null;
    maxMarks?: number | null;
    feedback?: string | null;
    strengths?: string[];
    improvements?: string[];
    content?: string;
    submittedAt?: string | null;
  } | null;
}

export function StudentAssignments() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AssignmentItem | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "assignments", { page }],
    queryFn: async () => {
      const res = await apiGet<AssignmentItem[]>("/student/assignments", { page, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => apiPost(`/student/assignments/${id}/submit`, { content }),
    onSuccess: () => {
      toast.success("Assignment submitted");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["student", "assignments"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load assignments"} />;
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground">Submit your coursework and track teacher feedback</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Your assignments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton rows={6} /> : rows.length === 0 ? (
            <TableEmptyState colSpan={6} title="No assignments" description="Assignments from your teacher will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const a = item.assignment;
                  const sub = item.submission;
                  const submitted = sub && sub.status !== "PENDING";
                  return (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>
                        {submitted ? <Badge variant="success"><CheckCircle2 className="mr-1 size-3" /> {titleCase(sub.status)}</Badge> : <Badge variant="outline">Pending</Badge>}
                      </TableCell>
                      <TableCell>{sub?.marks != null ? `${sub.marks}/${sub.maxMarks ?? "—"}` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.dueAt ? formatDate(a.dueAt) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                          {submitted ? <><Star className="size-3.5" /> {sub.status === "PUBLISHED" ? "Feedback" : "View"}</> : <><Send className="size-3.5" /> Submit</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
        </CardContent>
      </Card>

      <DetailDialog
        item={selected}
        onClose={() => setSelected(null)}
        onSubmit={(content) => selected && submitMutation.mutate({ id: selected.assignment._id, content })}
        submitting={submitMutation.isPending}
      />
    </div>
  );
}

function DetailDialog({ item, onClose, onSubmit, submitting }: {
  item: AssignmentItem | null;
  onClose: () => void;
  onSubmit: (content: string) => void;
  submitting: boolean;
}) {
  const [content, setContent] = useState("");
  if (!item) return null;
  const a = item.assignment;
  const sub = item.submission;
  const submitted = sub && sub.status !== "PENDING";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{a.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {a.description ? <p className="text-muted-foreground">{a.description}</p> : null}
          {a.instructions ? <p className="text-muted-foreground">{a.instructions}</p> : null}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Max marks: <strong>{a.maxMarks ?? "—"}</strong></span>
            <span>Type: <strong>{a.submissionType ? titleCase(a.submissionType) : "TEXT"}</strong></span>
            {a.dueAt ? <span>Due: <strong>{formatDate(a.dueAt)}</strong></span> : null}
          </div>

          {submitted && sub ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Submission status</span>
                <Badge variant={sub.status === "PUBLISHED" ? "success" : "secondary"}>{titleCase(sub.status)}</Badge>
              </div>
              {sub.marks != null && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{sub.marks}<span className="text-base text-muted-foreground">/{sub.maxMarks ?? "—"}</span></span>
                  <span className="text-sm text-muted-foreground">marks awarded</span>
                </div>
              )}
              {sub.content ? (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Your response</p>
                  <p className="whitespace-pre-wrap rounded bg-muted/40 p-3">{sub.content}</p>
                </div>
              ) : null}
              {sub.feedback ? (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Teacher feedback</p>
                  <p className="whitespace-pre-wrap rounded bg-muted/40 p-3">{sub.feedback}</p>
                </div>
              ) : null}
              {sub.strengths && sub.strengths.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-emerald-600">Strengths</p>
                  <ul className="list-inside list-disc text-sm">{sub.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {sub.improvements && sub.improvements.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-amber-600">Areas to improve</p>
                  <ul className="list-inside list-disc text-sm">{sub.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); onSubmit(content); }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Your answer</Label>
                <textarea
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your response here..."
                  required
                />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={submitting}>{submitting ? <Spinner className="size-4" /> : <Send className="size-4" />} Submit</Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
