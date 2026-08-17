import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AudioLines, Award, Clock, Gauge, Mic, AlertTriangle, RefreshCcw, FileText, MessageSquare, Target } from "lucide-react";
import { speakingApi, waitForSpeakingResult } from "../../api/speaking";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { getErrorMessage, formatDateTime, formatAudioTime } from "../../utils";
import { fillerWordBases, transcriptIsFiller } from "../../utils/speaking";

const SKILL_COLORS: Record<string, string> = {
  fluency: "#2563eb",
  grammar: "#0d9488",
  vocabulary: "#7c3aed",
  coherence: "#db2777",
};

function ScoreBar({ label, score, color, hint }: { label: string; score: number; color: string; hint?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: color }} />
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Point({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "negative" | "neutral" }) {
  const icon = tone === "positive" ? "✓" : tone === "negative" ? "!" : "→";
  const cls = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-500" : "text-primary";
  return (
    <div>
      <h4 className={`mb-2 font-semibold ${cls}`}>{icon} {title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={`${title}-${i}`} className="text-sm text-muted-foreground">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function TranscriptBlock({ transcript, fillerWords }: { transcript: string; fillerWords: string[] }) {
  const bases = useMemo(() => fillerWordBases(fillerWords), [fillerWords]);
  const parts = transcript.split(/\b/);
  return (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-4 text-sm leading-6" data-testid="transcript">
      {parts.map((part, i) => (
        <span key={i}>
          {transcriptIsFiller(part, bases) ? (
            <mark className="rounded bg-amber-200 px-0.5 text-amber-900">{part}</mark>
          ) : (
            part
          )}
        </span>
      ))}
    </div>
  );
}

export function SpeakingResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fatal, setFatal] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const startedRef = useRef(false);

  const attempt = useQuery({
    queryKey: ["student", "speaking", "attempt", attemptId],
    queryFn: async () => {
      try {
        return await speakingApi.getAttempt(attemptId!);
      } catch (err) {
        if (!startedRef.current) {
          startedRef.current = true;
          setProcessing(true);
          try {
            const result = await waitForSpeakingResult(attemptId!, (status) => setProcessing(status === "PROCESSING"));
            queryClient.invalidateQueries({ queryKey: ["student", "speaking"] });
            setProcessing(false);
            return result;
          } catch (waitErr) {
            setFatal(getErrorMessage(waitErr));
          }
        }
        setProcessing(false);
        throw err;
      }
    },
    enabled: Boolean(attemptId),
    refetchInterval: (query) => (query.state.data?.status === "PROCESSING" ? 3000 : false),
  });

  useEffect(() => {
    startedRef.current = false;
    setFatal(null);
  }, [attemptId]);

  const retryMutation = async () => {
    try {
      await speakingApi.retryAttempt(attemptId!);
      queryClient.invalidateQueries({ queryKey: ["student", "speaking"] });
      await attempt.refetch();
    } catch (err) {
      setFatal(getErrorMessage(err));
    }
  };

  if (fatal) {
    return (
      <div className="space-y-3">
        <ErrorState message={fatal} />
        <Button onClick={() => navigate("/student/speaking")}><ArrowLeft className="size-4" /> Back to speaking practice</Button>
      </div>
    );
  }
  if (attempt.isLoading || processing) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center" role="status" data-testid="result-processing">
        <Spinner className="size-8 text-primary" />
        <p className="font-medium">Loading your speaking report…</p>
      </div>
    );
  }
  if (attempt.isError || !attempt.data) {
    return (
      <div className="space-y-3">
        <ErrorState message="Could not load this speaking attempt" />
        <Button variant="outline" onClick={() => attempt.refetch()}><RefreshCcw className="size-4" /> Retry</Button>
      </div>
    );
  }

  const data = attempt.data;
  const report = data.report;
  const metrics = data.metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate("/student/speaking")} className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to speaking practice
          </button>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDateTime(data.createdAt)}</p>
        </div>
        <Badge variant={data.status === "COMPLETED" ? "success" : data.status === "PROCESSING" ? "warning" : "destructive"} data-testid="status-badge">
          {data.status === "PROCESSING" ? "Analyzing…" : data.status}
        </Badge>
      </div>

      {data.status === "FAILED" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4" data-testid="attempt-failed">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" /> {data.error || "This attempt failed to process."}
          </p>
          <Button variant="outline" onClick={() => void retryMutation()}>
            <RefreshCcw className="size-4" /> Retry processing
          </Button>
        </div>
      )}

      {data.status === "COMPLETED" && report && (
        <>
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Award className="size-4" /> Overall score</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-6xl font-bold text-primary" data-testid="overall-score">{report.overallScore}</p>
                <p className="mt-1 text-sm text-muted-foreground">out of 100</p>
                {report.estimate ? (
                  <Badge variant="secondary" className="mt-3" data-testid="estimate-badge">
                    Heuristic estimate
                  </Badge>
                ) : (
                  <Badge variant="success" className="mt-3" data-testid="ai-badge">
                    AI-scored
                  </Badge>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{report.disclaimer}</p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Gauge className="size-4" /> Skill breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(Object.keys(report.skillScores) as Array<keyof typeof report.skillScores>)
                  .filter((key) => key !== "overall")
                  .map((key) => (
                    <ScoreBar
                      key={key}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      score={report.skillScores[key]}
                      color={SKILL_COLORS[key] ?? "#2563eb"}
                      hint={key === "fluency" ? "Based on pace, pauses and filler words." : undefined}
                    />
                  ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Clock} label="Speaking duration" value={formatAudioTime(metrics?.durationSec)} />
            <Metric icon={AudioLines} label="Words per minute" value={metrics ? String(metrics.wpm) : "—"} />
            <Metric icon={Mic} label="Filler words" value={metrics ? String(metrics.fillerWordCount) : "—"} />
            <Metric icon={Target} label="Repetitions" value={metrics ? String(metrics.repetitionCount) : "—"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="size-4" /> Feedback</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <Point title="Strengths" items={report.strengths} tone="positive" />
              <Point title="Weaknesses" items={report.weaknesses} tone="negative" />
              <Point title="Recommendations" items={report.recommendations} tone="neutral" />
            </CardContent>
          </Card>

          {data.transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="size-4" /> Transcript</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TranscriptBlock transcript={data.transcript} fillerWords={metrics?.fillerWords ?? []} />
                {metrics && metrics.fillerWords.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Highlighted: {metrics.fillerWords.join(", ")} · {metrics.fillerWordCount} total
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {!data.audioRetained && data.status === "COMPLETED" && (
            <p className="text-xs text-muted-foreground">
              The raw recording was removed after analysis to protect your privacy; the transcript and scores are saved in your history.
            </p>
          )}
        </>
      )}
    </div>
  );
}