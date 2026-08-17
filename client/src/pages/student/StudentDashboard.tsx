import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FileText, ClipboardList, CheckCircle2, PenSquare, Target, ArrowRight, CalendarDays, BookOpen,
  Headphones, Mic, PenLine, ChevronDown,
} from "lucide-react";
import { apiGet } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { ErrorState, PageSpinner, EmptyState } from "../../components/ui/feedback";
import { initialOf } from "../../utils";
import { profileCompletion, type AccountProfile } from "../../lib/profile";
import { courseApi } from "../../api/courses";

interface DashboardData {
  teacherName: string | null;
  batchCount: number;
  availableExams: number;
  totalAssignedExams: number;
  completedExams: number;
  pendingAssignments: number;
  recentResults: Array<{ _id: string; examTitle: string; category: string; practiceBand: number | null; estimatedPteScore: number | null; percentage: number | null; finalScore: number | null; maxScore: number | null }>;
  currentBatch: { _id: string; name: string; courseId: { name?: string } | null } | null;
  courseCount: number;
  courseProgress: Array<{ courseId: string; progressPercent: number; completedLessonCount: number; totalLessonCount: number }>;
}

interface SectionalPartStat {
  key: string;
  label: string;
  available: number;
  completed: number;
  status: string;
}

interface SectionalStat {
  category: string;
  label: string;
  available: number;
  completed: number;
  inProgress: boolean;
  progressPercent: number;
  parts: SectionalPartStat[];
}

interface StudentCourseBrief {
  course: { _id: string; name: string; code?: string; type?: string; description?: string; thumbnailUrl?: string | null };
  enrollment: { _id: string; status: string; lastAccessedAt?: string | null };
  progress: number;
  completedLessons: number;
  totalLessons: number;
}

const SECTION_ICONS: Record<string, typeof FileText> = {
  IELTS_LISTENING: Headphones,
  IELTS_READING: BookOpen,
  IELTS_WRITING: PenLine,
  IELTS_SPEAKING: Mic,
};

const PART_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
};

