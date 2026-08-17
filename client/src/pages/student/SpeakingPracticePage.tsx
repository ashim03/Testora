import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2, TrendingUp, AlertTriangle, ArrowRight, Sparkles, XCircle, History } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { SPEAKING_TASK_LABELS, type SpeakingTaskType, type SpeakingAttemptSummary, type SpeakingProgress } from "@testora-platform/shared";
import { speakingApi, waitForSpeakingResult } from "../../api/speaking";
import { VoiceRecorder, isVoiceRecordingSupported } from "../../components/speaking/VoiceRecorder";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, EmptyState, Spinner } from "../../components/ui/feedback";
import { formatDateTime, getErrorMessage, formatAudioTime } from "../../utils";

interface SpeakingTask {
  type: SpeakingTaskType;
  description: string;
  prompt: string;
  suggestedSeconds: number;
}

const TASKS: SpeakingTask[] = [
  {
    type: "FREE_PRACTICE",
    description: "Speak freely about anything for a minute.",
    prompt: "Talk about anything you like for 60–90 seconds. Try to keep going without long pauses.",
    suggestedSeconds: 90,
  },
  {
    type: "IELTS_PART_1",
    description: "Short questions about familiar topics (4–5 minutes).",
    prompt: "Let's talk about your hometown. Where is it? What do you like most about it? Has it changed since you were a child? What could be improved in your hometown?",
    suggestedSeconds: 60,
  },
  {
    type: "IELTS_PART_2",
    description: "A long turn with a cue card (1–2 minutes).",
    prompt: "Describe a person who has influenced you. You should say: who this person is, how you know them, what they have done for you, and explain why they have influenced you so much.",
    suggestedSeconds: 120,
  },
  {
    type: "IELTS_PART_3",
    description: "Discussion on abstract questions (4–5 minutes).",
    prompt: "Why do some people become role models for young people? Do you think media personalities have a positive influence on society? How has the concept of influence changed over the last 50 years?",
    suggestedSeconds: 90,
  },
  {
    type: "PTE_READ_ALOUD",
    description: "Read a text aloud clearly and fluently.",
    prompt: "Read the following text aloud. Recent studies suggest that small daily habits, repeated consistently over time, have a greater impact on long-term success than occasional bursts of intense effort.",
    suggestedSeconds: 40,
  },
  {
    type: "PTE_RETELL_LECTURE",
    description: "Retell a short lecture in your own words.",
    prompt: "Listen to the mini-lecture and retell it: 'Urban gardens reduce heat in cities by cooling the air and absorbing rainwater. They also provide fresh food and improve community wellbeing. City planners in several countries now include green spaces in new housing developments.'",
    suggestedSeconds: 60,
  },
  {
    type: "PTE_DESCRIBE_IMAGE",
    description: "Describe a graph or chart aloud.",
    prompt: "Describe this chart in your own words: 'The line graph shows mobile internet usage from 2015 to 2025. Usage grew slowly until 2018, then rose sharply, reaching 92% of adults by 2025. Rural areas lagged behind cities throughout the period.'",
    suggestedSeconds: 40,
  },
];

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline" | "warning" | "destructive"> = {
  COMPLETED: "success",
  PROCESSING: "warning",
  FAILED: "destructive",
};

interface PracticePanelProps {
  task: SpeakingTask;
  onCreated: (attemptId: string) => void;
}

