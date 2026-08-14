import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, ChevronLeft, BookOpen, Folder, FileText, Video,
  CheckCircle2, Circle, ArrowLeft, Megaphone, ExternalLink, Play,
} from "lucide-react";
import { courseApi } from "../../api/courses";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { getErrorMessage, titleCase } from "../../utils";

const VIDEO_FILE_RE = /\.(mp4|webm|ogg|m4v|mov)(\?|$)/i;
const AUDIO_FILE_RE = /\.(mp3|wav|m4a|oga|aac)(\?|$)/i;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/;
const VIMEO_RE = /(?:vimeo\.com\/(?:video\/)?)(\d+)/;

function getYouTubeId(url: string): string | null {
  const m = YOUTUBE_RE.exec(url);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = VIMEO_RE.exec(url);
  return m ? m[1] : null;
}

function isVideoUrl(url: string): boolean {
  return VIDEO_FILE_RE.test(url) || !!getYouTubeId(url) || !!getVimeoId(url);
}

function isAudioUrl(url: string): boolean {
  return AUDIO_FILE_RE.test(url);
}

export function StudentCourseLearn() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [viewedMaterials, setViewedMaterials] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(`course-materials:${id}`) ?? "[]");
      return new Set<string>(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set<string>();
    }
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "course", id],
    queryFn: async () => (await courseApi.getStudentCourse(id)).data,
  });

  const markComplete = useMutation({
    mutationFn: ({ lessonId, source }: { lessonId: string; source: string }) => courseApi.markLessonComplete(id, lessonId, source),
    onSuccess: () => {
      toast.success("Lesson completed — nice work!");
      qc.invalidateQueries({ queryKey: ["student", "course", id] });
      qc.invalidateQueries({ queryKey: ["student", "dashboard"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const recordView = useMutation({
    mutationFn: ({ lessonId, materialId }: { lessonId: string; materialId: string }) =>
      courseApi.recordMaterialView(id, lessonId, materialId).then(() => ({ lessonId, materialId })),
    onSuccess: ({ materialId }) => {
      setViewedMaterials((prev) => new Set(prev).add(materialId));
    },
  });

  const progressMap = useMemo(() => new Map((data?.progress ?? []).map((p) => [String(p.lesson?._id), p.progress])), [data]);
  const allLessons = useMemo(
    () => (data?.modules ?? []).flatMap((m) => m.chapters.flatMap((c) => c.lessons)),
    [data],
  );
  const firstIncomplete = allLessons.find((l) => progressMap.get(l._id)?.status !== "COMPLETED");
  const current = selectedLesson ? allLessons.find((l) => l._id === selectedLesson) ?? allLessons[0] ?? null : allLessons[0] ?? null;

  useEffect(() => {
    if (selectedLesson || allLessons.length === 0) return;
    let resume: string | null = null;
    try {
      resume = localStorage.getItem(`course-resume:${id}`);
    } catch {
      resume = null;
    }
    const target =
      (resume && allLessons.find((l) => l._id === resume)) ? resume
      : firstIncomplete ? firstIncomplete._id
      : allLessons[0]?._id;
    if (target) setSelectedLesson(target);
  }, [id, allLessons, selectedLesson, firstIncomplete]);

  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(`course-resume:${id}`, current._id);
    } catch {
      /* noop */
    }
  }, [current, id]);

  useEffect(() => {
    try {
      localStorage.setItem(`course-materials:${id}`, JSON.stringify([...viewedMaterials]));
    } catch {
      /* noop */
    }
  }, [viewedMaterials, id]);

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load course"} />;

  const { course, modules, announcements, enrollment } = data;
  const pct = enrollment?.progressPercent ?? 0;

  function toggleModule(modId: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  }

  function viewMaterial(mat: { _id: string; title: string; type: string; url?: string | null; content?: string }) {
    if (!current || viewedMaterials.has(mat._id)) return;
    recordView.mutate({ lessonId: current._id, materialId: mat._id });
  }

  const materialsViewedForCurrent = current ? (current.materials ?? []).filter((m) => viewedMaterials.has(m._id)).length : 0;
  const allMaterialsViewedForCurrent = !!current && (current.materials?.length ?? 0) > 0 && materialsViewedForCurrent >= (current.materials?.length ?? 0);
  const currentComplete = current ? progressMap.get(current._id)?.status === "COMPLETED" : false;

  const currentPos = allLessons.findIndex((l) => l._id === current?._id);
  const prevLesson = currentPos > 0 ? allLessons[currentPos - 1] : null;
  const nextLesson = currentPos >= 0 && currentPos < allLessons.length - 1 ? allLessons[currentPos + 1] : null;

  const completeCurrent = (source = "LESSON_COMPLETED") => {
    if (!current || currentComplete) return;
    markComplete.mutate({ lessonId: current._id, source });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student/courses")}><ArrowLeft className="size-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{course.name}</h1>
            <p className="text-sm text-muted-foreground">{course.code} · {course.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span><span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {announcements.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Megaphone className="size-4 text-brand-600" /> Announcements</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {announcements.slice(0, 3).map((a) => (
              <div key={a._id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  {a.pinned ? <Badge variant="warning">Pinned</Badge> : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Course outline</CardTitle></CardHeader>
          <CardContent className="p-2">
            {modules.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Course content is being prepared.</p>
            ) : (
              <div className="space-y-2">
                {modules.map((m) => (
                  <div key={m._id}>
                    <button onClick={() => toggleModule(m._id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                      {openModules.has(m._id) ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                      <BookOpen className="size-4 text-brand-600" />
                      <span className="flex-1 text-sm font-medium">{m.title}</span>
                    </button>
                    {openModules.has(m._id) && (
                      <div className="ml-5 space-y-1 border-l pl-3">
                        {m.chapters.map((c) => (
                          <div key={c._id}>
                            <div className="flex items-center gap-2 py-1">
                              <Folder className="size-3.5 text-accent-600" />
                              <span className="text-xs font-medium text-muted-foreground">{c.title}</span>
                            </div>
                            <div className="ml-4 space-y-0.5">
                              {c.lessons.map((l) => {
                                const done = progressMap.get(l._id)?.status === "COMPLETED";
                                const active = selectedLesson === l._id || current?._id === l._id;
                                return (
                                  <button
                                    key={l._id}
                                    onClick={() => setSelectedLesson(l._id)}
                                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${active ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                                  >
                                    {done ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" /> : <Circle className="size-3.5 shrink-0 text-muted-foreground" />}
                                    <span className="truncate">{l.title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {current ? (
            <>
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {current.type === "VIDEO" ? <Video className="size-5 text-brand-600" /> : <FileText className="size-5 text-muted-foreground" />}
                      <h2 className="text-lg font-semibold">{current.title}</h2>
                    </div>
                    <Button
                      size="sm"
                      variant={currentComplete ? "outline" : "default"}
                      disabled={markComplete.isPending}
                      onClick={() => completeCurrent()}
                    >
                      <CheckCircle2 className="size-4" />
                      {currentComplete ? "Completed" : "Mark complete"}
                    </Button>
                  </div>
                  {current.summary ? <p className="mt-3 text-sm text-muted-foreground">{current.summary}</p> : null}
                  {current.type === "LINK" && current.materials?.find((m) => m.url) ? (
                    <a
                      href={current.materials.find((m) => m.url)!.url!}
                      target="_blank" rel="noreferrer"
                      onClick={() => viewMaterial(current.materials!.find((m) => m.url)!)}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Open lesson link <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                </CardContent>
              </Card>

              {current.materials && current.materials.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>Materials</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {materialsViewedForCurrent}/{current.materials.length} viewed
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {current.materials.map((mat) => {
                      const viewed = viewedMaterials.has(mat._id);
                      const url = mat.url ?? "";
                      const embeddable = !!url && (isVideoUrl(url) || isAudioUrl(url));
                      return (
                        <div key={mat._id}>
                          <div className="flex items-center gap-3 rounded-lg border p-3">
                            <CheckCircle2 className={`size-4 shrink-0 ${viewed ? "text-emerald-600" : "text-muted-foreground"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{mat.title}</p>
                              <p className="text-xs text-muted-foreground">{titleCase(mat.type)}</p>
                            </div>
                            {embeddable ? (
                              <Button variant="outline" size="sm" onClick={() => viewMaterial(mat)}>
                                <Play className="size-4" /> {isAudioUrl(url) ? "Listen" : "Watch"}
                              </Button>
                            ) : url ? (
                              <a href={url} target="_blank" rel="noreferrer" onClick={() => viewMaterial(mat)}>
                                <Button variant="outline" size="sm"><ExternalLink className="size-4" /> Open</Button>
                              </a>
                            ) : mat.content ? (
                              <details className="text-sm" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) viewMaterial(mat); }}>
                                <summary className="cursor-pointer text-primary">View</summary>
                                <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/40 p-3 text-xs">{mat.content}</div>
                              </details>
                            ) : null}
                          </div>
                          {embeddable && <div className="mt-2"><CourseMediaPreview title={mat.title} url={url} /></div>}
                        </div>
                      );
                    })}
                    {allMaterialsViewedForCurrent && !currentComplete && (
                      <Button size="sm" className="mt-2 w-full" onClick={() => completeCurrent("MATERIAL_VIEWED")} disabled={markComplete.isPending}>
                        <CheckCircle2 className="size-4" /> Mark lesson complete
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" disabled={!prevLesson} onClick={() => prevLesson && setSelectedLesson(prevLesson._id)}>
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Lesson {currentPos + 1} of {allLessons.length}
                </span>
                <Button variant="outline" size="sm" disabled={!nextLesson} onClick={() => nextLesson && setSelectedLesson(nextLesson._id)}>
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState title="No content available" description="Lessons will appear here once published by your instructor." />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export function CourseMediaPreview({ title, url }: { title: string; url: string }) {
  const yt = getYouTubeId(url);
  const vm = getVimeoId(url);
  if (yt) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg border bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (vm) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg border bg-black">
        <iframe className="h-full w-full" src={`https://player.vimeo.com/video/${vm}`} title={title} allowFullScreen />
      </div>
    );
  }
  if (VIDEO_FILE_RE.test(url)) {
    return (
      <video controls className="w-full rounded-lg border bg-black" src={url}>
        Your browser does not support the video tag.
      </video>
    );
  }
  if (AUDIO_FILE_RE.test(url)) {
    return <audio controls className="w-full rounded-lg border" src={url}>Your browser does not support the audio tag.</audio>;
  }
  return null;
}