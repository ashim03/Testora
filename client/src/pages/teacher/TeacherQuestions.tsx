import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Trash, Copy } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { TableToolbar, Pagination, PanelEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { Spinner } from "../../components/ui/feedback";
import { AudioUpload } from "../../components/shared/AudioUpload";
import { getErrorMessage, formatDate } from "../../utils";
import * as shared from "@testora-platform/shared";

interface QuestionRow {
  _id: string;
  title: string;
  category: string;
  type: string;
  difficulty: string;
  marks: number;
  createdAt: string;
}

interface QuestionDetail {
  _id?: string;
  category: string;
  type: string;
  title: string;
  instructions?: string;
  passage?: string;
  audioUrl?: string | null;
  audioAssetId?: string | null;
  audioDuration?: number | null;
  audioPlayRules?: { maxPlays?: number | null; allowSeek?: boolean } | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  options?: Array<{ key: string; text: string }>;
  correctAnswers?: string[];
  acceptedAnswers?: string[];
  explanation?: string;
  tags?: string[];
  minWordLimit?: number | null;
  maxWordLimit?: number | null;
  marks?: number;
  negativeMarks?: number;
  difficulty?: string;
}

const CHOICE_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "MULTIPLE_ANSWER",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "HIGHLIGHT_CORRECT_SUMMARY",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "REORDER_PARAGRAPHS",
];
const SINGLE_CHOICE = [
  "SINGLE_CHOICE",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "HIGHLIGHT_CORRECT_SUMMARY",
  "SELECT_MISSING_WORD",
];

export function TeacherQuestions() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fType, setFType] = useState("");
  const [fDifficulty, setFDifficulty] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteQuestion, setDeleteQuestion] = useState<{ _id: string; title: string } | null>(null);
  const [editing, setEditing] = useState<QuestionDetail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    setSelected(new Set());
  }, [page, search, fCategory, fType, fDifficulty]);

  const listQuery = useQuery({
    queryKey: ["teacher", "questions", { page, search, fCategory, fType, fDifficulty }],
    queryFn: async () => {
      const res = await apiGet<QuestionRow[]>("/questions", { page, limit: 10, search, category: fCategory || undefined, type: fType || undefined, difficulty: fDifficulty || undefined });
      return { data: res.data ?? [], pagination: res.pagination };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/questions/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["teacher", "questions"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => apiPost("/questions/bulk-delete", { ids }),
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} question${ids.length === 1 ? "" : "s"} deleted`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ["teacher", "questions"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => apiPost(`/questions/${id}/duplicate`),
    onSuccess: () => { toast.success("Question duplicated"); qc.invalidateQueries({ queryKey: ["teacher", "questions"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const pageIds = listQuery.data?.data?.map((q) => q._id) ?? [];

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.length > 0 && pageIds.every((id) => next.has(id));
      for (const id of pageIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const questions = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const res = await apiGet<QuestionDetail>(`/questions/${id}`);
      const d = res.data;
      if (!d) throw new Error("not found");
      setEditing({
        _id: d._id,
        category: d.category,
        type: d.type,
        title: d.title,
        instructions: d.instructions || "",
        passage: d.passage || "",
        options: d.options?.length ? d.options : [{ key: "A", text: "" }, { key: "B", text: "" }],
        correctAnswers: d.correctAnswers || [],
        acceptedAnswers: d.acceptedAnswers || [],
        explanation: d.explanation || "",
        tags: d.tags || [],
        marks: d.marks ?? 1,
        negativeMarks: d.negativeMarks ?? 0,
        difficulty: d.difficulty || "MEDIUM",
        audioUrl: d.audioUrl || null,
        audioAssetId: d.audioAssetId || null,
        audioDuration: d.audioDuration ?? null,
        audioPlayRules: d.audioPlayRules || null,
        imageUrl: d.imageUrl || null,
        videoUrl: d.videoUrl || null,
        minWordLimit: d.minWordLimit ?? null,
        maxWordLimit: d.maxWordLimit ?? null,
      });
      setFormOpen(true);
    } catch {
      toast.error("Failed to load question");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Question bank</h1>
          <p className="text-sm text-muted-foreground">Create, edit and manage questions</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> New question</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Questions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <select className="rounded-md border px-3 py-2 text-sm" value={fCategory} onChange={(e) => { setFCategory(e.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {shared.QUESTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="rounded-md border px-3 py-2 text-sm" value={fType} onChange={(e) => { setFType(e.target.value); setPage(1); }}>
                <option value="">All types</option>
                {shared.QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="rounded-md border px-3 py-2 text-sm" value={fDifficulty} onChange={(e) => { setFDifficulty(e.target.value); setPage(1); }}>
                <option value="">All difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <TableToolbar searchPlaceholder="Search questions..." search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} />
            </div>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-4 py-2">
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
                <Button variant="destructive" size="sm" className="h-7 gap-1 text-xs" onClick={() => setBulkDeleteOpen(true)}><Trash className="size-3.5" /> Delete selected</Button>
              </div>
            </div>
          )}
          {listQuery.isLoading ? (
            <TableSkeleton rows={6} />
          ) : questions.length === 0 ? (
            <PanelEmptyState title="No questions yet" description="Create questions to build your bank." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={pageIds.length > 0 && pageIds.every((id) => selected.has(id))}
                      onChange={toggleSelectPage}
                      aria-label="Select all questions on this page"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q._id} className={selected.has(q._id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <input type="checkbox" className="accent-brand-600" checked={selected.has(q._id)} onChange={() => toggleSelect(q._id)} aria-label={`Select ${q.title}`} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">{q.title}</TableCell>
                    <TableCell>{q.category}</TableCell>
                    <TableCell><Badge variant="outline">{q.type}</Badge></TableCell>
                    <TableCell><Badge variant={q.difficulty === "HARD" ? "destructive" : q.difficulty === "EASY" ? "secondary" : "outline"}>{q.difficulty}</Badge></TableCell>
                    <TableCell>{q.marks}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(q.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(q._id)} title="Edit"><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicateMutation.mutate(q._id)} title="Duplicate"><Copy className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteQuestion(q)} title="Delete"><Trash2 className="size-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {pagination && pagination.pages > 1 && <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <QuestionForm
          question={editing}
          onDone={() => {
            setFormOpen(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["teacher", "questions"] });
          }}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      </Dialog>

      <ConfirmDialog
        open={!!deleteQuestion}
        onOpenChange={(o) => { if (!o) setDeleteQuestion(null); }}
        title="Delete question?"
        description={`"${deleteQuestion?.title}" will be permanently removed from your question bank. Questions referenced by published exams remain in those exams.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteQuestion) deleteMutation.mutate(deleteQuestion._id);
          setDeleteQuestion(null);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected questions?"
        description={`${selected.size} question${selected.size === 1 ? "" : "s"} will be permanently removed from your question bank. Questions referenced by published exams remain in those exams.`}
        confirmLabel={`Delete ${selected.size}`}
        destructive
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => {
          if (selected.size > 0) bulkDeleteMutation.mutate([...selected]);
        }}
      />
    </div>
  );
}

