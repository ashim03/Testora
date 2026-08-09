import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { TableEmptyState, TableSkeleton } from "../../components/ui/table-toolbar";
import { ErrorState, Spinner } from "../../components/ui/feedback";
import { getErrorMessage } from "../../utils";

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function AssignmentsPage() {
  const qc = useQueryClient();
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const teachersQuery = useQuery({
    queryKey: ["admin", "teachers", "options"],
    queryFn: async () => {
      const res = await apiGet<UserRow[]>("/admin/teachers", { limit: 100 });
      return res.data ?? [];
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["admin", "students", "options"],
    queryFn: async () => {
      const res = await apiGet<UserRow[]>("/admin/students", { limit: 100 });
      return res.data ?? [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { studentIds: string[]; teacherId: string }) => apiPost("/admin/student-assignments", payload),
    onSuccess: () => {
      toast.success("Students assigned");
      setSelectedStudents([]);
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (teachersQuery.isError || studentsQuery.isError) return <ErrorState message="Failed to load data" />;
  const teachers = teachersQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground">Assign students to teachers</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Assign students to a teacher</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="teacher">Teacher</Label>
            {teachersQuery.isLoading ? (
              <Spinner className="size-4" />
            ) : (
              <select
                id="teacher"
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
              >
                <option value="">Select a teacher…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label>Select students ({selectedStudents.length} selected)</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsQuery.isLoading ? (
                  <tr><td colSpan={2}><TableSkeleton rows={5} /></td></tr>
                ) : students.length === 0 ? (
                  <TableEmptyState colSpan={2} title="No students" />
                ) : (
                  students.map((s) => (
                    <TableRow
                      key={s.id}
                      className={selectedStudents.includes(s.id) ? "bg-muted/50" : ""}
                      onClick={() => toggleStudent(s.id)}
                      role="button"
                    >
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      <TableCell>{s.email}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Button
            disabled={!selectedTeacher || selectedStudents.length === 0 || assignMutation.isPending}
            onClick={() => assignMutation.mutate({ studentIds: selectedStudents, teacherId: selectedTeacher })}
          >
            {assignMutation.isPending ? <Spinner className="size-4" /> : null} Assign selected
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}