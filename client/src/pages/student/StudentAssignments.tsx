import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, CheckCircle2, Star, Upload, RotateCcw, FileText, X } from "lucide-react";
import { apiGet, apiPost, uploadFile } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
    allowResubmission?: boolean;
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
    files?: string[];
    returnReason?: string | null;
    submittedAt?: string | null;
  } | null;
}

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  FILE: "File upload",
  TEXT_AND_FILE: "Text + file",
  LINK: "Link",
  AUDIO_VIDEO: "Audio / video",
};

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
    mutationFn: async ({ id, content, files, link }: { id: string; content: string; files: string[]; link: string }) => {
      const body: { content: string; files?: string[]; link?: string } = { content };
      if (files.length) body.files = files;
      if (link) body.link = link;
      return apiPost(`/student/assignments/${id}/submit`, body);
    },
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
              <TableBody><TableEmptyState colSpan={5} title="No assignments" description="Assignments from your teacher will appear here." /></TableBody>
            </Table>
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
                  const needsWork = !!sub && (sub.status === "RETURNED" || sub.status === "RESUBMITTED");
                  const submitted = !!sub && sub.status !== "PENDING";
                  return (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>
                        {needsWork ? <Badge variant="warning"><RotateCcw className="mr-1 size-3" /> Needs rework</Badge>
                          : submitted ? <Badge variant="success"><CheckCircle2 className="mr-1 size-3" /> {titleCase(sub.status)}</Badge>
                          : <Badge variant="outline">Pending</Badge>}
                      </TableCell>
                      <TableCell>{sub?.marks != null ? `${sub.marks}/${sub.maxMarks ?? "—"}` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.dueAt ? formatDate(a.dueAt) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                          {needsWork ? <><RotateCcw className="size-3.5" /> Resubmit</>
                            : submitted ? <><Star className="size-3.5" /> {sub.status === "PUBLISHED" ? "Feedback" : "View"}</>
                            : <><Send className="size-3.5" /> Submit</>}
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
        onSubmit={(payload) => selected && submitMutation.mutate({ id: selected.assignment._id, ...payload })}
        submitting={submitMutation.isPending}
      />
    </div>
  );
}

function DetailDialog({ item, onClose, onSubmit, submitting }: {
  item: AssignmentItem | null;
  onClose: () => void;
  onSubmit: (payload: { content: string; files: string[]; link: string }) => void;
  submitting: boolean;
}) {
  const [content, setContent] = useState("");
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  if (!item) return null;
  const a = item.assignment;
  const sub = item.submission;
  const canSubmit = !sub || sub.status === "PENDING" || sub.status === "RETURNED" || sub.status === "RESUBMITTED" || (a.allowResubmission && sub.status === "GRADED");
  const submitted = sub && sub.status !== "PENDING" && sub.status !== "RETURNED" && sub.status !== "RESUBMITTED";
  const stype = (a.submissionType as string) || "TEXT";

  function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPickedFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function submitAll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of pickedFiles) {
        const res = await uploadFile(f, "ASSIGNMENT");
        if (res.url) urls.push(res.url);
      }
      onSubmit({ content, files: urls, link: link.trim() });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{a.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {a.description ? <p className="text-muted-foreground">{a.description}</p> : null}
          {a.instructions ? <p className="text-muted-foreground">{a.instructions}</p> : null}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Max marks: <strong>{a.maxMarks ?? "—"}</strong></span>
            <span>Type: <strong>{SUBMISSION_TYPE_LABELS[stype] ?? titleCase(stype)}</strong></span>
            {a.dueAt ? <span>Due: <strong>{formatDate(a.dueAt)}</strong></span> : null}
          </div>

          {canSubmit ? (
            <form onSubmit={submitAll} className="space-y-4">
              {sub?.returnReason && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>Returned for revision:</strong> {sub.returnReason}
                </div>
              )}
              {(stype === "TEXT" || stype === "TEXT_AND_FILE") && (
                <div className="space-y-1.5">
                  <Label>Your answer</Label>
                  <textarea
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your response here..."
                    required={stype === "TEXT"}
                  />
                </div>
              )}
              {stype === "LINK" && (
                <div className="space-y-1.5">
                  <Label>Submission link</Label>
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
                </div>
              )}
              {(stype === "FILE" || stype === "TEXT_AND_FILE" || stype === "AUDIO_VIDEO") && (
                <div className="space-y-1.5">
                  <Label>
                    {stype === "AUDIO_VIDEO" ? "Audio / video file" : "Attachment"}
                    {stype === "FILE" ? " (required)" : ""}
                  </Label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm hover:bg-muted">
                      <Upload className="size-4" />
                      {uploading ? <Spinner className="size-4" /> : "Choose file"}
                      <input type="file" className="hidden" onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    {pickedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                        <span className="truncate text-xs">{f.name}</span>
                        <button type="button" onClick={() => setPickedFiles(pickedFiles.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={submitting || uploading}>{submitting ? <Spinner className="size-4" /> : <Send className="size-4" />} {sub?.status === "RETURNED" || sub?.status === "RESUBMITTED" ? "Resubmit" : "Submit"}</Button>
              </DialogFooter>
            </form>
          ) : submitted && sub ? (
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
              {sub.files && sub.files.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Your files</p>
                  <div className="flex flex-col gap-1">
                    {sub.files.map((f, i) => (
                      <a key={i} href={f} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate rounded bg-muted/40 px-3 py-2 text-xs text-brand-600 hover:underline"><FileText className="size-3.5" /> {f}</a>
                    ))}
                  </div>
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
            <p className="text-sm text-muted-foreground">No submission yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
