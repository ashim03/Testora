import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, Clock } from "lucide-react";
import { courseApi } from "../../api/courses";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ErrorState, EmptyState } from "../../components/ui/feedback";
import { TableSkeleton } from "../../components/ui/table-toolbar";

export function StudentCourses() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "courses"],
    queryFn: async () => (await courseApi.listStudentCourses()).data ?? [],
  });

  if (isLoading) return <TableSkeleton rows={6} />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load courses"} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My courses</h1>
        <p className="text-sm text-muted-foreground">Continue learning where you left off</p>
      </div>

      {data.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState title="No courses yet" description="Courses assigned to you by your teacher will appear here." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => {
            const c = item.course;
            return (
              <Link key={c._id} to={`/student/courses/${c._id}`} className="group">
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-4">
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt={c.name} className="mb-3 h-28 w-full rounded-md object-cover" />
                    ) : (
                      <div className="mb-3 flex h-28 w-full items-center justify-center rounded-md bg-muted">
                        <BookOpen className="size-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-semibold group-hover:text-primary">{c.name}</h3>
                      <Badge variant={c.type === "IELTS" ? "default" : "secondary"}>{c.type}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description || "No description provided."}</p>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{item.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" /> {item.completedLessons}/{item.totalLessons} lessons completed
                      </p>
                    </div>
                    <span className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                      Continue learning <ChevronRight className="size-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