function PracticePanel({ task, onCreated }: PracticePanelProps) {
  const [recording, setRecording] = useState<{ blob: Blob; durationSec: number } | null>(null);
  const [phase, setPhase] = useState<"record" | "processing" | "failed">("record");
  const [error, setError] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!recording) throw new Error("Nothing recorded yet");
      const file = new File([recording.blob], `speaking-${task.type.toLowerCase()}-${Date.now()}.webm`, { type: recording.blob.type || "audio/webm" });
      const attempt = await speakingApi.createAttempt(
        {
          taskType: task.type,
          title: SPEAKING_TASK_LABELS[task.type],
          prompt: task.prompt,
          durationSec: recording.durationSec,
          file,
        },
        setUploadPercent,
      );
      setPhase("processing");
      setError(null);
      const result = await waitForSpeakingResult(attempt.id, (status) => {
        if (status === "FAILED") setPhase("failed");
      });
      if (result.status === "FAILED") {
        setPhase("failed");
        setError(result.error || "Processing failed");
        return null;
      }
      queryClient.invalidateQueries({ queryKey: ["student", "speaking"] });
      return result;
    },
    onSuccess: (result) => {
      if (result?.id) onCreated(result.id);
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setPhase("failed");
    },
  });

  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" data-testid="speaking-processing">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">Analyzing your recording…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your audio is being transcribed and scored. This usually takes under a minute — the report will open automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{SPEAKING_TASK_LABELS[task.type]}</h3>
        <p className="mb-3 mt-1 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">{task.prompt}</p>
        <p className="text-xs text-muted-foreground">
          Suggested length: {formatAudioTime(task.suggestedSeconds)} · Elapsed time only counts while you are actually recording.
        </p>
      </div>

      {!isVoiceRecordingSupported() && (
        <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <MicOff className="size-4 shrink-0" /> Voice recording is not available in this browser.
        </p>
      )}

      <VoiceRecorder
        maxDurationSec={task.suggestedSeconds}
        minDurationSec={10}
        disabled={mutation.isPending}
        onComplete={(blob, durationSec) => setRecording({ blob, durationSec })}
      />

      {recording && phase === "record" && (
        <div className="flex items-center gap-3">
          <Button onClick={() => mutation.mutate()} disabled={recording.durationSec < 10 || mutation.isPending} data-testid="submit-recording">
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {mutation.isPending ? `Uploading… ${uploadPercent}%` : "Analyze my speaking"}
          </Button>
          <span className="text-xs text-muted-foreground">Recording: {formatAudioTime(recording.durationSec)}</span>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {phase === "failed" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0">
            <span className="font-medium">Upload failed.</span> {error}
            {phase === "failed" && (
              <button type="button" className="ml-2 underline" onClick={() => { setPhase("record"); setError(null); }}>
                Try again
              </button>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

function SkillBreakdown({ progress }: { progress: SpeakingProgress }) {
  const data = useMemo(
    () =>
      progress.skills.map((s) => ({
        name: s.label,
        score: s.score,
        attempts: s.attempts,
        color: s.skill === progress.weakestSkill?.skill ? "#f59e0b" : "#2563eb",
      })),
    [progress],
  );
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="score" name="Skill score" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ progress }: { progress: SpeakingProgress }) {
  const data = progress.trend.map((point, index) => ({ ...point, attempt: index + 1 }));
  if (data.length < 2) {
    return <EmptyState title="Not enough data yet" description="Complete a couple of speaking attempts to see your trend." />;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="attempt" tick={{ fontSize: 12 }} label={{ value: "Attempt", position: "insideBottom", offset: -2, fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="score" name="Overall score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpeakingPracticePage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<SpeakingTask | null>(null);

  const history = useQuery({
    queryKey: ["student", "speaking", "history"],
    queryFn: async () => (await speakingApi.listAttempts(1, 8)).data,
  });
  const progress = useQuery({
    queryKey: ["student", "speaking", "progress"],
    queryFn: () => speakingApi.getProgress(),
  });

  const handleCreated = (attemptId: string) => {
    navigate(`/student/speaking/result/${attemptId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Speaking practice</h1>
        <p className="text-sm text-muted-foreground">
          Record yourself answering a speaking task. Your audio is transcribed, analyzed and scored — including fluency, grammar, vocabulary, coherence and task relevance (staying on topic).
        </p>
      </div>

      {!isVoiceRecordingSupported() && (
        <p className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" /> This browser does not support microphone recording. Use Chrome, Edge, Firefox or Safari on desktop or Android.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((task) => (
          <button
            key={task.type}
            type="button"
            onClick={() => setSelected(selected?.type === task.type ? null : task)}
            className={`rounded-xl border p-4 text-left transition-colors ${selected?.type === task.type ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"}`}
            aria-pressed={selected?.type === task.type}
          >
            <div className="flex items-center justify-between">
              <Mic className="size-5 text-primary" />
              {selected?.type === task.type && <Badge>Selected</Badge>}
            </div>
            <p className="mt-3 font-medium">{SPEAKING_TASK_LABELS[task.type]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
          </button>
        ))}
      </div>

      {selected && <PracticePanel key={selected.type} task={selected} onCreated={handleCreated} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4" /> Progress trend</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.isLoading ? <Spinner className="size-6 text-primary" /> : progress.isError ? <ErrorState message="Could not load progress" /> : <TrendChart progress={progress.data!} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> Skill breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.isLoading ? <Spinner className="size-6 text-primary" /> : progress.isError ? <ErrorState message="Could not load skills" /> : <SkillBreakdown progress={progress.data!} />}
            {progress.data?.weakestSkill && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="size-4 shrink-0" />
                Your weakest skill is <span className="font-medium">{progress.data.weakestSkill.label}</span> ({progress.data.weakestSkill.score}/100). The learning profile has been updated so future practice recommendations target it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="size-4" /> Recent attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Spinner className="size-6 text-primary" />
          ) : history.isError ? (
            <ErrorState message="Could not load history" />
          ) : (history.data ?? []).length === 0 ? (
            <EmptyState title="No speaking attempts yet" description="Record your first response above to build your history." />
          ) : (
            <div className="space-y-2">
              {(history.data ?? []).map((attempt: SpeakingAttemptSummary) => (
                <button
                  key={attempt.id}
                  type="button"
                  onClick={() => navigate(`/student/speaking/result/${attempt.id}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{attempt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(attempt.createdAt)} · {attempt.status === "PROCESSING" ? "Processing…" : formatAudioTime(attempt.audioDurationSec ?? 0)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {attempt.error && attempt.status === "FAILED" && (
                      <span className="hidden max-w-[180px] truncate text-xs text-destructive sm:block">{attempt.error}</span>
                    )}
                    <Badge variant={STATUS_VARIANT[attempt.status] ?? "outline"}>
                      {attempt.status === "COMPLETED" ? `${attempt.overallScore ?? "—"}/100` : attempt.status}
                    </Badge>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}