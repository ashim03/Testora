import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Plus, Trash2, BookOpen, Folder, FileText,
  Video, Users, Megaphone, ArrowLeft, CheckCircle2, Rocket, Archive,
} from "lucide-react";
import { courseApi, type CourseFull, type ModuleRow, type ChapterRow, type LessonRow } from "../../api/courses";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../../components/ui/dialog";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { Breadcrumbs } from "../../components/ui/breadcrumbs";
import { getErrorMessage } from "../../utils";

type EntityType = "module" | "chapter" | "lesson" | "material";

const ENTITY_LABEL: Record<EntityType, string> = { module: "module", chapter: "chapter", lesson: "lesson", material: "material" };

export function TeacherCourseDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"content" | "enrollments" | "announcements">("content");
  const [editor, setEditor] = useState<{ type: EntityType; mode: "create" | "edit"; parentId?: string; item?: unknown } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: EntityType; id: string } | null>(null);
  const [unpublishCourse, setUnpublishCourse] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "course", id],
    queryFn: async () => (await courseApi.getCourse(id)).data,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teacher", "course", id] });

  const createModule = useMutation({
    mutationFn: (body: Record<string, unknown>) => courseApi.createModule(id, body),
    onSuccess: () => { toast.success("Module created"); setEditor(null); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const createChapter = useMutation({
    mutationFn: (body: { moduleId: string } & Record<string, unknown>) => courseApi.createChapter(body.moduleId, body),
    onSuccess: () => { toast.success("Chapter created"); setEditor(null); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const createLesson = useMutation({
    mutationFn: (body: { chapterId: string } & Record<string, unknown>) => courseApi.createLesson(body.chapterId, body),
    onSuccess: () => { toast.success("Lesson created"); setEditor(null); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const createMaterial = useMutation({
    mutationFn: (body: { lessonId: string } & Record<string, unknown>) => courseApi.createMaterial(body.lessonId, body),
    onSuccess: () => { toast.success("Material added"); setEditor(null); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: (req: { type: EntityType; id: string }) => {
      if (req.type === "module") return courseApi.deleteModule(req.id);
      if (req.type === "chapter") return courseApi.deleteChapter(req.id);
      if (req.type === "lesson") return courseApi.deleteLesson(req.id);
      return courseApi.deleteMaterial(req.id);
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ courseId, active }: { courseId: string; active: boolean }) => courseApi.setCourseActive(courseId, active),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Course published" : "Course unpublished");
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load course"} />;

  const { course, lessonCount } = data;

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;
    const fd = new FormData(e.currentTarget);
    if (editor.type === "module") {
      createModule.mutate({ title: fd.get("title"), description: fd.get("description") || "" });
    } else if (editor.type === "chapter" && editor.parentId) {
      createChapter.mutate({ moduleId: editor.parentId, title: fd.get("title"), description: fd.get("description") || "" });
    } else if (editor.type === "lesson" && editor.parentId) {
      createLesson.mutate({ chapterId: editor.parentId, title: fd.get("title"), summary: fd.get("summary") || "", type: (fd.get("type") as string) || "TEXT" });
    } else if (editor.type === "material" && editor.parentId) {
      createMaterial.mutate({ lessonId: editor.parentId, title: fd.get("title"), type: (fd.get("type") as string) || "NOTES", url: (fd.get("url") as string) || null, content: (fd.get("content") as string) || "" });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/teacher" }, { label: "My courses", href: "/teacher/courses" }, { label: course.name }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/courses")}><ArrowLeft className="size-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{course.name}</h1>
            <p className="text-sm text-muted-foreground">{course.code} · {course.type} · {lessonCount} lessons</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={course.active === false ? "destructive" : "success"}>{course.active === false ? "Unpublished" : "Active"}</Badge>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={statusMutation.isPending} onClick={() => {
            if (course.active === false) statusMutation.mutate({ courseId: id, active: true });
            else setUnpublishCourse(course.name);
          }}>
            {course.active === false ? <><Rocket className="size-3.5" /> Publish</> : <><Archive className="size-3.5" /> Unpublish</>}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {(["content", "enrollments", "announcements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? "border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary" : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"}
          >
            {tab === "content" ? "Content" : tab === "enrollments" ? "Students" : "Announcements"}
          </button>
        ))}
      </div>

      {activeTab === "content" && (
        <ContentEditor data={data} onAdd={(type, parentId) => setEditor({ type, mode: "create", parentId })} onDelete={(type, itemId) => setDeleteTarget({ type, id: itemId })} onAddMaterial={(lessonId) => setEditor({ type: "material", mode: "create", parentId: lessonId })} />
      )}
      {activeTab === "enrollments" && <EnrollmentsTab courseId={id} />}
      {activeTab === "announcements" && <AnnouncementsTab courseId={id} />}

      <EditorDialog
        editor={editor}
        onClose={() => setEditor(null)}
        onSubmit={handleCreateSubmit}
        submitting={createModule.isPending || createChapter.isPending || createLesson.isPending || createMaterial.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget ? ENTITY_LABEL[deleteTarget.type] : "item"}?`}
        description="This item and any nested content will be permanently removed from the course. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!unpublishCourse}
        onOpenChange={(o) => { if (!o) setUnpublishCourse(null); }}
        title="Unpublish course?"
        description={`"${unpublishCourse}" will be hidden from enrolled students until you publish it again. Content and enrollments are preserved.`}
        confirmLabel="Unpublish"
        destructive
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (unpublishCourse) statusMutation.mutate({ courseId: id, active: false });
          setUnpublishCourse(null);
        }}
      />
    </div>
  );
}

function ContentEditor({ data, onAdd, onDelete, onAddMaterial }: {
  data: CourseFull;
  onAdd: (type: EntityType, parentId: string) => void;
  onDelete: (type: EntityType, itemId: string) => void;
  onAddMaterial: (lessonId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(modId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  }

  if (data.modules.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState title="No content yet" description="Add your first module to start building the course outline." action={<Button onClick={() => onAdd("module", data.course._id)}><Plus className="size-4" /> Add module</Button>} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => onAdd("module", data.course._id)}><Plus className="size-4" /> Add module</Button>
      </div>
      {data.modules.map((m) => (
        <ModuleCard key={m._id} module={m} expanded={expanded.has(m._id)} onToggle={() => toggle(m._id)} onAddChapter={() => onAdd("chapter", m._id)} onDeleteModule={() => onDelete("module", m._id)} onAddLesson={(chapterId) => onAdd("lesson", chapterId)} onDelete={(type, id) => onDelete(type, id)} onAddMaterial={onAddMaterial} />
      ))}
    </div>
  );
}

function ModuleCard({ module, expanded, onToggle, onAddChapter, onDeleteModule, onAddLesson, onDelete, onAddMaterial }: {
  module: ModuleRow;
  expanded: boolean;
  onToggle: () => void;
  onAddChapter: () => void;
  onDeleteModule: () => void;
  onAddLesson: (chapterId: string) => void;
  onDelete: (type: EntityType, id: string) => void;
  onAddMaterial: (lessonId: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b p-3">
          <button onClick={onToggle} className="flex flex-1 items-center gap-2 text-left">
            {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            <BookOpen className="size-4 text-brand-600" />
            <span className="font-semibold">{module.title}</span>
            <Badge variant={module.status === "PUBLISHED" ? "success" : "secondary"}>{module.status ?? "DRAFT"}</Badge>
          </button>
          <Button variant="ghost" size="icon" onClick={onAddChapter} title="Add chapter"><Plus className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={onDeleteModule} title="Delete module"><Trash2 className="size-4" /></Button>
        </div>
        {expanded && (
          <div className="space-y-2 p-3">
            {module.description ? <p className="text-xs text-muted-foreground">{module.description}</p> : null}
            {module.chapters.map((c) => (
              <ChapterRow key={c._id} chapter={c} onAddLesson={() => onAddLesson(c._id)} onDelete={(type, id) => onDelete(type, id)} onAddMaterial={onAddMaterial} />
            ))}
            {module.chapters.length === 0 ? <p className="px-2 text-xs text-muted-foreground">No chapters yet.</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChapterRow({ chapter, onAddLesson, onDelete, onAddMaterial }: {
  chapter: ChapterRow;
  onAddLesson: () => void;
  onDelete: (type: EntityType, id: string) => void;
  onAddMaterial: (lessonId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 p-2">
        <button onClick={() => setExpanded((e) => !e)} className="flex flex-1 items-center gap-2 text-left">
          {expanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          <Folder className="size-3.5 text-accent-600" />
          <span className="text-sm font-medium">{chapter.title}</span>
        </button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onAddLesson} title="Add lesson"><Plus className="size-3.5" /></Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => onDelete("chapter", chapter._id)} title="Delete chapter"><Trash2 className="size-3.5" /></Button>
      </div>
      {expanded && (
        <div className="space-y-1.5 border-t p-2">
          {chapter.lessons.map((l) => (
            <LessonRowComp key={l._id} lesson={l} onDelete={(type, id) => onDelete(type, id)} onAddMaterial={() => onAddMaterial(l._id)} />
          ))}
          {chapter.lessons.length === 0 ? <p className="px-2 text-xs text-muted-foreground">No lessons yet.</p> : null}
        </div>
      )}
    </div>
  );
}

function LessonRowComp({ lesson, onDelete, onAddMaterial }: {
  lesson: LessonRow;
  onDelete: (type: EntityType, id: string) => void;
  onAddMaterial: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border bg-muted/40 p-2">
      {lesson.type === "VIDEO" ? <Video className="size-3.5 text-brand-600" /> : lesson.type === "ASSIGNMENT" ? <FileText className="size-3.5 text-amber-600" /> : <FileText className="size-3.5 text-muted-foreground" />}
      <span className="flex-1 text-sm">{lesson.title}</span>
      {lesson.published ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Badge variant="secondary">DRAFT</Badge>}
      <Button variant="ghost" size="icon" className="size-7" onClick={onAddMaterial} title="Add material"><Plus className="size-3.5" /></Button>
      <Button variant="ghost" size="icon" className="size-7" onClick={() => onDelete("lesson", lesson._id)} title="Delete lesson"><Trash2 className="size-3.5" /></Button>
    </div>
  );
}

function EnrollmentsTab({ courseId }: { courseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "course", courseId, "enrollments"],
    queryFn: async () => (await courseApi.listEnrollments(courseId, { limit: 100 })).data ?? [],
  });
  if (isLoading) return <TableSkeletonPlain />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Enrolled students</CardTitle></CardHeader>
      <CardContent className="p-0">
        {!data?.length ? (
          <div className="p-6"><EmptyState title="No students enrolled" description="Use the student assignment flow to enroll students in this course." /></div>
        ) : (
          <ul className="divide-y">
            {data.map((e) => {
              const s = typeof e.studentId === "string" ? null : e.studentId;
              return (
                <li key={e._id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Users className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{s ? `${s.firstName ?? ""} ${s.lastName ?? ""}` : "Student"}</p>
                      <p className="text-xs text-muted-foreground">{s?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{e.completedLessonCount ?? 0}/{e.totalLessonCount ?? 0} lessons</span>
                    <Badge variant={e.status === "ACTIVE" ? "success" : "secondary"}>{e.status}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AnnouncementsTab({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "course", courseId, "announcements"],
    queryFn: async () => (await courseApi.getOutline(courseId)).data?.announcements ?? [],
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => courseApi.createAnnouncement(courseId, body),
    onSuccess: () => { toast.success("Announcement posted"); setOpen(false); qc.invalidateQueries({ queryKey: ["teacher", "course", courseId, "announcements"] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Megaphone className="size-4" /> New announcement</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? <TableSkeletonPlain /> : !data?.length ? (
            <div className="p-6"><EmptyState title="No announcements yet" description="Post announcements to keep your students informed." /></div>
          ) : (
            <ul className="divide-y">
              {data.map((a) => (
                <li key={a._id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    {a.pinned ? <Badge variant="warning">Pinned</Badge> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({ title: fd.get("title"), body: fd.get("body"), pinned: fd.get("pinned") === "on" });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5"><Label>Title</Label><Input name="title" required /></div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <textarea name="body" className="w-full rounded-md border px-3 py-2 text-sm" rows={4} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pinned" className="size-4" /> Pin this announcement
            </label>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Posting..." : "Post"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditorDialog({ editor, onClose, onSubmit, submitting }: {
  editor: { type: EntityType; mode: "create" | "edit"; parentId?: string; item?: unknown } | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
}) {
  if (!editor) return null;
  const labels: Record<EntityType, string> = { module: "Module", chapter: "Chapter", lesson: "Lesson", material: "Material" };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add {labels[editor.type].toLowerCase()}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5"><Label>Title</Label><Input name="title" required /></div>
          {editor.type === "module" || editor.type === "chapter" ? (
            <div className="space-y-1.5"><Label>Description</Label><textarea name="description" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} /></div>
          ) : null}
          {editor.type === "lesson" ? (
            <>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select name="type" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="TEXT">
                  {["TEXT", "VIDEO", "PDF", "DOCUMENT", "PRESENTATION", "NOTES", "LINK", "QUIZ", "ASSIGNMENT"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Summary</Label><textarea name="summary" className="w-full rounded-md border px-3 py-2 text-sm" rows={3} /></div>
            </>
          ) : null}
          {editor.type === "material" ? (
            <>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select name="type" className="w-full rounded-md border px-3 py-2 text-sm" defaultValue="NOTES">
                  {["NOTES", "VIDEO", "PDF", "DOCUMENT", "PRESENTATION", "LINK", "AUDIO"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>URL (optional)</Label><Input name="url" placeholder="https://..." /></div>
              <div className="space-y-1.5"><Label>Content</Label><textarea name="content" className="w-full rounded-md border px-3 py-2 text-sm" rows={4} /></div>
            </>
          ) : null}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TableSkeletonPlain() {
  return <div className="space-y-2 p-4"><div className="h-4 animate-pulse rounded bg-muted" /><div className="h-4 animate-pulse rounded bg-muted" /><div className="h-4 animate-pulse rounded bg-muted" /></div>;
}
