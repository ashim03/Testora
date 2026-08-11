import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { PageSpinner, ErrorState } from "../../components/ui/feedback";
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
  options?: Array<{ key: string; text: string }>;
  maxWordLimit?: number | null;
  minWordLimit?: number | null;
  marks?: number;
}

interface AttemptData {
  attempt: { _id: string; status: string; expiresAt: string; startedAt: string; attemptNumber: number };
  exam: { title: string; category: string; durationSec?: number | null };
  questions: QuestionView[];
  answers: Array<{ questionId: string; answer: unknown; answered: boolean }>;
  now: string;
}

interface Answer {
  questionId: string;
  answer: unknown;
  answered: boolean;
}

function defaultValue(q: QuestionView): unknown {
  if (AUDIO_QUESTION_TYPES.has(q.type)) return {};
  if (q.type.includes("CHOICE") || q.type.includes("TRUE") || q.type.includes("YES")) return [];
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

  useEffect(() => {
    if (!data) return;
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
    const expires = new Date(data.attempt.expiresAt).getTime();
    setRemaining(Math.max(0, Math.floor((expires - Date.now()) / 1000)));
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
    onError: (err) => toast.error(getErrorMessage(err)),
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
    if (remaining === 0) {
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
  }, [answers, dirty]);

  function updateAnswer(id: string, value: unknown, answered: boolean) {
    setAnswers((prev) => ({ ...prev, [id]: { questionId: id, answer: value, answered } }));
    setDirty(true);
  }

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : undefined} />;

  const hasExpired = remaining != null && remaining === 0;
  const questions = data.questions ?? [];

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background/80 py-2 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">{data.exam.title}</h1>
          <p className="text-xs text-muted-foreground">{data.exam.category.replace(/_/g, " ")} · Attempt #{data.attempt.attemptNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          {remaining != null && remaining <= 60 && !hasExpired && <Badge variant="destructive">Time left: {formatDuration(remaining)}</Badge>}
          {remaining != null && remaining > 60 && !hasExpired && <Badge variant="secondary">Time left: {formatDuration(remaining)}</Badge>}
          {hasExpired && <Badge variant="destructive">Time expired</Badge>}
          <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            Submit
          </Button>
        </div>
      </div>

      {hasExpired ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Your allocated time has ended. Submitting your test now...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {questions.map((q, i) => {
            const id = String(q._id ?? q.id ?? i);
            const current = answers[id];
            return (
              <QuestionCard
                key={id}
                index={i}
                attemptId={QID}
                question={q}
                answer={current?.answer}
                onAnswer={(v, answered) => updateAnswer(id, v, answered)}
              />
            );
          })}
          {questions.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">This test has no questions assigned yet.</CardContent>
            </Card>
          )}
        </div>
      )}
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
  const isChoice = question.type.includes("CHOICE") || question.type.includes("TRUE") || question.type.includes("YES");
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
        {isAudio ? (
          <SpeakingRecorder value={answer} onChange={(v, answered) => onAnswer(v, answered)} />
        ) : isChoice ? (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => {
              const checked = selected.includes(opt.key);
              return (
                <label key={opt.key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted">
                  <input
                    type={question.type === "SINGLE_CHOICE" || question.type.includes("TRUE") || question.type.includes("YES") ? "radio" : "checkbox"}
                    checked={checked}
                    onChange={() => {
                      const multi = question.type === "MULTIPLE_CHOICE" || question.type === "MULTIPLE_ANSWER";
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