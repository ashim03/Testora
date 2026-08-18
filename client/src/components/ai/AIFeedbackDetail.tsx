import type { ReactNode } from "react";
import type { AiBandSet, AiErrorAnnotation } from "@testora-platform/shared";

export interface AIFeedback {
  id: string;
  type: "WRITING" | "SPEAKING";
  submission: string;
  overallScore: number;
  bands?: AiBandSet | null;
  annotations?: AiErrorAnnotation[];
  modelAnswer?: string | null;
  advice?: string | null;
  topActions?: string[];
  offTopic?: boolean;
  taskResponseNote?: string | null;
  strengths: string[];
  improvements: string[];
  grammar: string[];
  vocabulary: string[];
  coherence: string[];
  fluency: string[];
  pronunciation: string[];
  nextSteps: string[];
  disclaimer: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = { grammar: "grammar", vocabulary: "vocabulary", coherence: "coherence", fluency: "fluency", task_response: "task response", spelling: "spelling", punctuation: "punctuation" };

export function List({ title, items }: { title: string; items?: string[] }) { return <div><h4 className="font-medium">{title}</h4><ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{(items || []).map((item, i) => <li key={`${title}-${i}`}>{item}</li>)}</ul></div>; }
export function Bands({ bands }: { bands?: AiBandSet | null }) { if (!bands || (bands.ielts == null && bands.pte == null)) return null; return <div className="flex flex-wrap gap-4 text-sm">{bands.ielts != null && <span>IELTS band: <b>{bands.ielts}</b></span>}{bands.pte != null && <span>PTE estimate: <b>{bands.pte}</b></span>}</div>; }

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

export function AnnotatedText({ text, annotations }: { text: string; annotations?: AiErrorAnnotation[] }) {
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

export function Corrections({ items }: { items?: AiErrorAnnotation[] }) {
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

export function FeedbackDetail({ f }: { f: AIFeedback }) {
  return (
    <div className="space-y-4">
      {f.offTopic && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <h4 className="text-sm font-semibold text-destructive">Off topic</h4>
          <p className="mt-1 text-sm text-muted-foreground">{f.taskResponseNote ?? "Your response appears to have gone off topic, which lowered your overall score."}</p>
        </div>
      )}
      {f.topActions?.length ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
          <h4 className="text-sm font-semibold text-primary">Top {f.topActions.length} actions to raise your band</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {f.topActions.map((action, i) => <li key={`action-${i}`}>{action}</li>)}
          </ol>
        </div>
      ) : null}
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
