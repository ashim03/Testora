import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox, PenLine, ShieldCheck, RotateCcw, Paperclip, ClipboardPen, Star } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { assignmentsApi } from "../../api/courses";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableToolbar, Pagination, TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { AssignmentGradeDialog, type AssignmentSubmissionRow } from "../../components/assignments/AssignmentGradeDialog";
import { getErrorMessage, formatDateTime, titleCase } from "../../utils";

interface ExamSubmissionRow {
  _id: string;
  examId?: { title?: string; category?: string } | null;
  studentId?: { firstName?: string; lastName?: string; email?: string } | null;
  status: string;
  finalScore?: number | null;
  maxScore?: number | null;
  objectiveScore?: number | null;
  subjectiveScore?: number | null;
  practiceBand?: number | null;
  estimatedPteScore?: number | null;
  updatedAt: string;
}

interface ExamGradeData {
  attempt: {
    _id: string;
    status: string;
    finalScore?: number | null;
    maxScore?: number | null;
    objectiveScore?: number | null;
    attemptNumber: number;
    submittedAt?: string | null;
  };
  exam: { title: string; category: string };
  questions: Array<{
    _id?: string;
    id?: string;
    title: string;
    type: string;
    instructions?: string;
    passage?: string;
    options?: Array<{ key: string; text: string }>;
    marks?: number;
  }>;
  answers: Array<{ questionId: string; answer: unknown; answered: boolean; autoCorrect?: { isCorrect: boolean; earnedScore?: number } | null }>;
}

type SubmissionType = "assignment" | "exam";
type StatusFilter = "PENDING" | "GRADED" | "RETURNED" | "ALL";

const ASSIGN_STATUS_BADGE: Record<string, "secondary" | "outline" | "destructive" | "default" | "warning" | "success"> = {
  SUBMITTED: "secondary",
  RESUBMITTED: "secondary",
  UNDER_REVIEW: "outline",
  GRADED: "default",
  PUBLISHED: "success",
  RETURNED: "warning",
  PENDING: "outline",
};

const EXAM_STATUS_BADGE: Record<string, "secondary" | "outline" | "destructive" | "default" | "warning" | "success"> = {
  SUBMITTED: "secondary",
  UNDER_REVIEW: "outline",
  GRADED: "default",
  PUBLISHED: "success",
  IN_PROGRESS: "outline",
  NOT_STARTED: "outline",
};

const statusesFor = (type: SubmissionType): StatusFilter[] =>
  type === "assignment" ? ["PENDING", "GRADED", "RETURNED", "ALL"] : ["PENDING", "GRADED", "ALL"];

const pendingForAssignment = ["SUBMITTED", "RESUBMITTED", "PENDING"];