function QuestionForm({ question, onDone, onCancel }: { question: QuestionDetail | null; onDone: () => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [cat, setCat] = useState(() => question?.category || shared.QUESTION_CATEGORIES[0]);
  const [type, setType] = useState(question?.type || "SINGLE_CHOICE");
  const [title, setTitle] = useState(question?.title || "");
  const [instructions, setInstructions] = useState(question?.instructions || "");
  const [passage, setPassage] = useState(question?.passage || "");
  const [audioUrl, setAudioUrl] = useState(question?.audioUrl || "");
  const [audioAssetId, setAudioAssetId] = useState(question?.audioAssetId || "");
  const [audioDuration, setAudioDuration] = useState<number | null>(question?.audioDuration ?? null);
  const [audioPlayRules, setAudioPlayRules] = useState<{ maxPlays?: number | null; allowSeek?: boolean } | null>(question?.audioPlayRules ?? null);
  const [imageUrl, setImageUrl] = useState(question?.imageUrl || "");
  const [videoUrl, setVideoUrl] = useState(question?.videoUrl || "");
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options.map((o) => o.text) : ["", ""]);
  const [correct, setCorrect] = useState<string[]>(question?.correctAnswers ?? []);
  const [accepted, setAccepted] = useState(question?.acceptedAnswers?.join("|") || "");
  const [explanation, setExplanation] = useState(question?.explanation || "");
  const [tags, setTags] = useState(question?.tags?.join(", ") || "");
  const [marks, setMarks] = useState(String(question?.marks ?? 1));
  const [negativeMarks, setNegativeMarks] = useState(String(question?.negativeMarks ?? 0));
  const [difficulty, setDifficulty] = useState(question?.difficulty || "MEDIUM");
  const [minWord, setMinWord] = useState("");
  const [maxWord, setMaxWord] = useState("");
  const [busy, setBusy] = useState(false);

  const isChoice = CHOICE_TYPES.includes(type);

  useEffect(() => {
    setType(question?.type || "SINGLE_CHOICE");
    setTitle(question?.title || "");
    setInstructions(question?.instructions || "");
    setPassage(question?.passage || "");
    setOptions(question?.options?.length ? question.options.map((o) => o.text) : ["", ""]);
    setCorrect(question?.correctAnswers ?? []);
    setAccepted(question?.acceptedAnswers?.join(" ") || "");
    setMarks(String(question?.marks ?? 1));
    setNegativeMarks(String(question?.negativeMarks ?? 0));
    setDifficulty(question?.difficulty || "MEDIUM");
    setExplanation(question?.explanation || "");
    setTags(question?.tags?.join(", ") || "");
    setAudioUrl(question?.audioUrl || "");
    setAudioAssetId(question?.audioAssetId || "");
    setAudioDuration(question?.audioDuration ?? null);
    setAudioPlayRules(question?.audioPlayRules ?? null);
    setImageUrl(question?.imageUrl || "");
    setVideoUrl(question?.videoUrl || "");
    setMinWord(question?.minWordLimit ? String(question.minWordLimit) : "");
    setMaxWord(question?.maxWordLimit ? String(question.maxWordLimit) : "");
  }, [question]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Question title is required");
      return;
    }
    const cleanOptions = isChoice ? options.map((t, i) => ({ key: String.fromCharCode(65 + i), text: t })).filter((o) => o.text) : undefined;
    const correctAnswers = isChoice ? correct : accepted.split(/\s*[|,]\s*/).map((s) => s.trim()).filter(Boolean);
    if (isChoice) {
      if ((cleanOptions?.length ?? 0) < 2) {
        toast.error("Add at least two answer options");
        return;
      }
      if (correct.length === 0) {
        toast.error("Select at least one correct answer");
        return;
      }
    } else if (type !== "SPEAKING" && type !== "WRITING" && correctAnswers.length === 0) {
      toast.error("Provide at least one correct answer");
      return;
    }
    const payload: Record<string, unknown> = {
      category: cat,
      type,
      title,
      instructions,
      passage,
      audioUrl: audioUrl || null,
      audioAssetId: audioAssetId || null,
      audioDuration: audioDuration || undefined,
      audioPlayRules: audioPlayRules || undefined,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      explanation,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      marks: Number(marks) || 1,
      negativeMarks: Number(negativeMarks) || 0,
      difficulty,
      minWordLimit: minWord ? Number(minWord) : undefined,
      maxWordLimit: maxWord ? Number(maxWord) : undefined,
      correctAnswers,
      ...(isChoice ? { options: cleanOptions } : { acceptedAnswers: correctAnswers }),
    };
    try {
      setBusy(true);
      if (question?._id) {
        await apiPatch(`/questions/${question._id}`, payload);
        toast.success("Question updated");
      } else {
        await apiPost("/questions", payload);
        toast.success("Question created");
      }
      qc.invalidateQueries({ queryKey: ["teacher", "questions"] });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{question?._id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
              {shared.QUESTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={type} onChange={(e) => { setType(e.target.value); setCorrect([]); }}>
              {shared.QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Title / question text</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Instructions</Label>
          <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Passage</Label>
          <textarea value={passage} onChange={(e) => setPassage(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" rows={4} />
        </div>

        <div className="space-y-1.5">
          <Label>Audio</Label>
          <AudioUpload
            value={audioUrl ? { url: audioUrl, assetId: audioAssetId || undefined, duration: audioDuration ?? undefined, rules: audioPlayRules } : null}
            onChange={(v) => {
              setAudioUrl(v?.url || "");
              setAudioAssetId(v?.assetId || "");
              setAudioDuration(v?.duration ?? null);
              setAudioPlayRules(v?.rules ?? null);
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Video URL</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {isChoice && (
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={SINGLE_CHOICE.includes(type) ? "radio" : "checkbox"}
                  name="correct"
                  checked={correct.includes(String.fromCharCode(65 + i))}
                  onChange={() => {
                    const key = String.fromCharCode(65 + i);
                    if (SINGLE_CHOICE.includes(type)) setCorrect([key]);
                    else setCorrect((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);
                  }}
                  className="accent-brand-600"
                />
                <Input value={o} onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))} placeholder={`Option ${String.fromCharCode(65 + i)}`} required />
                <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions((prev) => [...prev, ""])}>Add option</Button>
          </div>
        )}

        {!isChoice && (
          <div className="space-y-1.5">
            <Label>Accepted answers (space, comma or | separated)</Label>
            <Input value={accepted} onChange={(e) => setAccepted(e.target.value)} placeholder="answer1 answer2" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Marks</Label>
            <Input value={marks} onChange={(e) => setMarks(e.target.value)} type="number" />
          </div>
          <div className="space-y-1.5">
            <Label>Neg. marks</Label>
            <Input value={negativeMarks} onChange={(e) => setNegativeMarks(e.target.value)} type="number" />
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Min words (essay)</Label>
            <Input value={minWord} onChange={(e) => setMinWord(e.target.value)} type="number" />
          </div>
          <div className="space-y-1.5">
            <Label>Max words (essay)</Label>
            <Input value={maxWord} onChange={(e) => setMaxWord(e.target.value)} type="number" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Explanation</Label>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Tags (comma separated)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></DialogClose>
          <Button type="submit" disabled={busy}>{busy ? <Spinner className="size-4" /> : null} {question?._id ? "Save" : "Create"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
