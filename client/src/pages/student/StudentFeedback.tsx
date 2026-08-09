import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ErrorState, EmptyState, Spinner } from "../../components/ui/feedback";
import { formatDateTime } from "../../utils";

interface FeedbackRow {
  _id: string;
  teacherId?: { firstName?: string; lastName?: string } | null;
  content?: string;
  marks?: number | null;
  createdAt: string;
}

export function StudentFeedback() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["student", "feedback"],
    queryFn: async () => (await apiGet<FeedbackRow[]>("/student/feedback")).data ?? [],
  });

  if (isError) return <ErrorState message={error instanceof Error ? error.message : "Failed to load feedback"} />;
  if (isLoading) return <Spinner className="size-8 text-primary" />;
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-muted-foreground">Comments from your teacher</p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6"><EmptyState title="No feedback yet" description="Teacher feedback will appear here." /></CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((f) => (
            <Card key={f._id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {f.teacherId ? `${f.teacherId.firstName} ${f.teacherId.lastName}` : "Teacher"}
                  {f.marks != null && <span className="ml-2 text-sm text-muted-foreground">Marks: {f.marks}</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{f.content || "No written comment."}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(f.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}