export function TeacherSubmissions() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<SubmissionType>("assignment");
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [grading, setGrading] = useState<AssignmentSubmissionRow | null>(null);
  const [reviewingExam, setReviewingExam] = useState<ExamSubmissionRow | null>(null);

  const statusFilter = useMemo(() => {
  if (status === "ALL") return "";
  if (status === "PENDING") return "SUBMITTED,RESUBMITTED,PENDING";
  if (status === "GRADED") return "GRADED,PUBLISHED";
  return status;
}, [status]);

  const assignmentParams = useMemo(
    () => ({
      page,
      limit: 10,
      search,
      status: statusFilter,
      sort: "-submittedAt",
    }),
    [page, search, statusFilter],
  );

  const assignmentQuery = useQuery({
    queryKey: ["grading", "assignments", assignmentParams],
    queryFn: async () => {
      const res = await assignmentsApi.listAllSubmissions(assignmentParams);
      return { data: (res.data ?? []) as AssignmentSubmissionRow[], pagination: res.pagination };
    },
    enabled: type === "assignment",
  });

  const examQuery = useQuery({
    queryKey: ["grading", "exams", { page, search, statusFilter }],
    queryFn: async () => {
      const res = await apiGet<ExamSubmissionRow[]>("/exams/submissions", { page, limit: 10, search, status: statusFilter });
      return { data: res.data ?? [], pagination: res.pagination };
    },
    enabled: type === "exam",
  });

  const gradeMutation = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) => assignmentsApi.gradeSubmission(payload.id, payload.body),
    onSuccess: () => {
      toast.success("Submission graded");
      setGrading(null);
      qc.invalidateQueries({ queryKey: ["grading"] });
      qc.invalidateQueries({ queryKey: ["teacher", "assignment", "submissions"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rows = type === "assignment" ? (assignmentQuery.data?.data ?? []) : (examQuery.data?.data ?? []);
  const isLoading = type === "assignment" ? assignmentQuery.isLoading : examQuery.isLoading;
  const isError = type === "assignment" ? assignmentQuery.isError : examQuery.isError;
  const pagination = type === "assignment" ? assignmentQuery.data?.pagination : examQuery.data?.pagination;

  function switchType(next: SubmissionType) {
    setType(next);
    setPage(1);
    setSearch("");
    setStatus("PENDING");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Grading center</h1>
        <p className="text-sm text-muted-foreground">Review student submissions, provide marks and feedback in one place</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
          <TabButton active={type === "assignment"} onClick={() => switchType("assignment")} icon={<ClipboardPen className="size-4" />} label="Assignments" count={assignmentQuery.data ? (assignmentQuery.data.data ?? []).length : undefined} />
          <TabButton active={type === "exam"} onClick={() => switchType("exam")} icon={<Inbox className="size-4" />} label="Test attempts" count={examQuery.data ? (examQuery.data.data ?? []).length : undefined} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusesFor(type).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => { setStatus(s); setPage(1); }}>
              {s === "ALL" ? "All" : s === "PENDING" ? "Needs review" : titleCase(s)}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {type === "assignment" ? <ClipboardPen className="size-4 text-brand-600" /> : <Inbox className="size-4 text-brand-600" />}
            {type === "assignment" ? "Assignment submissions" : "Test attempt submissions"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableToolbar
            searchPlaceholder={type === "assignment" ? "Search by student or assignment..." : "Search by student or exam..."}
            search={search}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
          />
          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : isError ? (
            <div className="p-4"><ErrorState message="Failed to load submissions" /></div>
          ) : rows.length === 0 ? (
            <Table>
              <TableHeader>
                {type === "assignment" ? (
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                <TableEmptyState
                  colSpan={6}
                  title={status === "PENDING" ? "Nothing awaiting review" : "No submissions found"}
                  description={status === "PENDING" ? "New student submissions will appear here for grading." : "Try adjusting your search or filters."}
                />
              </TableBody>
            </Table>
          ) : type === "assignment" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as AssignmentSubmissionRow[]).map((s) => {
                  const st = typeof s.studentId === "string" ? null : s.studentId;
                  const asgn = typeof s.assignmentId === "string" ? null : s.assignmentId;
                  const hasFiles = (s.files?.length ?? 0) > 0;
                  const needsReview = pendingForAssignment.includes(s.status);
                  return (
                    <TableRow key={s._id}>
                      <TableCell className="font-medium">{st ? `${st.firstName ?? ""} ${st.lastName ?? ""}` : "Student"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="max-w-[200px] truncate">{asgn?.title ?? "Assignment"}</span>
                          {hasFiles && <span className="shrink-0" title="Has attachments"><Paperclip className="size-3 text-muted-foreground" /></span>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={ASSIGN_STATUS_BADGE[s.status] ?? "outline"}>{s.status === "RETURNED" ? "Returned" : titleCase(s.status)}</Badge></TableCell>
                      <TableCell>{s.marks != null ? `${s.marks} / ${s.maxMarks ?? "—"}` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.submittedAt ? formatDateTime(s.submittedAt) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant={needsReview ? "default" : "outline"} size="sm" onClick={() => setGrading(s)}>
                          {needsReview ? <Star className="size-3.5" /> : <PenLine className="size-3.5" />} {needsReview ? "Review & grade" : "Update grade"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as ExamSubmissionRow[]).map((s) => {
                  const needsReview = pendingForAssignment.includes(s.status) || s.status === "UNDER_REVIEW";
                  return (
                    <TableRow key={s._id}>
                      <TableCell className="font-medium">{s.studentId ? `${s.studentId.firstName ?? ""} ${s.studentId.lastName ?? ""}` : "Student"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{s.examId?.title ?? "Exam"}</TableCell>
                      <TableCell><Badge variant={EXAM_STATUS_BADGE[s.status] ?? "outline"}>{titleCase(s.status)}</Badge></TableCell>
                      <TableCell>{s.finalScore != null ? `${s.finalScore}${s.maxScore != null ? ` / ${s.maxScore}` : ""}` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(s.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant={needsReview ? "default" : "outline"} size="sm" onClick={() => setReviewingExam(s)}>
                          {needsReview ? <Star className="size-3.5" /> : <PenLine className="size-3.5" />} {needsReview ? "Review & grade" : "View & edit"}
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

      <AssignmentGradeDialog
        submission={grading}
        onClose={() => setGrading(null)}
        onSubmit={(body) => grading && gradeMutation.mutate({ id: grading._id, body })}
        submitting={gradeMutation.isPending}
      />

      <ExamReviewDialog
        submission={reviewingExam}
        onClose={() => setReviewingExam(null)}
        onGraded={() => {
          setReviewingExam(null);
          qc.invalidateQueries({ queryKey: ["grading"] });
        }}
      />
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      {label}
      {typeof count === "number" && <span className="text-xs text-muted-foreground">({count})</span>}
    </button>
  );
}

function ExamReviewDialog({ submission, onClose, onGraded }: { submission: ExamSubmissionRow | null; onClose: () => void; onGraded: () => void }) {
  const qc = useQueryClient();
  const [score, setScore] = useState<string>("");

  const detail = useQuery({
    queryKey: ["grading", "exam-detail", submission?._id],
    queryFn: async () => (submission ? (await apiGet<ExamGradeData>(`/exams/submissions/${submission._id}`)).data : null),
    enabled: !!submission,
  });

  const gradeMutation = useMutation({
    mutationFn: (body: { score: number; feedback?: string }) => apiPost(`/exams/submissions/${submission?._id}/grade`, body),
    onSuccess: () => {
      toast.success("Grade saved");
      onGraded();
      qc.invalidateQueries({ queryKey: ["grading"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiPost(`/exams/submissions/${submission?._id}/publish`),
    onSuccess: () => {
      toast.success("Result published to student");
      onGraded();
      qc.invalidateQueries({ queryKey: ["grading"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reopenMutation = useMutation({
    mutationFn: () => apiPost(`/exams/submissions/${submission?._id}/reopen`),
    onSuccess: () => {
      toast.success("Attempt reopened for student");
      onGraded();
      qc.invalidateQueries({ queryKey: ["grading"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!submission) return null;
  const data = detail.data;
  const maxScore = data?.attempt.maxScore ?? submission.maxScore ?? data?.attempt.finalScore ?? null;
  const currentScore = score || data?.attempt.finalScore?.toString() || "";
  const submitted = ["GRADED", "PUBLISHED"].includes(submission.status);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review test attempt</DialogTitle>
        </DialogHeader>
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <span className="font-medium">{submission.studentId ? `${submission.studentId.firstName ?? ""} ${submission.studentId.lastName ?? ""}` : "Student"}</span>
            <span className="text-xs text-muted-foreground">{submission.examId?.title}</span>
          </div>
          <Badge variant={EXAM_STATUS_BADGE[submission.status] ?? "outline"}>{titleCase(submission.status)}</Badge>
        </div>

        {detail.isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : detail.isError ? (
          <ErrorState message="Failed to load attempt details" />
        ) : data ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-muted/40 px-4 py-2 text-sm">
              <div><span className="text-muted-foreground">Objective:</span> <span className="font-medium">{data.attempt.objectiveScore ?? 0}</span></div>
              <div><span className="text-muted-foreground">Current total:</span> <span className="font-medium">{data.attempt.finalScore ?? "—"}{maxScore != null && data.attempt.finalScore != null ? ` / ${maxScore}` : ""}</span></div>
              <div><span className="text-muted-foreground">Attempt:</span> <span className="font-medium">#{data.attempt.attemptNumber}</span></div>
              {submission.practiceBand != null && <div><span className="text-muted-foreground">Band:</span> <span className="font-medium">{submission.practiceBand}</span></div>}
              {submission.estimatedPteScore != null && <div><span className="text-muted-foreground">Est. PTE:</span> <span className="font-medium">{submission.estimatedPteScore}</span></div>}
            </div>

            <div className="space-y-3">
              {data.questions.map((q, i) => {
                const ans = data.answers.find((a) => String(a.questionId) === String(q._id ?? q.id));
                const selected: string[] = Array.isArray(ans?.answer) ? ans.answer as string[] : typeof ans?.answer === "string" && ans.answer ? [ans.answer] : [];
                return (
                  <div key={q._id ?? q.id ?? i} className="rounded-md border p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">Q{i + 1}. {q.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{q.marks ?? 1} pt</span>
                    </div>
                    {q.instructions && <p className="mb-1 text-xs text-muted-foreground">{q.instructions}</p>}
                    {q.passage && <div className="mb-2 max-h-28 overflow-y-auto rounded bg-muted/40 p-2 text-xs">{q.passage}</div>}
                    {q.options?.length ? (
                      <div className="space-y-1">
                        {q.options.map((opt) => {
                          const isSelected = selected.includes(opt.key);
                          const isAudio = false;
                          return (
                            <div key={opt.key} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${isSelected ? "bg-brand-50 font-medium text-brand-700" : ""}`}>
                              <span className={`size-3.5 rounded-full border ${isSelected ? "border-brand-600 bg-brand-600" : "border-border"}`} />
                              <span>{opt.text}</span>
                              {isSelected && <span className="ml-auto text-xs text-muted-foreground">selected</span>}
                              {isAudio ? null : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`rounded bg-muted/40 px-3 py-2 text-sm ${ans?.answered ? "" : "text-muted-foreground"}`}>
                        {ans?.answered ? (typeof ans.answer === "string" ? ans.answer : typeof ans.answer === "object" ? JSON.stringify(ans.answer) : "Answered") : "Not answered"}
                      </div>
                    )}
                    {ans?.autoCorrect?.isCorrect != null && (
                      <p className={`mt-1 text-xs ${ans.autoCorrect.isCorrect ? "text-emerald-600" : "text-red-600"}`}>
                        {ans.autoCorrect.isCorrect ? "Auto-checked: correct" : "Auto-checked: incorrect"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                gradeMutation.mutate({ score: Number(fd.get("score")), feedback: (fd.get("feedback") as string) || undefined });
              }}
              className="mt-4 space-y-3 rounded-md border bg-muted/30 p-4"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Manual score {maxScore != null ? `(max ${maxScore})` : ""}</label>
                  <input
                    name="score"
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={currentScore}
                    onChange={(e) => setScore(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Feedback for student</label>
                  <textarea name="feedback" rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Optional feedback on this attempt..." />
                </div>
              </div>
              <DialogFooter className="justify-between sm:justify-between">
                <div className="flex gap-2">
                  {submitted && (
                    <Button type="button" variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
                      <RotateCcw className="size-3.5" /> Reopen
                    </Button>
                  )}
                  {submission.status === "GRADED" && (
                    <Button type="button" variant="outline" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                      <ShieldCheck className="size-3.5" /> Publish result
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <DialogClose asChild><Button type="button" variant="ghost">Close</Button></DialogClose>
                  <Button type="submit" variant={submitted ? "outline" : "default"} disabled={gradeMutation.isPending}>
                    {gradeMutation.isPending ? <Spinner className="size-4" /> : <Star className="size-3.5" />} Save grade
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}