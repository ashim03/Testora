import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPatch } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Spinner } from "../../components/ui/feedback";
import { AudioUpload } from "../../components/shared/AudioUpload";
import { getErrorMessage, cn } from "../../utils";
import * as shared from "@testora-platform/shared";

interface Section {
  title: string;
  durationSec?: number;
  instructions?: string;
  questionIds: string[];
  audioUrl?: string | null;
  audioAssetId?: string | null;
  audioDuration?: number | null;
  audioPlayRules?: { maxPlays?: number | null; allowSeek?: boolean } | null;
}

interface BankQuestion {
  _id: string;
  title: string;
  category: string;
  type: string;
  difficulty: string;
  marks: number;
}

interface ExamDetail {
  title: string;
  type: string;
  category: string;
  description?: string;
  durationSec?: number;
  attemptLimit?: number;
  passMarks?: number | null;
  startAt?: string;
  endAt?: string;
  sections?: Array<{
    title: string;
    durationSec?: number;
    instructions?: string;
    questionIds?: string[];
    audioUrl?: string | null;
    audioAssetId?: string | null;
    audioDuration?: number | null;
    audioPlayRules?: { maxPlays?: number | null; allowSeek?: boolean } | null;
  }>;
  questionIds?: string[];
  [key: string]: unknown;
}

const SETTINGS: Array<{ key: string; label: string; desc?: string }> = [
  { key: "randomizeQuestions", label: "Randomize questions", desc: "Shuffle question order" },
  { key: "randomizeOptions", label: "Randomize options", desc: "Shuffle option order" },
  { key: "allowNavigation", label: "Allow navigation", desc: "Jump between questions" },
  { key: "allowReview", label: "Allow review" },
  { key: "autoSubmit", label: "Auto-submit", desc: "Submit when time runs out" },
  { key: "allowLateSubmission", label: "Allow late submission" },
  { key: "sectionWiseTiming", label: "Per-section timing", desc: "Each section has its own timer" },
  { key: "negativeMarking", label: "Negative marking" },
  { key: "showAnswersImmediately", label: "Show answers immediately", desc: "After submitting" },
];

const SETTING_DEFAULTS: Record<string, boolean> = {
  randomizeQuestions: false,
  randomizeOptions: false,
  allowNavigation: true,
  allowReview: true,
  autoSubmit: true,
  allowLateSubmission: true,
  sectionWiseTiming: false,
  negativeMarking: false,
  showAnswersImmediately: false,
};

