import { useQuery } from "@tanstack/react-query";
import { Brain, RefreshCw, Sparkles } from "lucide-react";
import { apiPost } from "../../api/client";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { EmptyState, Spinner } from "../ui/feedback";
import { FeedbackDetail, type AIFeedback } from "./AIFeedbackDetail";

export interface AICheckQuestion { questionId: string; questionTitle: string; prompt: string | null; answer: string; feedback: AIFeedback | null; error: string | null; reused: boolean; }
export interface AICheckResult { attemptId: string; examId: string; examTitle: string; questions: AICheckQuestion[]; }

export function AICheckDialog({ attemptId, examTitle, open, onClose }: { attemptId: string; examTitle: string; open: boolean; onClose: () => void }) {
  const { data, isFetching, error, refetch, isError } = useQuery({
    queryKey: ["student", "attempt-ai-check", attemptId],
    queryFn: async () => (await apiPost<AICheckResult>(`/student/attempts/${attemptId}/ai-check`)).data,
    enabled: open && !!attemptId,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2 pr-6"><Sparkles className="size-4 text-primary" /> AI check: {examTitle}</DialogTitle></DialogHeader>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          {isFetching && !data ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Spinner className="size-8 text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your answers with an IELTS/PTE examiner model… this can take up to a minute.</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-destructive">{error instanceof Error ? error.message : "AI check failed. Please try again."}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="size-4" /> Retry</Button>
            </div>
          ) : data ? (
            data.questions.length === 0 ? (
              <EmptyState icon={Brain} title="Nothing to check" description="This attempt has no essay or writing answers that can be checked by AI." />
            ) : (
              data.questions.map((q, i) => (
                <div key={q.questionId} className="rounded-lg border">
                  <div className="border-b p-3">
                    <p className="font-medium">Question {i + 1} · {q.questionTitle}</p>
                    {q.prompt && <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Task prompt</summary><p className="mt-1 whitespace-pre-line">{q.prompt}</p></details>}
                    {q.reused && q.feedback && <p className="mt-1 text-xs text-muted-foreground">Previously generated · {q.feedback.createdAt ? new Date(q.feedback.createdAt).toLocaleString() : ""}</p>}
                  </div>
                  <div className="p-4">
                    {q.feedback ? <FeedbackDetail f={q.feedback} /> : q.error ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{q.error}</div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="size-4 text-primary" /> Waiting for AI…</div>
                    )}
                  </div>
                </div>
              ))
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}