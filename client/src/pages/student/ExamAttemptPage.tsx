import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageSpinner, ErrorState } from "../../components/ui/feedback";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { SpeakingRecorder, AUDIO_QUESTION_TYPES } from "../../components/SpeakingRecorder";
import { AudioPlayer, type AudioPlayRules } from "../../components/shared/AudioPlayer";
import { formatDuration, getErrorMessage } from "../../utils";

interface QuestionView {
  _id?: string;
  id?: string;
  title: string;
  type: string;
  instructions?: string;
  passage?: string;
  audioUrl?: string | null;
  audioAssetId?: string | null;
  audioPlayRules?: AudioPlayRules | null;
  imageUrl?: string | null;
  options?: Array<{ key: string; text: string }>;
  maxWordLimit?: number | null;
  minWordLimit?: number | null;
  marks?: number;
}

const CHOICE_QUESTION_TYPES = new Set([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "MULTIPLE_ANSWER",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "HIGHLIGHT_CORRECT_SUMMARY",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "REORDER_PARAGRAPHS",
]);

const SINGLE_ANSWER_TYPES = new Set([
  "SINGLE_CHOICE",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "HIGHLIGHT_CORRECT_SUMMARY",
  "SELECT_MISSING_WORD",
]);

const TERMINAL_ATTEMPT_STATES = new Set(["SUBMITTED", "UNDER_REVIEW", "GRADED", "PUBLISHED"]);

interface AttemptData {
  attempt: { _id: string; status: string; expiresAt: string; startedAt: string; attemptNumber: number };
  exam: {
    title: string;
    category: string;
    durationSec?: number | null;
    sections?: Array<{
      title: string;
      instructions?: string;
      questionIds?: string[];
      audioUrl?: string | null;
      audioAssetId?: string | null;
      audioDuration?: number | null;
      audioPlayRules?: AudioPlayRules | null;
    }>;
  };
  questions: QuestionView[];
  answers: Array<{ questionId: string; answer: unknown; answered: boolean }>;
  now: string;
}

interface Answer {
  questionId: string;
  answer: unknown;
  answered: boolean;
}

interface RenderSection {
  _key: string;
  title: string;
  instructions?: string;
  audioUrl?: string | null;
  audioAssetId?: string | null;
  audioPlayRules?: AudioPlayRules | null;
}

function defaultValue(q: QuestionView): unknown {
  if (AUDIO_QUESTION_TYPES.has(q.type)) return {};
  if (CHOICE_QUESTION_TYPES.has(q.type)) return [];
  return "";
}

