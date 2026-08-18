import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, EmptyState, Spinner } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { formatDateTime } from "../../utils";
import type { AiBandSet, AiErrorAnnotation } from "@testora-platform/shared";

interface TeacherFeedback { _id: string; teacherId?: { firstName?: string; lastName?: string } | null; content?: string; marks?: number | null; createdAt: string; }
interface AIFeedback { id: string; type: "WRITING" | "SPEAKING"; submission: string; overallScore: number; bands?: AiBandSet | null; annotations?: AiErrorAnnotation[]; modelAnswer?: string | null; advice?: string | null; strengths: string[]; improvements: string[]; grammar: string[]; vocabulary: string[]; coherence: string[]; fluency: string[]; pronunciation: string[]; nextSteps: string[]; disclaimer: string; createdAt: string; }

const CATEGORY_LABELS: Record<string, string> = { grammar: "grammar", vocabulary: "vocabulary", coherence: "coherence", fluency: "fluency", task_response: "task response", spelling: "spelling", punctuation: "punctuation" };

function List({ title, items }: { title: string; items?: string[] }) { return <div><h4 className="font-medium">{title}</h4><ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{(items || []).map((item, i) => <li key={`${title}-${i}`}>{item}</li>)}</ul></div>; }
function Bands({ bands }: { bands?: AiBandSet | null }) { if (!bands || (bands.ielts == null && bands.pte == null)) return null; return <div className="flex flex-wrap gap-4 text-sm">{bands.ielts != null && <span>IELTS band: <b>{bands.ielts}</b></span>}{bands.pte != null && <span>PTE estimate: <b>{bands.pte}</b></span>}</div>; }

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

function AnnotatedText({ text, annotations }: { text: string; annotations?: AiErrorAnnotation[] }) {
  if (!annotations?.length) return <p className="whitespace-pre-line text-sm text-muted-foreground">{text}</p>;
  const valid = annotations.filter((a) => normalize(text.slice(Math.max(0, a.start), Math.min(text.length, a.end))) === normalize(a.original));
  if (!valid.length) return <p className="whitespace-pre-line text-sm text-muted-foreground">{text}</p>;
  const sorted = [...valid].sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((a, i) => {
    const start = Math.max(cursor, Math.min(a.start, text.length));
    const end = Math.max(start, Math.min(a.end, text.length));
    if (start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    if (end > start) parts.push(<mark key={`a${i}`} className="rounded bg-amber-200 px-0.5 text-foreground" title={`${a.correction}${a.note ? ` — ${a.note}` : ""}`}>{text.slice(start, end)}</mark>);
    cursor = end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <p className="whitespace-pre-line text-sm text-muted-foreground">{parts}</p>;
}

function Corrections({ items }: { items?: AiErrorAnnotation[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="font-medium">Inline corrections</h4>
      <ul className="mt-1 space-y-1.5 text-sm">
        {(items || []).map((a, i) => (
          <li key={i} className="rounded-md border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <del className="text-destructive">{a.original}</del>
              <span>→</span>
              <ins className="no-underline text-emerald-700">{a.correction}</ins>
              {a.better && <span className="text-xs text-muted-foreground">(stronger: <b className="text-emerald-700">{a.better}</b>)</span>}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{CATEGORY_LABELS[a.category] ?? a.category} · {a.severity} impact</span>
            </div>
            {a.note && <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackDetail({ f }: { f: AIFeedback }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Bands bands={f.bands} />
        <span className="font-semibold">{f.overallScore}/100</span>
      </div>
      <div>
        <h4 className="font-medium">Your response</h4>
        <AnnotatedText text={f.submission} annotations={f.annotations} />
        <p className="mt-1 text-xs text-muted-foreground">Highlighted text shows suggested corrections; hover a highlight for details.</p>
      </div>
      <Corrections items={f.annotations} />
      <div className="grid gap-4 md:grid-cols-2">
        <List title="Strengths" items={f.strengths} />
        <List title="What to improve" items={f.improvements} />
        <List title="Grammar" items={f.grammar} />
        <List title="Vocabulary" items={f.vocabulary} />
        <List title="Coherence" items={f.coherence} />
        <List title="Fluency" items={f.fluency} />
        <List title="Next steps" items={f.nextSteps} />
      </div>
      {f.advice && <div className="rounded-md border bg-muted/50 p-3"><h4 className="font-medium">Coach's advice</h4><p className="mt-1 text-sm text-muted-foreground">{f.advice}</p></div>}
      {f.modelAnswer && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Model answer</summary><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{f.modelAnswer}</p></details>}
      <p className="text-xs text-muted-foreground">{f.disclaimer}</p>
    </div>
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

    <Card><CardHeader><CardTitle>AI feedback history</CardTitle></CardHeader><CardContent>{aiRows.length === 0 ? <EmptyState title="No AI feedback yet" description="Submit a writing or speaking response above to start your history." /> : <div className="space-y-3">{aiRows.map((f) => <HistoryRow key={f.id} f={f} expanded={expandedId === f.id} onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)} />)}</div>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Teacher feedback</CardTitle></CardHeader><CardContent>{rows.length === 0 ? <EmptyState title="No teacher feedback yet" description="Teacher feedback will appear here." /> : <div className="space-y-4">{rows.map((f) => <div key={f._id} className="rounded-lg border p-4"><p className="font-medium">{f.teacherId ? `${f.teacherId.firstName} ${f.teacherId.lastName}` : "Teacher"}{f.marks != null && <span className="ml-2 text-sm text-muted-foreground">Marks: {f.marks}</span>}</p><p className="mt-2 whitespace-pre-line text-sm">{f.content || "No written comment."}</p><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</p></div>)}</div>}</CardContent></Card>
  </div>;
}
