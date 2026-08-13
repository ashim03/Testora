import { useState } from "react";
import { toast } from "sonner";
import { FileText, Star, RotateCcw, Paperclip, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../ui/dialog";
import { Spinner } from "../ui/feedback";

export interface AssignmentSubmissionRow {
  _id: string;
  assignmentId?: { title?: string; _id?: string; maxMarks?: number } | string;
  studentId?: { firstName?: string; lastName?: string; email?: string } | string;
  content?: string;
  files?: string[];
  status: string;
  marks?: number | null;
  maxMarks?: number | null;
  feedback?: string | null;
  returnReason?: string | null;
  submittedAt?: string | null;
  published?: boolean;
}

interface Props {
  submission: AssignmentSubmissionRow | null;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  submitting?: boolean;
}

export function AssignmentGradeDialog({ submission, onClose, onSubmit, submitting }: Props) {
  const [mode, setMode] = useState<"grade" | "return">("grade");
  if (!submission) return null;
  const st = typeof submission.studentId === "string" ? null : submission.studentId;
  const assignment = typeof submission.assignmentId === "string" ? null : submission.assignmentId;
  const max = submission.maxMarks ?? assignment?.maxMarks;
  const files = submission.files ?? [];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Grade submission</DialogTitle></DialogHeader>
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <FileText className="size-4 text-muted-foreground" />
            <span className="font-medium">{st ? `${st.firstName ?? ""} ${st.lastName ?? ""}` : "Student"}</span>
          </div>
          {assignment?.title && <span className="truncate text-xs text-muted-foreground">{assignment.title}</span>}
        </div>
        {submission.content && (
          <div className="mb-3 rounded-md border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Student response</p>
            <p className="whitespace-pre-wrap text-sm">{submission.content}</p>
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-3 rounded-md border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Submitted files</p>
            <div className="flex flex-col gap-1">
              {files.map((f, i) => (
                <a key={i} href={f} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate rounded bg-background px-3 py-2 text-xs text-brand-600 hover:underline">
                  <Paperclip className="size-3.5 shrink-0" />
                  <span className="truncate">{f}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="mb-3 flex items-center gap-2">
          <Button type="button" size="sm" variant={mode === "grade" ? "default" : "outline"} onClick={() => setMode("grade")}><Star className="size-3.5" /> Grade &amp; marks</Button>
          <Button type="button" size="sm" variant={mode === "return" ? "default" : "outline"} onClick={() => setMode("return")}><RotateCcw className="size-3.5" /> Return for revision</Button>
        </div>
        {mode === "grade" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const score = Number(fd.get("score"));
              if (max != null && !Number.isNaN(score) && score > max) {
                toast.error(`Score cannot exceed ${max}`);
                return;
              }
              onSubmit({
                score,
                feedback: (fd.get("feedback") as string) || undefined,
                strengths: (fd.get("strengths") as string)?.split(",").map((s) => s.trim()).filter(Boolean) || [],
                improvements: (fd.get("improvements") as string)?.split(",").map((s) => s.trim()).filter(Boolean) || [],
                published: true,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Score</Label>
                <Input name="score" type="number" step="0.5" min="0" max={max != null ? max : undefined} required defaultValue={submission.marks ?? undefined} />
              </div>
              <div className="space-y-1.5">
                <Label>Max</Label>
                <Input value={max != null ? max : "—"} disabled />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Feedback</Label><textarea name="feedback" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} defaultValue={submission.feedback ?? ""} /></div>
            <div className="space-y-1.5"><Label>Strengths (comma separated)</Label><Input name="strengths" placeholder="Grammar, structure" /></div>
            <div className="space-y-1.5"><Label>Areas to improve (comma separated)</Label><Input name="improvements" placeholder="Vocabulary, cohesion" /></div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={submitting}>{submitting ? <Spinner className="size-4" /> : null} Save grade</Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onSubmit({
                requestResubmission: true,
                returnReason: (fd.get("returnReason") as string) || "Please review and resubmit.",
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5"><Label>Reason / instructions for the student</Label><textarea name="returnReason" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} required placeholder="Explain what to revise..." defaultValue={submission.returnReason ?? ""} /></div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={submitting}>{submitting ? <Spinner className="size-4" /> : <RotateCcw className="size-4" />} Return submission</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}