export function ExamBuilder({ examId, onDone, onCancel }: { examId?: string; onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!examId;

  const [title, setTitle] = useState("");
  const [type, setType] = useState("PRACTICE");
  const [category, setCategory] = useState<string>(shared.QUESTION_CATEGORIES[0]);
  const [part, setPart] = useState("");
  const [description, setDescription] = useState("");
  const [durationSec, setDurationSec] = useState("3600");
  const [attemptLimit, setAttemptLimit] = useState("1");
  const [passMarks, setPassMarks] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [selected, setSelected] = useState(0);
  const [settings, setSettings] = useState<Record<string, boolean>>({ ...SETTING_DEFAULTS });
  const [saving, setSaving] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});

  const [qPage, setQPage] = useState(1);
  const [qSearch, setQSearch] = useState("");
  const [qCat, setQCat] = useState("");
  const [qType, setQType] = useState("");
  const [qDiff, setQDiff] = useState("");

  const bankQuery = useQuery({
    queryKey: ["builder", "bank", { qPage, qSearch, qCat, qType, qDiff }],
    queryFn: async () => {
      const res = await apiGet<BankQuestion[]>("/questions", {
        page: qPage, limit: 8, search: qSearch || undefined,
        category: qCat || undefined, type: qType || undefined, difficulty: qDiff || undefined,
      });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await apiGet<{ exam: ExamDetail; questions?: any[] }>(`/exams/teacher/${examId}`);
        if (!res.data) return;
        const ex = res.data.exam;
        setTitle(ex.title);
        setType(ex.type || "PRACTICE");
        setCategory(ex.category);
        setPart(typeof (ex as any).part === "string" ? (ex as any).part : "");
        setDescription(ex.description || "");
        setDurationSec(ex.durationSec ? String(ex.durationSec) : "3600");
        setAttemptLimit(String(ex.attemptLimit ?? 1));
        setPassMarks(ex.passMarks != null ? String(ex.passMarks) : "");
        if (ex.startAt) setStartAt(toLocalInput(ex.startAt));
        if (ex.endAt) setEndAt(toLocalInput(ex.endAt));
        const secs: Section[] = ex.sections?.length
          ? ex.sections.map((s) => ({ title: s.title, durationSec: s.durationSec || 0, instructions: s.instructions || "", questionIds: s.questionIds || [], audioUrl: s.audioUrl || null, audioAssetId: s.audioAssetId || null, audioDuration: s.audioDuration ?? null, audioPlayRules: s.audioPlayRules || null }))
          : ex.questionIds?.length
            ? [{ title: "All questions", durationSec: ex.durationSec || 0, instructions: "", questionIds: ex.questionIds }]
            : [];
        setSections(secs);
        const st: Record<string, boolean> = { ...SETTING_DEFAULTS };
        for (const k of Object.keys(SETTING_DEFAULTS)) {
          if (typeof (ex as any)[k] === "boolean") st[k] = (ex as any)[k] as boolean;
        }
        setSettings(st);
        const map: Record<string, string> = {};
        for (const q of res.data.questions || []) map[q._id] = q.title;
        setTitles(map);
      } catch {
        toast.error("Failed to load exam");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    if (!bankQuery.data) return;
    setTitles((prev) => {
      const map = { ...prev };
      for (const q of bankQuery.data.data) map[q._id] = q.title;
      return map;
    });
  }, [bankQuery.data]);

  function addSection() {
    setSections((prev) => [...prev, { title: `Section ${prev.length + 1}`, durationSec: 0, instructions: "", questionIds: [] }]);
    setSelected(sections.length);
  }

  function updateSection(i: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, j) => j !== i));
    setSelected((sel) => Math.max(0, sel - 1));
  }

  function addQuestionToSection(qid: string) {
    setSections((prev) => prev.map((s, j) => (j === selected && !s.questionIds.includes(qid) ? { ...s, questionIds: [...s.questionIds, qid] } : s)));
  }

  function removeQuestionFromSection(qid: string) {
    setSections((prev) => prev.map((s, j) => (j === selected ? { ...s, questionIds: s.questionIds.filter((q) => q !== qid) } : s)));
  }

  function selectedQuestions(): string[] {
    return sections[selected]?.questionIds ?? [];
  }

  async function submit() {
    setSaving(true);
    try {
      const questionIds = sections.flatMap((s) => s.questionIds);
      const payload = {
        title,
        type,
        category,
        part: shared.SECTIONAL_PARTS[category] ? part || null : null,
        description,
        durationSec: Number(durationSec) || undefined,
        attemptLimit: Number(attemptLimit) || 1,
        passMarks: passMarks ? Number(passMarks) : undefined,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
        sections: sections.map((s, i) => ({
          title: s.title || `Section ${i + 1}`,
          order: i,
          durationSec: s.durationSec || undefined,
          instructions: s.instructions,
          questionIds: s.questionIds,
          audioUrl: s.audioUrl || null,
          audioAssetId: s.audioAssetId || null,
          audioDuration: s.audioDuration ?? undefined,
          audioPlayRules: s.audioPlayRules || undefined,
        })),
        questionIds,
        ...settings,
      };
      if (isEdit) await apiPatch(`/exams/${examId}`, payload);
      else await apiPost("/exams", payload);
      toast.success(isEdit ? "Exam updated" : "Exam created");
      qc.invalidateQueries({ queryKey: ["teacher", "exams"] });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const bankData = bankQuery.data?.data ?? [];
  const inSection = selectedQuestions();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onCancel}><ChevronLeft className="size-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{isEdit ? "Edit exam" : "Build exam"}</h1>
            <p className="text-sm text-muted-foreground">Configure sections, pick questions and set behaviour</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Spinner className="size-4" /> : null} {isEdit ? "Save" : "Create"}</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                    <option value="PRACTICE">Practice</option>
                    <option value="SECTIONAL">Sectional</option>
                    <option value="MOCK">Mock</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select value={category} onChange={(e) => { setCategory(e.target.value); setPart(""); }} className="w-full rounded-md border px-3 py-2 text-sm">
                    {shared.QUESTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {shared.SECTIONAL_PARTS[category] && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Part / Passage / Task</Label>
                    <select value={part} onChange={(e) => setPart(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                      <option value="">All parts</option>
                      {shared.SECTIONAL_PARTS[category].parts.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Duration (seconds)</Label>
                  <Input value={durationSec} onChange={(e) => setDurationSec(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Attempt limit</Label>
                  <Input value={attemptLimit} onChange={(e) => setAttemptLimit(e.target.value)} type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Starts at</Label>
                  <Input value={startAt} onChange={(e) => setStartAt(e.target.value)} type="datetime-local" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ends at</Label>
                  <Input value={endAt} onChange={(e) => setEndAt(e.target.value)} type="datetime-local" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pass marks (optional)</Label>
                  <Input value={passMarks} onChange={(e) => setPassMarks(e.target.value)} type="number" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Sections</CardTitle>
              <Button variant="outline" size="sm" onClick={addSection} disabled={sections.length >= 6}><Plus className="size-4" /> Add section</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.length === 0 && (
                <p className="text-sm text-muted-foreground">No sections yet. Add a section to organise questions, or use the question picker below.</p>
              )}
              {sections.map((s, i) => (
                <div key={i} className={cn("cursor-pointer rounded-lg border p-3 space-y-3", selected === i && "ring-2 ring-brand-500")} onClick={() => setSelected(i)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium px-2">{s.title || `Section ${i + 1}`} <span className="ml-2 text-xs text-muted-foreground">({s.questionIds.length} q)</span></span>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeSection(i); }}><Trash2 className="size-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input value={s.title} onChange={(e) => updateSection(i, { title: e.target.value })} placeholder="Section title" />
                    <Input value={s.durationSec || ""} onChange={(e) => updateSection(i, { durationSec: Number(e.target.value) || 0 })} type="number" placeholder="Duration (s)" />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Input value={s.instructions} onChange={(e) => updateSection(i, { instructions: e.target.value })} placeholder="Instructions (optional)" />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <AudioUpload
                      label="Section audio (plays for this section)"
                      showRules
                      value={s.audioUrl ? { url: s.audioUrl, assetId: s.audioAssetId || undefined, duration: s.audioDuration ?? undefined, rules: s.audioPlayRules } : null}
                      onChange={(v) =>
                        updateSection(i, {
                          audioUrl: v?.url || null,
                          audioAssetId: v?.assetId || null,
                          audioDuration: v?.duration ?? null,
                          audioPlayRules: v?.rules ?? null,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Behaviour</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {SETTINGS.map((s) => (
                <label key={s.key} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    {s.desc ? <div className="text-xs text-muted-foreground">{s.desc}</div> : null}
                  </div>
                  <Switch checked={settings[s.key]} onCheckedChange={(v) => setSettings((prev) => ({ ...prev, [s.key]: v }))} />
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Question picker</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Adding to section: <span className="font-medium">{sections[selected]?.title || "—"}</span></p>
              <Input value={qSearch} onChange={(e) => { setQSearch(e.target.value); setQPage(1); }} placeholder="Search questions..." />
              <div className="flex flex-wrap gap-2">
                <select value={qCat} onChange={(e) => { setQCat(e.target.value); setQPage(1); }} className="rounded-md border px-2 py-1.5 text-xs">
                  <option value="">All categories</option>
                  {shared.QUESTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={qType} onChange={(e) => { setQType(e.target.value); setQPage(1); }} className="rounded-md border px-2 py-1.5 text-xs">
                  <option value="">All types</option>
                  {shared.QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={qDiff} onChange={(e) => { setQDiff(e.target.value); setQPage(1); }} className="rounded-md border px-2 py-1.5 text-xs">
                  <option value="">All difficulty</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {bankQuery.isLoading ? <Spinner /> : bankData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions match.</p>
                ) : bankData.map((q) => {
                  const added = inSection.includes(q._id);
                  return (
                    <div key={q._id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{q.title}</div>
                        <div className="text-xs text-muted-foreground">{q.category} · {q.type} · {q.difficulty}</div>
                      </div>
                      <Button variant={added ? "secondary" : "outline"} size="sm" onClick={() => added ? removeQuestionFromSection(q._id) : addQuestionToSection(q._id)}>
                        {added ? "Remove" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              {bankQuery.data?.pagination && bankQuery.data.pagination.pages > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <Button variant="outline" size="sm" disabled={qPage <= 1} onClick={() => setQPage((p) => p - 1)}>Prev</Button>
                  <span>{qPage}/{bankQuery.data.pagination.pages}</span>
                  <Button variant="outline" size="sm" disabled={qPage >= bankQuery.data.pagination.pages} onClick={() => setQPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">In this section</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {inSection.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions in this section.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {inSection.map((qid) => (
                    <div key={qid} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
                      <span className="truncate text-sm">{titles[qid] || qid.slice(0, 18)}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeQuestionFromSection(qid)}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}