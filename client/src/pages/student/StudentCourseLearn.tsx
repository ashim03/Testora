import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, BookOpen, Folder, FileText, Video, CheckCircle2, Circle,
  ArrowLeft, Megaphone, ExternalLink,
} from "lucide-react";
import { courseApi } from "../../api/courses";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { getErrorMessage } from "../../utils";

export function StudentCourseLearn() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "course", id],
    queryFn: async () => (await courseApi.getStudentCourse(id)).data,
  });

  const markComplete = useMutation({
    mutationFn: (lessonId: string) => courseApi.markLessonComplete(id, lessonId),
    onSuccess: () => {
      toast.success("Lesson marked as complete");
      qc.invalidateQueries({ queryKey: ["student", "course", id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load course"} />;

  const { course, modules, announcements, enrollment, progress } = data;
  const progressMap = new Map((progress ?? []).map((p) => [String(p.lesson?._id), p.progress]));
  const pct = enrollment?.progressPercent ?? 0;

  const allLessons = modules.flatMap((m) => m.chapters.flatMap((c) => c.lessons));
  const current = selectedLesson ? allLessons.find((l) => l._id === selectedLesson) ?? null : allLessons[0] ?? null;

  function toggleModule(modId: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  }

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
                                return (
                                  <button
                                    key={l._id}
                                    onClick={() => setSelectedLesson(l._id)}
                                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedLesson === l._id || current?._id === l._id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
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
                      variant={progressMap.get(current._id)?.status === "COMPLETED" ? "outline" : "default"}
                      disabled={markComplete.isPending}
                      onClick={() => markComplete.mutate(current._id)}
                    >
                      {progressMap.get(current._id)?.status === "COMPLETED" ? <CheckCircle2 className="size-4" /> : <CheckCircle2 className="size-4" />}
                      {progressMap.get(current._id)?.status === "COMPLETED" ? "Completed" : "Mark complete"}
                    </Button>
                  </div>
                  {current.summary ? <p className="mt-3 text-sm text-muted-foreground">{current.summary}</p> : null}
                  {current.type === "LINK" && current.materials?.find((m) => m.url) ? (
                    <a href={current.materials.find((m) => m.url)!.url!} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Open lesson link <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                </CardContent>
              </Card>

              {current.materials && current.materials.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Materials</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {current.materials.map((mat) => (
                      <div key={mat._id} className="flex items-center gap-3 rounded-lg border p-3">
                        <FileText className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{mat.title}</p>
                          <p className="text-xs text-muted-foreground">{mat.type}</p>
                        </div>
                        {mat.url ? (
                          <a href={mat.url} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm"><ExternalLink className="size-4" /> Open</Button>
                          </a>
                        ) : mat.content ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-primary">View</summary>
                            <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/40 p-3 text-xs">{mat.content}</div>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
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
