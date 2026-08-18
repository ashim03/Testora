import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Play, RotateCcw, Clock, Layers, CheckCircle2, BookOpen, GraduationCap, X, Brain, Target, TrendingUp, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { TableToolbar, Pagination, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState, EmptyState } from "../../components/ui/feedback";
import { AICheckDialog } from "../../components/ai/AICheckDialog";
import { BandTrendChart, type BandPoint } from "../../components/ai/BandTrendChart";
import { getErrorMessage, formatDuration, titleCase } from "../../utils";
import { QUESTION_CATEGORIES, SECTIONAL_PARTS } from "@testora-platform/shared";

const CATEGORY_GROUPS: Record<string, { label: string; values: string[] }> = {
  IELTS: { label: "IELTS", values: QUESTION_CATEGORIES.filter((c) => c.startsWith("IELTS_")) },
  PTE: { label: "PTE", values: QUESTION_CATEGORIES.filter((c) => c.startsWith("PTE_")) },
};
const EXAM_TYPES = ["", "IELTS", "PTE"] as const;

interface PracticeItem { exam: { _id: string; title: string; category: string; type: string; part?: string | null; description?: string; durationSec?: number | null; attemptLimit?: number; status: string; showsAnswers?: boolean }; attempt: { _id: string; status: string; attemptNumber: number; finalScore?: number | null; maxScore?: number | null } | null; attemptsUsed: number; questionCount: number; remainingAttempts: number; }
interface LearningProfileData { skills: Array<{ skill: string; score: number; attempts: number; trend: number; lastPracticedAt?: string | null }>; totalPracticeSessions: number; currentStreak: number; lastPracticeAt?: string | null; }
interface AdaptivePlan { skill: string; mastery: number; difficulty: string; reason: string; }
interface AdaptiveData { plan: AdaptivePlan[]; weakAreas: Array<{ category: string; averageScore: number; difficulty: string; source: string }>; }
interface BandTrendPoint { examTitle: string; category: string | null; ieltsBand: number | null; pteScore: number | null; scorePercent: number | null; submittedAt: string; }

const CATEGORIES = QUESTION_CATEGORIES as string[];
const attemptVariant = (status?: string): "secondary" | "outline" | "success" | "default" | "warning" => {
  if (status === "IN_PROGRESS") return "warning";
  if (status === "GRADED" || status === "PUBLISHED") return "success";
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") return "secondary";
  return "outline";
};

