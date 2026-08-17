import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, EmptyState, Spinner } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { formatDateTime } from "../../utils";

interface TeacherFeedback { _id: string; teacherId?: { firstName?: string; lastName?: string } | null; content?: string; marks?: number | null; createdAt: string; }
interface AIFeedback { id: string; type: "WRITING" | "SPEAKING"; submission: string; overallScore: number; strengths: string[]; improvements: string[]; grammar: string[]; vocabulary: string[]; coherence: string[]; fluency: string[]; pronunciation: string[]; nextSteps: string[]; disclaimer: string; createdAt: string; }

function List({ title, items }: { title: string; items?: string[] }) { return <div><h4 className="font-medium">{title}</h4><ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{(items || []).map((item, i) => <li key={`${title}-${i}`}>{item}</li>)}</ul></div>; }

export function StudentFeedback() {
  const [type, setType] = useState<"WRITING" | "SPEAKING">("WRITING");
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
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
    <div><h1 className="text-2xl font-bold">Feedback & AI Coach</h1><p className="text-sm text-muted-foreground">Get formative English feedback and review your previous attempts.</p></div>
    <Card><CardHeader><CardTitle>🤖 AI Writing / Speaking Coach</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex gap-2"><Button variant={type === "WRITING" ? "default" : "outline"} onClick={() => setType("WRITING")}>Writing</Button><Button variant={type === "SPEAKING" ? "default" : "outline"} onClick={() => setType("SPEAKING")}>Speaking transcript</Button></div>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Optional task/question prompt" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} rows={8} placeholder={type === "WRITING" ? "Paste your essay here (minimum 20 characters)..." : "Paste your speaking transcript here (minimum 20 characters)..."} className="w-full rounded-md border bg-background p-3 text-sm" />
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{text.length}/12000</span><Button disabled={text.trim().length < 20 || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Analyzing…" : "Get AI feedback"}</Button></div>
      {mutation.isError && <p className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : "AI feedback failed"}</p>}
    </CardContent></Card>

    {latest && <Card><CardHeader><CardTitle>Latest {latest.type === "WRITING" ? "Writing" : "Speaking"} feedback — {latest.overallScore}/100</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><List title="Strengths" items={latest.strengths}/><List title="Improvements" items={latest.improvements}/><List title="Grammar" items={latest.grammar}/><List title="Vocabulary" items={latest.vocabulary}/><List title="Coherence" items={latest.coherence}/><List title="Fluency" items={latest.fluency}/><List title="Next steps" items={latest.nextSteps}/><p className="text-xs text-muted-foreground md:col-span-2">{latest.disclaimer}</p></CardContent></Card>}

    <Card><CardHeader><CardTitle>AI feedback history</CardTitle></CardHeader><CardContent>{aiRows.length === 0 ? <EmptyState title="No AI feedback yet" description="Submit a writing or speaking response above to start your history." /> : <div className="space-y-4">{aiRows.map((f) => <div key={f.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><span className="font-medium">{f.type}</span><span className="font-semibold">{f.overallScore}/100</span></div><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{f.submission}</p><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</p></div>)}</div>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Teacher feedback</CardTitle></CardHeader><CardContent>{rows.length === 0 ? <EmptyState title="No teacher feedback yet" description="Teacher feedback will appear here." /> : <div className="space-y-4">{rows.map((f) => <div key={f._id} className="rounded-lg border p-4"><p className="font-medium">{f.teacherId ? `${f.teacherId.firstName} ${f.teacherId.lastName}` : "Teacher"}{f.marks != null && <span className="ml-2 text-sm text-muted-foreground">Marks: {f.marks}</span>}</p><p className="mt-2 whitespace-pre-line text-sm">{f.content || "No written comment."}</p><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</p></div>)}</div>}</CardContent></Card>
  </div>;
}
