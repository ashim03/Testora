import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, FolderOpen, ClipboardList } from "lucide-react";
import { apiGet } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Spinner } from "../../components/ui/feedback";
import { formatDuration } from "../../utils";

interface Row {
  _id: string;
  title: string;
  category?: string;
  type?: string;
  status?: string;
  durationSec?: number | null;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const examsQuery = useQuery({
    queryKey: ["search", "exams", q],
    queryFn: async () => {
      if (!q) return { data: [] as Row[], pagination: undefined };
      if (user?.role === "STUDENT") {
        const res = await apiGet<Array<{ exam: Row; assignment?: unknown; attempt?: unknown }>>("/student/exams", { search: q, limit: 10 });
        return { data: (res.data ?? []).map((i) => i.exam), pagination: res.pagination };
      }
      const res = await apiGet<Row[]>("/exams", { search: q, limit: 10 });
      return { data: res.data ?? [], pagination: res.pagination };
    },
    enabled: !!q,
  });

  const questionsQuery = useQuery({
    queryKey: ["search", "questions", q],
    queryFn: async () => {
      if (!q || user?.role === "STUDENT") return { data: [] as Row[] };
      const res = await apiGet<Row[]>("/questions", { search: q, limit: 10 });
      return { data: res.data ?? [] };
    },
    enabled: !!q && user?.role !== "STUDENT",
  });

  const empty = !q;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-muted-foreground">{empty ? "Type in the header search bar to find tests and questions" : `Results for “${q}”`}</p>
      </div>

      {empty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Search className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Use the search bar in the top header to look for tests and questions.</p>
          </CardContent>
        </Card>
      ) : examsQuery.isLoading || questionsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="size-4" /> Tests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(examsQuery.data?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No exams match.</p>
              ) : (
                (examsQuery.data?.data ?? []).map((e) => (
                  <button
                    key={e._id}
                    onClick={() => navigate(user?.role === "STUDENT" ? "/student/exams" : "/teacher/exams")}
                    className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{e.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {e.category} {e.durationSec ? `· ${formatDuration(e.durationSec)}` : ""}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {user?.role !== "STUDENT" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderOpen className="size-4" /> Questions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(questionsQuery.data?.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No questions match.</p>
                ) : (
                  (questionsQuery.data?.data ?? []).map((qRow) => (
                    <button
                      key={qRow._id}
                      onClick={() => navigate("/teacher/questions")}
                      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="truncate font-medium">{qRow.title}</span>
                      <Badge variant="outline">{qRow.type}</Badge>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}