export function StudentPractice() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(searchParams.get("section") || "");
  const [examType, setExamType] = useState<string>("");
  const [aiCheck, setAiCheck] = useState<{ attemptId: string; examTitle: string } | null>(null);
  const part = searchParams.get("part") || "";
  const sectionLabel = (category && SECTIONAL_PARTS[category]?.label) || "";
  const partLabel = (part && SECTIONAL_PARTS[category]?.parts.find((p) => p.key === part)?.label) || "";

  const setSection = (c: string) => { setCategory(c); const next = new URLSearchParams(searchParams); if (c) next.set("section", c); else next.delete("section"); if (part && !SECTIONAL_PARTS[c]?.parts.some((p) => p.key === part)) next.delete("part"); setSearchParams(next, { replace: true }); setPage(1); };
  const setExamTypeFilter = (t: string) => { setExamType(t); setPage(1); };
  const clearPart = () => { const next = new URLSearchParams(searchParams); next.delete("part"); setSearchParams(next, { replace: true }); };
  const visibleCategories = useMemo(() => examType ? CATEGORY_GROUPS[examType].values : CATEGORIES, [examType]);
  const params = useMemo(() => ({ page, limit: 9, search: search || undefined, category: category || undefined, part: part || undefined }), [page, search, category, part]);

  const { data, isLoading, isError, error } = useQuery({ queryKey: ["student", "practice", params], queryFn: async () => { const res = await apiGet<PracticeItem[]>("/student/practice", params); return { data: res.data ?? [], pagination: res.pagination }; } });
  const { data: profileData } = useQuery({ queryKey: ["student", "learning-profile"], queryFn: async () => (await apiGet<LearningProfileData>("/student/practice/profile")).data });
  const { data: adaptiveData, isLoading: adaptiveLoading } = useQuery({ queryKey: ["student", "adaptive-practice", category], queryFn: async () => (await apiGet<AdaptiveData>("/student/practice/adaptive", { limit: 6, category: category || undefined })).data });
  const { data: bandTrend } = useQuery({ queryKey: ["student", "band-trend"], queryFn: async () => (await apiGet<BandTrendPoint[]>("/student/practice/band-trend")).data ?? [] });
  const bandPoints: BandPoint[] = useMemo(() => (bandTrend ?? []).map((p) => ({
    label: new Date(p.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    ielts: p.ieltsBand,
    pte: p.pteScore,
  })), [bandTrend]);

  const startMutation = useMutation({ mutationFn: async (examId: string) => { const res = await apiPost<{ attempt: { _id: string }; exam?: unknown }>(`/student/exams/${examId}/start`); return res.data?.attempt; }, onSuccess: (attempt) => { if (attempt) navigate(`/student/exam/${attempt._id}`); }, onError: (err) => toast.error(getErrorMessage(err)) });
  const items = data?.data ?? [];
  const pagination = data?.pagination;
  const weakestSkills = [...(profileData?.skills ?? [])].sort((a, b) => a.score - b.score).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Practice tests</h1>
        <p className="text-sm text-muted-foreground">Practice selected from your recent performance and AI learning profile.</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Brain className="size-5 text-primary" /> Your adaptive learning plan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">Practice sessions</div><div className="text-xl font-semibold">{profileData?.totalPracticeSessions ?? 0}</div></div>
            <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">Current streak</div><div className="text-xl font-semibold">{profileData?.currentStreak ?? 0} days</div></div>
            <div className="rounded-lg border bg-background p-3"><div className="text-xs text-muted-foreground">Skills tracked</div><div className="text-xl font-semibold">{profileData?.skills.length ?? 0}</div></div>
          </div>
          {adaptiveLoading ? <div className="text-sm text-muted-foreground">Building your next practice plan…</div> : adaptiveData?.plan?.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {adaptiveData.plan.map((item) => (
                <div key={item.skill} className="rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{titleCase(item.skill)}</span><Badge variant={item.mastery < 50 ? "destructive" : "secondary"}>{Math.round(item.mastery)}%</Badge></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, item.mastery))}%` }} /></div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Target className="size-3" /> {titleCase(item.difficulty)} · {item.reason}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-muted-foreground">Complete a test or AI feedback session and Testora will start building your personalized plan.</div>}
          {weakestSkills.length > 0 && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><TrendingUp className="size-3" /> Priority skills:</span>{weakestSkills.map((skill) => <Badge key={skill.skill} variant="outline">{titleCase(skill.skill)} {Math.round(skill.score)}%</Badge>)}</div>}
        </CardContent>
      </Card>

      <BandTrendChart points={bandPoints} />

      {(sectionLabel || partLabel) && <div className="flex flex-wrap items-center gap-2 text-sm">{sectionLabel && <Badge variant="secondary">{sectionLabel}</Badge>}{partLabel && <Badge variant="outline" className="gap-1">{partLabel}<button aria-label="Clear part filter" onClick={clearPart}><X className="size-3" /></button></Badge>}</div>}

      <TableToolbar searchPlaceholder="Search practice tests..." search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}>
        <select value={examType} onChange={(e) => setExamTypeFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by exam type"><option value="">All exam types</option>{EXAM_TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={category} onChange={(e) => setSection(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Filter by category"><option value="">All categories</option>{visibleCategories.map((c) => <option key={c} value={c}>{titleCase(c).replace("IELTS_", "IELTS ").replace("PTE_", "PTE ")}</option>)}</select>
      </TableToolbar>

      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-4"><TableSkeleton rows={3} /></CardContent></Card>)}</div> : isError ? <ErrorState message={error instanceof Error ? error.message : "Failed to load practice tests"} /> : items.length === 0 ? <EmptyState icon={BookOpen} title="No practice tests available" description="Your teacher has not published any self-paced practice tests yet. Check back soon." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => { const attempt = item.attempt; const started = !!attempt; const inProgress = attempt?.status === "IN_PROGRESS"; const done = attempt && ["GRADED", "PUBLISHED", "SUBMITTED", "UNDER_REVIEW"].includes(attempt.status); const lastScore = done ? attempt.finalScore : null; const lastMax = done ? attempt.maxScore : null; return (
            <Card key={item.exam._id} className="flex flex-col"><CardHeader className="pb-2"><div><Badge variant="secondary">{titleCase(item.exam.category)}</Badge>{item.exam.part && SECTIONAL_PARTS[item.exam.category] && <Badge variant="secondary" className="ml-1">{SECTIONAL_PARTS[item.exam.category].parts.find((p) => p.key === item.exam.part)?.label}</Badge>}<Badge variant={attemptVariant(attempt?.status)} className="ml-1">{inProgress ? "In progress" : done ? titleCase(attempt.status) : "Not started"}</Badge></div><CardTitle className="text-base leading-snug">{item.exam.title}</CardTitle></CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">{item.exam.description && <p className="line-clamp-2 text-sm text-muted-foreground">{item.exam.description}</p>}<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Layers className="size-3.5" /> {item.questionCount} questions</span><span className="flex items-center gap-1"><Clock className="size-3.5" /> {item.exam.durationSec ? formatDuration(item.exam.durationSec) : "Untimed"}</span></div><div className="flex items-center gap-1 text-xs text-muted-foreground"><GraduationCap className="size-3.5" /> Attempts used: {item.attemptsUsed} / {item.exam.attemptLimit ?? 1}{item.remainingAttempts === 0 && <span className="ml-auto text-amber-600">Limit reached</span>}</div>{lastScore != null && <div className="flex items-center gap-1 rounded-md bg-accent/10 px-3 py-2 text-sm font-medium text-accent-700"><CheckCircle2 className="size-4" /> Last score: {lastScore}{lastMax != null ? ` / ${lastMax}` : ""}</div>}<div className="mt-auto space-y-2 pt-1">{done && attempt && <Button className="w-full" variant="outline" size="sm" onClick={() => setAiCheck({ attemptId: attempt._id, examTitle: item.exam.title })}><Sparkles className="size-4 text-primary" /> Check with AI</Button>}<Button className="w-full" size="sm" disabled={startMutation.isPending || (item.remainingAttempts === 0 && !inProgress)} onClick={() => startMutation.mutate(item.exam._id)}>{inProgress ? <><RotateCcw className="size-4" /> Resume attempt</> : started ? <><RotateCcw className="size-4" /> Start new attempt</> : <><Play className="size-4" /> Start practice</>}</Button></div></CardContent>
            </Card>
          ); })}
        </div>
      )}
      {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
      <AICheckDialog attemptId={aiCheck?.attemptId ?? ""} examTitle={aiCheck?.examTitle ?? ""} open={!!aiCheck} onClose={() => setAiCheck(null)} />
    </div>
  );
}
