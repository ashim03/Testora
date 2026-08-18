import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet, apiPost } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, EmptyState, Spinner } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { formatDateTime } from "../../utils";
import { FeedbackDetail, type AIFeedback } from "../../components/ai/AIFeedbackDetail";

interface TeacherFeedback { _id: string; teacherId?: { firstName?: string; lastName?: string } | null; content?: string; marks?: number | null; createdAt: string; }

interface BandPoint { label: string; ielts?: number | null; pte?: number | null; }

function BandTrendChart({ rows }: { rows: AIFeedback[] }) {
  const points: BandPoint[] = useMemo(() => {
    const withBands = rows.filter((r) => r.bands && (r.bands.ielts != null || r.bands.pte != null));
    return withBands.slice().reverse().map((r) => ({
      label: new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      ielts: r.bands?.ielts ?? null,
      pte: r.bands?.pte ?? null,
    }));
  }, [rows]);
  if (points.length < 2) return null;
  const hasIelts = points.some((p) => p.ielts != null);
  const hasPte = points.some((p) => p.pte != null);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-primary" /> Band progress</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            {hasIelts && <YAxis yAxisId="ielts" domain={[0, 9]} tick={{ fontSize: 11 }} />}
            {hasPte && <YAxis yAxisId="pte" orientation="right" domain={[0, 90]} tick={{ fontSize: 11 }} />}
            <Tooltip />
            {hasIelts && <Line yAxisId="ielts" type="monotone" dataKey="ielts" name="IELTS band" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
            {hasPte && <Line yAxisId="pte" type="monotone" dataKey="pte" name="PTE estimate" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">Formative estimates only — not official IELTS or PTE Academic scores.</p>
      </CardContent>
    </Card>
  );
}

function HistoryRow({ f, expanded, onToggle }: { f: AIFeedback; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border" data-testid="ai-feedback-row">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40" aria-expanded={expanded}>
        <div className="min-w-0">
          <p className="font-medium">{f.type === "WRITING" ? "Writing" : "Speaking"} · {f.overallScore}/100</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{f.submission}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}{f.annotations?.length ? ` · ${f.annotations.length} corrections` : ""}{f.bands?.ielts != null ? ` · IELTS ${f.bands.ielts}` : ""}</p>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="border-t p-4"><FeedbackDetail f={f} /></div>}
    </div>
  );
}

export function StudentFeedback() {
  const [type, setType] = useState<"WRITING" | "SPEAKING">("WRITING");
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const teacher = useQuery({ queryKey: ["student", "feedback"], queryFn: async () => (await apiGet<TeacherFeedback[]>("/student/feedback")).data ?? [] });
  const history = useQuery({ queryKey: ["student", "ai-feedback"], queryFn: async () => (await apiGet<AIFeedback[]>("/student/feedback/ai/history")).data ?? [] });
  const mutation = useMutation({ mutationFn: async () => (await apiPost<AIFeedback>("/student/feedback/ai", { type, text, prompt: prompt || undefined })).data, onSuccess: () => { setText(""); setPrompt(""); queryClient.invalidateQueries({ queryKey: ["student", "ai-feedback"] }); } });

  if (teacher.isError) return <ErrorState message={teacher.error instanceof Error ? teacher.error.message : "Failed to load feedback"} />;
  if (teacher.isLoading || history.isLoading) return <Spinner className="size-8 text-primary" />;
  const rows = teacher.data ?? [];
  const aiRows = history.data ?? [];
  const latest = mutation.data;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Feedback & AI Coach</h1><p className="text-sm text-muted-foreground">Get IELTS/PTE-aligned feedback with inline corrections, and review previous attempts.</p></div>
    <Card><CardHeader><CardTitle>🤖 AI Writing / Speaking Coach</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex gap-2"><Button variant={type === "WRITING" ? "default" : "outline"} onClick={() => setType("WRITING")}>Writing</Button><Button variant={type === "SPEAKING" ? "default" : "outline"} onClick={() => setType("SPEAKING")}>Speaking transcript</Button></div>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Optional task/question prompt (paste the IELTS/PTE task for accurate band estimates)" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} rows={8} placeholder={type === "WRITING" ? "Paste your essay here (minimum 20 characters)..." : "Paste your speaking transcript here (minimum 20 characters)..."} className="w-full rounded-md border bg-background p-3 text-sm" />
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{text.length}/12000</span><Button disabled={text.trim().length < 20 || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Analyzing…" : "Get AI feedback"}</Button></div>
      {mutation.isError && <p className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : "AI feedback failed"}</p>}
    </CardContent></Card>

    {latest && <Card><CardHeader><CardTitle>Latest {latest.type === "WRITING" ? "Writing" : "Speaking"} feedback — {latest.overallScore}/100</CardTitle></CardHeader><CardContent><FeedbackDetail f={latest} /></CardContent></Card>}

    <BandTrendChart rows={aiRows} />

    <Card><CardHeader><CardTitle>AI feedback history</CardTitle></CardHeader><CardContent>{aiRows.length === 0 ? <EmptyState title="No AI feedback yet" description="Submit a writing or speaking response above to start your history." /> : <div className="space-y-3">{aiRows.map((f) => <HistoryRow key={f.id} f={f} expanded={expandedId === f.id} onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)} />)}</div>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Teacher feedback</CardTitle></CardHeader><CardContent>{rows.length === 0 ? <EmptyState title="No teacher feedback yet" description="Teacher feedback will appear here." /> : <div className="space-y-4">{rows.map((f) => <div key={f._id} className="rounded-lg border p-4"><p className="font-medium">{f.teacherId ? `${f.teacherId.firstName} ${f.teacherId.lastName}` : "Teacher"}{f.marks != null && <span className="ml-2 text-sm text-muted-foreground">Marks: {f.marks}</span>}</p><p className="mt-2 whitespace-pre-line text-sm">{f.content || "No written comment."}</p><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</p></div>)}</div>}</CardContent></Card>
  </div>;
}
