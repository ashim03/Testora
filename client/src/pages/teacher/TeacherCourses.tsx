import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, Users, FileText, Rocket, Archive } from "lucide-react";
import { courseApi, type CourseRow } from "../../api/courses";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ErrorState, EmptyState } from "../../components/ui/feedback";
import { TableSkeleton } from "../../components/ui/table-toolbar";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { getErrorMessage } from "../../utils";

export function TeacherCourses() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [unpublishTarget, setUnpublishTarget] = useState<CourseRow | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["teacher", "courses"],
    queryFn: async () => {
      const res = await courseApi.listTeacherCourses({ limit: 100 });
      return res.data ?? [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => courseApi.setCourseActive(id, active),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Course published" : "Course unpublished");
      qc.invalidateQueries({ queryKey: ["teacher", "courses"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const filtered = (data ?? []).filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) return <TableSkeleton rows={6} />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load courses"} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My courses</h1>
          <p className="text-sm text-muted-foreground">Manage course content, students and announcements</p>
        </div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..." className="w-64" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title={data.length === 0 ? "No courses assigned to you yet" : "No courses match your search"}
              description={data.length === 0 ? "Courses assigned to you or your batches will appear here." : "Try a different search term."}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const active = c.active !== false;
            return (
              <Link key={c._id} to={`/teacher/courses/${c._id}`} className="group">
                <Card className={`h-full transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? "" : "opacity-70"}`}>
                  <CardContent className="p-4">
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt={c.name} className="mb-3 h-28 w-full rounded-md object-cover" />
                    ) : (
                      <div className="mb-3 flex h-28 w-full items-center justify-center rounded-md bg-muted">
                        <BookOpen className="size-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold group-hover:text-primary">{c.name}</h3>
                        <p className="text-xs text-muted-foreground">{c.code}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge variant={c.type === "IELTS" ? "default" : "secondary"}>{c.type}</Badge>
                        <Badge variant={active ? "success" : "outline"}>{active ? "Active" : "Unpublished"}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description || "No description provided."}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="size-3.5" /> {c.instructorId && typeof c.instructorId !== "string" && c.instructorId.firstName ? `${c.instructorId.firstName} ${c.instructorId.lastName ?? ""}` : "You"}</span>
                        <span className="flex items-center gap-1"><FileText className="size-3.5" /> {c.level ?? "ALL_LEVELS"}</span>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                        {active ? (
                          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" title="Unpublish course" onClick={() => setUnpublishTarget(c)}>
                            <Archive className="size-3.5" /> Unpublish
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" title="Publish course" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: c._id, active: true })}>
                            <Rocket className="size-3.5" /> Publish
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <Button asChild variant="link" className="h-auto p-0 text-xs">
          <Link to="/teacher/assignments">Create an assignment for a course &rarr;</Link>
        </Button>
      </p>

      <ConfirmDialog
        open={!!unpublishTarget}
        onOpenChange={(o) => { if (!o) setUnpublishTarget(null); }}
        title="Unpublish course?"
        description={`"${unpublishTarget?.name}" will be hidden from enrolled students until you publish it again. Content and enrollments are preserved.`}
        confirmLabel="Unpublish"
        destructive
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (unpublishTarget) statusMutation.mutate({ id: unpublishTarget._id, active: false });
          setUnpublishTarget(null);
        }}
      />
    </div>
  );
}
