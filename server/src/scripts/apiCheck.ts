/* Live API verification runner.
 * Hits the running server (http://localhost:5000) and prints PASS/FAIL per feature.
 * Run: npx tsx server/src/scripts/apiCheck.ts  (from repo root)
 */
const BASE = (process.env.API_BASE || "http://localhost:5000") + "/api";

let pass = 0;
let fail = 0;

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; cookie?: string } = {},
): Promise<{ status: number; data: any; setCookie?: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const setCookie = res.headers.get("set-cookie") ?? undefined;
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, setCookie };
}

function tell(feature: string, ok: boolean, note?: string) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${feature}${note ? `  (${note})` : ""}`);
}

async function login(email: string, password: string) {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  return {
    token: r.data?.data?.accessToken as string,
    cookie: r.setCookie,
    user: r.data?.data?.user,
  };
}

async function main() {
  // ---------- Public ----------
  const health = await call("GET", "/health");
  tell("Health check", health.status === 200 && health.data?.success === true, String(health.status));

  // ---------- Super Admin ----------
  const admin = await login("admin@example.com", "Admin@12345");
  tell("Admin login + role check", !!admin.token && admin.user?.role === "SUPER_ADMIN");

  let r = await call("GET", "/admin/dashboard", { token: admin.token });
  tell("Admin dashboard metrics", r.status === 200 && typeof r.data?.data?.totalStudents === "number", String(r.status));

  r = await call("GET", "/admin/teachers", { token: admin.token });
  const teacherCount = r.data?.data?.length ?? 0;
  tell("Admin list teachers (seeded)", r.status === 200 && teacherCount >= 2, `count=${teacherCount}`);

  r = await call("GET", "/admin/students", { token: admin.token });
  const studentCount = r.data?.data?.length ?? 0;
  tell("Admin list students (seeded)", r.status === 200 && studentCount >= 10, `count=${studentCount}`);

  // create helpers tolerate 201 (created) or 409 (already exists from a prior run)
  const created = (status: number) => status === 201 || status === 409;

  r = await call("POST", "/admin/courses", { token: admin.token, body: { name: "IELTS Speaking Booster", code: "IELTS-SP", type: "IELTS", description: "Speaking practice" } });
  tell("Admin creates course", created(r.status), String(r.status));

  r = await call("GET", "/admin/courses", { token: admin.token });
  tell("Admin lists courses incl. created", r.status === 200 && (r.data?.data ?? []).some((c: any) => c.code === "IELTS-SP"), String(r.status));

  r = await call("POST", "/admin/teachers", { token: admin.token, body: { firstName: "Carol", lastName: "Davis", email: "carol@example.com", password: "Teacher@12345", role: "TEACHER" } });
  tell("Admin creates teacher", created(r.status) && !!(r.data?.data?.id || r.data?.data?._id), String(r.status));

  r = await call("POST", "/admin/categories", { token: admin.token, body: { name: "Integrated Skills", code: "IS", type: "IELTS", description: "Integrated" } });
  tell("Admin creates category", r.status === 201, String(r.status));

  // ---------- Teacher ----------
  const teacher = await login("teacher@example.com", "Teacher@12345");
  tell("Teacher login", !!teacher.token && teacher.user?.role === "TEACHER");

  r = await call("GET", "/teacher/dashboard", { token: teacher.token });
  tell("Teacher dashboard", r.status === 200 && typeof r.data?.data?.studentCount === "number", String(r.status));

  r = await call("GET", "/teacher/students", { token: teacher.token });
  tell("Teacher lists own students", r.status === 200 && (r.data?.data?.length ?? 0) >= 1, `count=${r.data?.data?.length ?? 0}`);

  r = await call("GET", "/teacher/batches", { token: teacher.token });
  tell("Teacher lists batches", r.status === 200 && Array.isArray(r.data?.data), String(r.status));

  r = await call("POST", "/exams", { token: teacher.token, body: { title: "Integration Mock 1", type: "MOCK", category: "IELTS_READING", description: "x", durationSec: 900, attemptLimit: 1 } });
  const createdExamId = r.data?.data?._id;
  tell("Teacher creates exam", r.status === 201 && !!createdExamId, String(r.status));

  if (createdExamId) {
    r = await call("POST", `/exams/${createdExamId}/publish`, { token: teacher.token });
    tell("Teacher publishes exam", r.status === 200 && r.data?.data?.status === "PUBLISHED", String(r.status));
  }

  r = await call("POST", "/questions", { token: teacher.token, body: { category: "IELTS_LISTENING", type: "SINGLE_CHOICE", title: "Integration Q1", options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }], correctAnswers: ["A"], marks: 1, difficulty: "EASY" } });
  const createdQuestionId = r.data?.data?._id;
  tell("Teacher creates question", r.status === 201 && !!createdQuestionId, String(r.status));

  r = await call("GET", "/questions", { token: teacher.token });
  tell("Teacher lists questions", r.status === 200 && (r.data?.data?.length ?? 0) > 0, String(r.status));

  r = await call("GET", "/exams/submissions", { token: teacher.token });
  tell("Teacher lists submissions (seeded)", r.status === 200 && Array.isArray(r.data?.data), String(r.status));

  r = await call("GET", "/exams/results", { token: teacher.token });
  tell("Teacher lists results (seeded)", r.status === 200 && (r.data?.data?.length ?? 0) > 0, String(r.status));

  r = await call("GET", "/exams/assignments", { token: teacher.token });
  tell("Teacher lists assignments (seeded)", r.status === 200 && (r.data?.data?.length ?? 0) > 0, String(r.status));

  r = await call("GET", "/teacher/reports", { token: teacher.token });
  tell("Teacher reports", r.status === 200 && typeof r.data?.data?.studentCount === "number", String(r.status));

  // ---------- Student ----------
  const student = await login("student@example.com", "Student@12345");
  tell("Student login", !!student.token && student.user?.role === "STUDENT");

  r = await call("GET", "/student/dashboard", { token: student.token });
  tell("Student dashboard", r.status === 200 && typeof r.data?.data?.availableExams === "number", String(r.status));

  r = await call("GET", "/student/exams", { token: student.token });
  const examList = r.data?.data ?? [];
  tell("Student lists assigned exams (seeded)", r.status === 200 && examList.length > 0, `count=${examList.length}`);

  const firstExam = examList[0]?.exam;
  if (firstExam) {
    r = await call("POST", `/student/exams/${firstExam._id}/start`, { token: student.token });
    const attemptId = r.data?.data?.attempt?._id;
    tell("Student starts exam attempt", r.status === 200 && !!attemptId, String(r.status));

    if (attemptId) {
      r = await call("GET", `/student/attempts/${attemptId}`, { token: student.token });
      const questions = r.data?.data?.questions ?? [];
      tell("Student fetches attempt questions", r.status === 200 && questions.length > 0, `q=${questions.length}`);

      if (questions[0]) {
        const qid = questions[0]._id ?? questions[0].id;
        const payload = questions[0].options?.length
          ? { answers: [{ questionId: qid, answer: questions[0].options[0].key, answered: true }] }
          : { answers: [{ questionId: qid, answer: "A sample answer for the check script.", answered: true }] };
        r = await call("PATCH", `/student/attempts/${attemptId}/answers`, { token: student.token, body: payload });
        tell("Student saves answers (autosave)", r.status === 200 && r.data?.success === true, String(r.status));
      }

      r = await call("POST", `/student/attempts/${attemptId}/submit`, { token: student.token });
      tell("Student submits attempt", r.status === 200 && r.data?.success === true, String(r.status));
    }
  }

  r = await call("GET", "/student/results", { token: student.token });
  tell("Student lists published results (seeded)", r.status === 200 && (r.data?.data?.length ?? 0) > 0, `count=${r.data?.data?.length ?? 0}`);

  r = await call("GET", "/student/progress", { token: student.token });
  tell("Student progress", r.status === 200 && typeof r.data?.data?.totalResults === "number", String(r.status));

  r = await call("GET", "/student/assignments", { token: student.token });
  tell("Student lists assignments (seeded)", r.status === 200 && (r.data?.data?.length ?? 0) > 0, String(r.status));

  r = await call("GET", "/student/notifications", { token: student.token });
  tell("Student notifications", r.status === 200, String(r.status));

  // ---------- Cleanup ----------
  if (createdQuestionId) {
    r = await call("DELETE", `/questions/${createdQuestionId}`, { token: teacher.token });
    tell("Teacher deletes question", r.status === 200, String(r.status));
  }

  if (createdExamId) {
    r = await call("POST", `/exams/${createdExamId}/archive`, { token: teacher.token });
    tell("Teacher archives check exam", r.status === 200 || r.status === 400, String(r.status));
  }

  console.log("\n====================");
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error("CHECK ABORTED", err);
  process.exit(2);
});