export function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const [expanded, setExpanded] = useState<string>("IELTS_LISTENING");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: async () => (await apiGet<DashboardData>("/student/dashboard")).data,
  });

  const profileQuery = useQuery({
    queryKey: ["me", "full"],
    queryFn: async () => (await apiGet<AccountProfile>("/auth/me/full")).data,
  });

  const sectionalQuery = useQuery({
    queryKey: ["student", "practice", "summary"],
    queryFn: async () => (await apiGet<{ sections: SectionalStat[] }>("/student/practice/summary")).data,
  });

  const coursesQuery = useQuery({
    queryKey: ["student", "courses", "mine"],
    queryFn: async () => (await courseApi.listStudentCourses()).data ?? [],
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return <ErrorState message={error instanceof Error ? error.message : "Failed to load dashboard"} />;

  const profile = profileQuery.data;
  const completion = profile ? profileCompletion(profile) : 0;
  const countdown = profile?.preferredTestDate ? daysUntil(profile.preferredTestDate) : null;

  const cards = [
    { label: "My courses", value: data.courseCount, icon: BookOpen, to: "/student/courses" },
    { label: "Available tests", value: data.availableExams, icon: FileText, to: "/student/tests" },
    { label: "Completed", value: data.completedExams, icon: CheckCircle2, to: "/student/results" },
    { label: "Assignments", value: data.pendingAssignments, icon: ClipboardList, to: "/student/assignments" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback>{initialOf(user?.firstName)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-normal">Welcome back, {user?.firstName}!</h1>
            <p className="text-sm text-muted-foreground">
              {data.teacherName ? `Your teacher: ${data.teacherName}` : "No teacher assigned yet"}
              {data.currentBatch ? ` · Batch: ${data.currentBatch.name}` : ""}
            </p>
          </div>
        </div>
        <Button asChild><Link to="/student/practice"><PenSquare className="size-4" /> Start practice</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="group">
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-md bg-muted p-2.5 text-brand-600">
                  <c.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-none">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <SectionCard
        title="Sectional practice"
        subtitle="Focus on one skill or part at a time"
        viewAllTo="/student/practice"
      >
        {sectionalQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="h-32 animate-pulse bg-muted/40" /></Card>)}
          </div>
        ) : sectionalQuery.isError ? (
          <p className="text-sm text-muted-foreground">Could not load sectional practice.</p>
        ) : (sectionalQuery.data?.sections ?? []).length === 0 ? (
          <EmptyState title="No sectional practice available" description="Your teacher hasn't published sectional practice tests yet." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sectionalQuery.data!.sections.map((s) => (
              <SkillSectionCard key={s.category} stat={s} isExpanded={expanded === s.category} onToggle={() => setExpanded(expanded === s.category ? "" : s.category)} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="My courses"
        subtitle="Continue where you left off"
        viewAllTo="/student/courses"
      >
        {coursesQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="h-28 animate-pulse bg-muted/40" /></Card>)}
          </div>
        ) : coursesQuery.isError ? (
          <p className="text-sm text-muted-foreground">Could not load your courses.</p>
        ) : (coursesQuery.data ?? []).length === 0 ? (
          <EmptyState title="No courses yet" description="Ask your teacher to enroll you in a course." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(coursesQuery.data ?? []).slice(0, 4).map((c) => (
              <CourseMiniCard key={c.course._id} course={c} />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="size-4 text-brand-600" />
            <CardTitle className="text-base">Your goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Exam</p>
              <p className="font-semibold">{profile?.examType || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Target score</p>
              <p className="font-semibold">{profile?.targetScore || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current level</p>
              <p className="font-semibold">{profile?.currentLevel || "Not set"}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/student/profile">Edit exam details</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CalendarDays className="size-4 text-brand-600" />
            <CardTitle className="text-base">Test date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {countdown != null ? (
              <>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-brand-600">{countdown}</span>
                  <span className="mb-1 text-sm text-muted-foreground">{countdown === 1 ? "day to go" : "days to go"}</span>
                </div>
                <p className="text-sm text-muted-foreground">Set for {formatDateShort(profile?.preferredTestDate)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Add a preferred test date to see a countdown here.</p>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Profile completion</span><span className="font-semibold">{completion}%</span>
                </div>
                <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
                </div>
              </div>
              <Button asChild variant="ghost" size="sm"><Link to="/student/profile"><ArrowRight className="size-4" /></Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b"><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <QuickAction to="/student/courses" icon={BookOpen} label="Continue my courses" count={data.courseCount} />
            <QuickAction to="/student/tests" icon={FileText} label="Take a test" />
            <QuickAction to="/student/practice" icon={PenSquare} label="Practice questions" />
            <QuickAction to="/student/speaking" icon={Mic} label="Speaking practice" />
            <QuickAction to="/student/assignments" icon={ClipboardList} label="Pending assignments" count={data.pendingAssignments} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Recent results</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/student/results">View all</Link></Button>
        </CardHeader>
        <CardContent>
          {data.recentResults.length === 0 ? (
            <EmptyState title="No results yet" description="Complete a test to see your practice performance here." />
          ) : (
            <div className="space-y-3">
              {data.recentResults.map((r) => (
                <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
                  <div>
                    <div className="font-medium">{r.examTitle}</div>
                    <div className="text-xs text-muted-foreground">{r.category.replace(/_/g, " ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.practiceBand != null && <Badge variant="secondary">IELTS Practice Band: {r.practiceBand.toFixed(1)}</Badge>}
                    {r.estimatedPteScore != null && <Badge variant="outline">PTE: {r.estimatedPteScore}</Badge>}
                    {r.percentage != null && <span className="text-sm font-semibold">{r.percentage}%</span>}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Practice scores are indicative only and are not official IELTS or PTE results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, count }: { to: string; icon: typeof FileText; label: string; count?: number }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/25 hover:bg-muted/60">
      <span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /> {label}</span>
      {typeof count === "number" && count > 0 ? <Badge variant="secondary">{count}</Badge> : <ArrowRight className="size-4 text-muted-foreground" />}
    </Link>
  );
}

function SectionCard({ title, subtitle, viewAllTo, children }: { title: string; subtitle: string; viewAllTo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to={viewAllTo}>View all <ArrowRight className="size-4" /></Link></Button>
      </div>
      {children}
    </div>
  );
}

function SkillSectionCard({ stat, isExpanded, onToggle }: { stat: SectionalStat; isExpanded: boolean; onToggle: () => void }) {
  const Icon = SECTION_ICONS[stat.category] ?? Target;
  const statusColor = stat.inProgress ? "bg-amber-500" : stat.progressPercent === 100 ? "bg-green-600" : "bg-brand-600";
  return (
    <Card className="flex flex-col transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2.5 text-brand-600">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight">{stat.label}</div>
            <div className="text-xs text-muted-foreground">{stat.completed} of {stat.available} tests done</div>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${statusColor}`} style={{ width: `${stat.progressPercent}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button asChild size="sm" variant={stat.inProgress ? "secondary" : "default"}>
            <Link to={`/student/practice?section=${stat.category}`}>
              <PenSquare className="size-4" /> {stat.inProgress ? "Continue" : "Practice now"}
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-expanded={isExpanded} aria-label={`${stat.label} parts`} onClick={onToggle}>
            <ChevronDown className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </Button>
        </div>
        {isExpanded && (
          <div className="space-y-1 border-t pt-2.5">
            {stat.parts.map((p) => (
              <Link
                key={p.key}
                to={`/student/practice?section=${stat.category}&part=${p.key}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium">{p.label}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {p.available > 0 ? `${p.completed}/${p.available}` : null}
                  <Badge variant={p.status === "COMPLETED" ? "success" : p.status === "IN_PROGRESS" ? "warning" : "outline"}>
                    {PART_STATUS_LABEL[p.status] ?? "Not started"}
                  </Badge>
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CourseMiniCard({ course }: { course: StudentCourseBrief }) {
  const pct = Math.min(100, Math.max(0, Math.round(course.progress || 0)));
  return (
    <Link to={`/student/courses/${course.course._id}`} className="group">
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            {course.course.thumbnailUrl ? (
              <img src={course.course.thumbnailUrl} alt="" className="size-10 rounded-md object-cover" loading="lazy" />
            ) : (
              <div className="rounded-md bg-muted p-2.5 text-brand-600"><BookOpen className="size-5" /></div>
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">{course.course.name}</div>
              <div className="text-xs text-muted-foreground">{course.completedLessons} of {course.totalLessons || 0} lessons</div>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-auto flex items-center justify-between text-xs">
            <span className="font-medium text-brand-600">{pct}% complete</span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function daysUntil(value: string): number {
  const target = new Date(value).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target - now) / 86400000));
}

function formatDateShort(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