export function ExamAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const QID = attemptId ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attempt", QID],
    queryFn: async () => (await apiGet<AttemptData>(`/student/attempts/${QID}`)).data,
    refetchInterval: 60000,
  });

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const hydratedRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!data) return;
    if (TERMINAL_ATTEMPT_STATES.has(data.attempt.status)) {
      toast.info("This attempt has already been submitted");
      navigate("/student/results", { replace: true });
      return;
    }
    if (hydratedRef.current === QID) return;
    hydratedRef.current = QID;
    const initial: Record<string, Answer> = {};
    const qs = data.questions ?? [];
    const known = new Map((data.answers ?? []).map((a) => [String(a.questionId), a]));
    qs.forEach((q, i) => {
      const id = String(q._id ?? q.id ?? i);
      const prev = known.get(id);
      initial[id] = {
        questionId: id,
        answer: prev ? prev.answer : defaultValue(q),
        answered: prev ? prev.answered : false,
      };
    });
    setAnswers(initial);
    setDirty(false);
  }, [data, QID, navigate]);

  useEffect(() => {
    if (!data) return;
    const expires = new Date(data.attempt.expiresAt).getTime();
    const serverOffset = new Date(data.now).getTime() - Date.now();
    setRemaining(Math.max(0, Math.floor((expires - (Date.now() + serverOffset)) / 1000)));
  }, [data]);

  const timerRunning = remaining != null && remaining > 0;

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => setRemaining((r) => (r == null ? null : Math.max(0, r - 1))), 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Answer[]) => {
      await apiPatch(`/student/attempts/${QID}/answers`, {
        answers: payload.map((a) => ({ questionId: a.questionId, answer: a.answer, answered: a.answered })),
      });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setDirty(true);
      if (retryCountRef.current < 5) {
        retryCountRef.current += 1;
        setRetryTick((t) => t + 1);
      }
    },
    onSuccess: () => {
      retryCountRef.current = 0;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(answers).length) await saveMutation.mutateAsync(Object.values(answers));
      await apiPost(`/student/attempts/${QID}/submit`);
    },
    onSuccess: () => {
      toast.success("Test submitted successfully");
      qc.invalidateQueries({ queryKey: ["student", "exams"] });
      navigate("/student/results");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  useEffect(() => {
    if (remaining == null) return;
    if (remaining === 0 && !submitMutation.isPending && !submitMutation.isSuccess) {
      submitMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  useEffect(() => {
    if (!dirty || Object.keys(answers).length === 0) return;
    const t = setTimeout(() => {
      saveMutation.mutate(Object.values(answers));
      setDirty(false);
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, dirty, retryTick]);

  function updateAnswer(id: string, value: unknown, answered: boolean) {
    setAnswers((prev) => ({ ...prev, [id]: { questionId: id, answer: value, answered } }));
    setDirty(true);
  }

  function renderSections(): Array<{ section: RenderSection | null; questions: Array<{ index: number; q: QuestionView }> }> {
    const d = data!;
    const qs = d.questions ?? [];
    const secs: RenderSection[] = (d.exam.sections ?? []).map((s, i) => ({
      _key: String(i),
      title: s.title || `Section ${i + 1}`,
      instructions: s.instructions || "",
      audioUrl: s.audioUrl || null,
      audioAssetId: s.audioAssetId || null,
      audioPlayRules: s.audioPlayRules || null,
    }));

    const blocks: Array<{ section: RenderSection | null; questions: Array<{ index: number; q: QuestionView }> }> = [];

    if (secs.length) {
      let offset = 0;
      for (const section of secs) {
        const questionIds = d.exam.sections?.[Number(section._key)]?.questionIds ?? [];
        const count = questionIds.length;
        const group: Array<{ index: number; q: QuestionView }> = [];
        for (let k = 0; k < count; k += 1) {
          const q = qs[offset + k];
          if (q) group.push({ index: offset + k, q });
        }
        offset += count;
        blocks.push({ section, questions: group });
      }
      const leftovers: Array<{ index: number; q: QuestionView }> = [];
      for (; offset < qs.length; offset += 1) {
        if (qs[offset]) leftovers.push({ index: offset, q: qs[offset] });
      }
      if (leftovers.length) blocks.push({ section: null, questions: leftovers });
    } else {
      blocks.push({ section: null, questions: qs.map((q, i) => ({ index: i, q })) });
    }

    return blocks;
  }

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const hasExpired = remaining != null && remaining === 0;
  const questions = data.questions ?? [];
  const answeredCount = Object.values(answers).filter((a) => a.answered).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background/80 py-2 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">{data.exam.title}</h1>
          <p className="text-xs text-muted-foreground">{data.exam.category.replace(/_/g, " ")} · Attempt #{data.attempt.attemptNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          {remaining != null && remaining <= 60 && !hasExpired && <Badge variant="destructive">Time left: {formatDuration(remaining)}</Badge>}
          {remaining != null && remaining > 60 && !hasExpired && <Badge variant="secondary">Time left: {formatDuration(remaining)}</Badge>}
          {hasExpired && <Badge variant="destructive">Time expired</Badge>}
          <Button size="sm" onClick={() => setConfirmSubmit(true)} disabled={submitMutation.isPending || hasExpired}>
            Submit
          </Button>
        </div>
      </div>

      {hasExpired ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              {submitMutation.isPending
                ? "Your allocated time has ended. Submitting your test now..."
                : "Your allocated time has ended. Your test could not be submitted automatically."}
            </p>
            {!submitMutation.isPending && (
              <Button size="sm" onClick={() => submitMutation.mutate()}>Retry submission</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {renderSections().map((block, bi) => (
            <div key={block.section?._key ?? `flat-${bi}`} className="space-y-6">
              {block.section && (
                <Card className="border-brand-500/40 bg-muted/20">
                  <CardHeader>
                    <CardTitle className="text-base">{block.section.title || `Section ${bi + 1}`}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {block.section.instructions && <p className="text-sm text-muted-foreground">{block.section.instructions}</p>}
                    {block.section.audioUrl && (
                      <AudioPlayer
                        src={block.section.audioUrl}
                        assetId={block.section.audioAssetId ?? undefined}
                        rules={block.section.audioPlayRules ?? null}
                        storageKey={`${QID}:section:${bi}`}
                        label="Section audio"
                      />
                    )}
                  </CardContent>
                </Card>
              )}
              {block.questions.map((item) => {
                const { index, q } = item;
                const id = String(q._id ?? q.id ?? index);
                const current = answers[id];
                return (
                  <QuestionCard
                    key={id}
                    index={index}
                    attemptId={QID}
                    question={q}
                    answer={current?.answer}
                    onAnswer={(v, answered) => updateAnswer(id, v, answered)}
                  />
                );
              })}
            </div>
          ))}
          {questions.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">This test has no questions assigned yet.</CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit test?</DialogTitle>
            <DialogDescription>
              You have answered {answeredCount} of {questions.length} question{questions.length === 1 ? "" : "s"}.
              {unansweredCount > 0 && ` ${unansweredCount} question${unansweredCount === 1 ? "" : "s"} are still unanswered.`}
              {" "}This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>Continue test</Button>
            <Button onClick={() => { setConfirmSubmit(false); submitMutation.mutate(); }} disabled={submitMutation.isPending}>
              Confirm submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionCard({ index, attemptId, question, answer, onAnswer }: {
  index: number;
  attemptId: string;
  question: QuestionView;
  answer: unknown;
  onAnswer: (value: unknown, answered: boolean) => void;
}) {
  const isChoice = CHOICE_QUESTION_TYPES.has(question.type);
  const isAudio = AUDIO_QUESTION_TYPES.has(question.type);
  const selected: string[] = Array.isArray(answer) ? answer : typeof answer === "string" && answer ? [answer] : [];
  const qid = String(question._id ?? question.id ?? index);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
          <span>{question.title}</span>
          <span className="text-xs font-normal text-muted-foreground">({question.marks ?? 1} pt)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {question.instructions && <p className="text-sm text-muted-foreground">{question.instructions}</p>}
        {question.audioUrl && (
          <AudioPlayer
            src={question.audioUrl}
            assetId={question.audioAssetId ?? undefined}
            rules={question.audioPlayRules ?? null}
            storageKey={`${attemptId}:${qid}`}
          />
        )}
        {question.passage && (
          <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">{question.passage}</div>
        )}
        {question.imageUrl && (
          <div className="overflow-hidden rounded-md border bg-muted/30">
            <img src={question.imageUrl} alt={question.title} className="max-h-80 w-full object-contain" />
          </div>
        )}
        {isAudio ? (
          <SpeakingRecorder value={answer} onChange={(v, answered) => onAnswer(v, answered)} />
        ) : isChoice ? (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => {
              const checked = selected.includes(opt.key);
              return (
                <label key={opt.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted">
                  <input
                    type={SINGLE_ANSWER_TYPES.has(question.type) ? "radio" : "checkbox"}
                    checked={checked}
                    onChange={() => {
                      const multi = !SINGLE_ANSWER_TYPES.has(question.type);
                      if (multi) {
                        const next = checked ? selected.filter((k) => k !== opt.key) : [...selected, opt.key];
                        onAnswer(next, next.length > 0);
                      } else {
                        onAnswer(opt.key, true);
                      }
                    }}
                    className="accent-brand-600"
                  />
                  <span>{opt.text}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={typeof answer === "string" && answer.length > 120 ? 6 : 3}
            value={typeof answer === "string" ? answer : ""}
            placeholder="Type your response..."
            onChange={(e) => onAnswer(e.target.value, e.target.value.trim().length > 0)}
          />
        )}
      </CardContent>
    </Card>
  );
}
