type Role = "admin" | "teacher" | "ieltsStudent" | "pteStudent";

const REQUIRED_PTE_TYPES = [
  "READ_ALOUD",
  "REPEAT_SENTENCE",
  "DESCRIBE_IMAGE",
  "RETELL_LECTURE",
  "ANSWER_SHORT_QUESTION",
  "SUMMARIZE_WRITTEN_TEXT",
  "ESSAY",
  "SINGLE_CHOICE",
  "MULTIPLE_ANSWER",
  "REORDER_PARAGRAPHS",
  "FILL_BLANK",
  "SUMMARIZE_SPOKEN_TEXT",
  "HIGHLIGHT_CORRECT_SUMMARY",
  "SELECT_MISSING_WORD",
  "HIGHLIGHT_INCORRECT_WORDS",
  "LISTENING_DICTATION",
] as const;

interface Session {
  token: string;
  user: { _id: string; role: string; email: string };
}

interface Check {
  module: string;
  caseName: string;
  status: "PASS" | "FAIL";
  detail?: string;
}

const API_BASE = process.env.API_BASE || "http://localhost:5000/api";
const QA_PASSWORD = process.env.QA_PASSWORD || "QaTest@12345";
const checks: Check[] = [];
const sessions: Partial<Record<Role, Session>> = {};

function record(module: string, caseName: string, pass: boolean, detail?: string): void {
  checks.push({ module, caseName, status: pass ? "PASS" : "FAIL", detail });
}

async function request<T = unknown>(
  path: string,
  options: RequestInit & { token?: string; expected?: number | number[] } = {},
): Promise<{ status: number; json: any; ok: boolean }> {
  const expected = Array.isArray(options.expected) ? options.expected : [options.expected ?? 200];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const json = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
  return { status: response.status, json: json as T, ok: expected.includes(response.status) };
}

async function checkApi(module: string, caseName: string, path: string, token?: string, expected: number | number[] = 200): Promise<any> {
  try {
    const res = await request(path, { token, expected });
    record(module, caseName, res.ok, `HTTP ${res.status}`);
    return res.json;
  } catch (err) {
    record(module, caseName, false, err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function login(role: Role, email: string): Promise<void> {
  const res = await request<{ data?: { accessToken: string; user: Session["user"] } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: QA_PASSWORD }),
  });
  const data = res.json?.data;
  const pass = res.ok && Boolean(data?.accessToken && data?.user);
  record("Auth", `Login ${email}`, pass, `HTTP ${res.status}`);
  if (pass) sessions[role] = { token: data.accessToken, user: data.user };
}

function token(role: Role): string {
  const session = sessions[role];
  if (!session) throw new Error(`Missing ${role} session`);
  return session.token;
}

function dataRows(payload: any): any[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  return [];
}

async function main(): Promise<void> {
  await checkApi("System", "Health endpoint", "/health");

  await login("admin", "qa.admin@test.com");
  await login("teacher", "qa.teacher@test.com");
  await login("ieltsStudent", "ielts.student@test.com");
  await login("pteStudent", "pte.student@test.com");

  const badLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "qa.admin@test.com", password: "Wrong@12345" }),
    expected: [400, 401],
  });
  record("Auth", "Reject incorrect password", badLogin.ok, `HTTP ${badLogin.status}`);

  await checkApi("Auth", "Authenticated profile", "/auth/me", token("admin"));
  await checkApi("Authorization", "Student blocked from admin API", "/admin/dashboard", token("ieltsStudent"), 403);
  await checkApi("Authorization", "Teacher blocked from student API", "/student/dashboard", token("teacher"), 403);

  await checkApi("Admin", "Dashboard", "/admin/dashboard", token("admin"));
  const adminBatches = await checkApi("Admin", "Batch overview", "/admin/batches", token("admin"));
  record("Admin", "QA batches visible", dataRows(adminBatches).some((b) => String(b.name).startsWith("[QA]")), `${dataRows(adminBatches).length} rows`);
  await checkApi("Admin", "Student list", "/admin/students?search=test.com", token("admin"));
  await checkApi("Admin", "Teacher list", "/admin/teachers?search=qa.teacher", token("admin"));
  await checkApi("Admin", "Reports", "/admin/reports", token("admin"));

  await checkApi("Teacher", "Dashboard", "/teacher/dashboard", token("teacher"));
  await checkApi("Teacher", "Students", "/teacher/students?search=test.com", token("teacher"));
  const teacherBatches = await checkApi("Teacher", "Batches", "/teacher/batches", token("teacher"));
  record("Teacher", "Teacher owns QA batches", dataRows(teacherBatches).length >= 2, `${dataRows(teacherBatches).length} rows`);
  const questions = await checkApi("Teacher", "Question search", "/questions?search=%5BQA%5D&limit=100", token("teacher"));
  record("Questions", "QA questions searchable", dataRows(questions).length >= 20, `${dataRows(questions).length} rows`);
  const seededPteTypes = new Set(dataRows(questions).filter((q) => String(q.category).startsWith("PTE")).map((q) => q.type));
  for (const type of REQUIRED_PTE_TYPES) {
    record("Questions", `PTE type seeded: ${type}`, seededPteTypes.has(type), [...seededPteTypes].join(", "));
  }
  const exams = await checkApi("Teacher", "Exam search", "/exams?search=%5BQA%5D&limit=100", token("teacher"));
  record("Exams", "QA exams searchable", dataRows(exams).length >= 10, `${dataRows(exams).length} rows`);

  await checkApi("Student", "IELTS dashboard", "/student/dashboard", token("ieltsStudent"));
  await checkApi("Student", "PTE dashboard", "/student/dashboard", token("pteStudent"));
  await checkApi("Student", "IELTS progress", "/student/progress", token("ieltsStudent"));
  await checkApi("Student", "PTE results", "/student/results", token("pteStudent"));
  const ieltsPractice = await checkApi("Student", "IELTS practice listing", "/student/practice?search=%5BQA%5D%20IELTS%20Listening%20Test%20B&limit=10", token("ieltsStudent"));
  const practiceRows = dataRows(ieltsPractice);
  const targetPractice = practiceRows.find((row) => row.exam?.title === "[QA] IELTS Listening Test B") || practiceRows[0];
  record("Student", "Target practice test found", Boolean(targetPractice?.exam?._id), targetPractice?.exam?.title);

  if (targetPractice?.exam?._id) {
    const startRes = await request(`/student/exams/${targetPractice.exam._id}/start`, {
      method: "POST",
      token: token("ieltsStudent"),
    });
    record("Exam Attempt", "Start QA practice", startRes.ok, `HTTP ${startRes.status}`);
    const attemptId = startRes.json?.data?.attempt?._id;
    record("Exam Attempt", "Attempt id returned", Boolean(attemptId), attemptId);
    const attemptDetail = attemptId ? await checkApi("Exam Attempt", "Load attempt", `/student/attempts/${attemptId}`, token("ieltsStudent")) : null;
    const firstQuestion = attemptDetail?.data?.questions?.[0];
    if (attemptId && firstQuestion?._id) {
      const saveRes = await request(`/student/attempts/${attemptId}/answers`, {
        method: "PATCH",
        token: token("ieltsStudent"),
        body: JSON.stringify({ answers: [{ questionId: firstQuestion._id, answer: firstQuestion.correctAnswers?.[0] || "A", answered: true }] }),
      });
      record("Exam Attempt", "Answer persistence save", saveRes.ok && saveRes.json?.data?.saved === 1, `HTTP ${saveRes.status}`);
      const submitRes = await request(`/student/attempts/${attemptId}/submit`, { method: "POST", token: token("ieltsStudent") });
      record("Exam Attempt", "Manual submit", submitRes.ok, `HTTP ${submitRes.status}`);
    }
  }

  const ieltsFullMock = await checkApi("Student", "IELTS full mock listing", "/student/exams?search=%5BQA%5D%20IELTS%20Full%20Mock&limit=50", token("ieltsStudent"));
  const fullMockRow = (dataRows(ieltsFullMock) as any[]).find((row: any) => row.exam?.title === "[QA] IELTS Full Mock" || row.title === "[QA] IELTS Full Mock");
  if (fullMockRow?.exam?._id || fullMockRow?._id) {
    const examId = fullMockRow.exam?._id || fullMockRow._id;
    const startRes = await request(`/student/exams/${examId}/start`, {
      method: "POST",
      token: token("ieltsStudent"),
    });
    const attemptId = startRes.json?.data?.attempt?._id;
    const attemptDetail = attemptId ? await checkApi("Audio", "Load full mock attempt", `/student/attempts/${attemptId}`, token("ieltsStudent")) : null;
    const sectionAudio = ((attemptDetail?.data?.exam?.sections || []) as any[]).find((s: any) => s.audioUrl);
    record("Audio", "Section-level audio present for student", Boolean(sectionAudio), sectionAudio?.title);
  }

  const pteListening = await checkApi("Student", "PTE listening practice listing", "/student/practice?search=%5BQA%5D%20PTE%20Listening%20Practice&limit=10", token("pteStudent"));
  const ptePracticeRows = dataRows(pteListening);
  const pteListeningPractice = ptePracticeRows.find((row) => row.exam?.title === "[QA] PTE Listening Practice") || ptePracticeRows[0];
  record("Student", "PTE listening practice found", Boolean(pteListeningPractice?.exam?._id), pteListeningPractice?.exam?.title);
  if (pteListeningPractice?.exam?._id) {
    const startRes = await request(`/student/exams/${pteListeningPractice.exam._id}/start`, {
      method: "POST",
      token: token("pteStudent"),
    });
    record("PTE Attempt", "Start PTE listening practice", startRes.ok, `HTTP ${startRes.status}`);
    const attemptId = startRes.json?.data?.attempt?._id;
    const attemptDetail = attemptId ? await checkApi("PTE Attempt", "Load PTE listening attempt", `/student/attempts/${attemptId}`, token("pteStudent")) : null;
    const loadedTypes = new Set((attemptDetail?.data?.questions || []).map((q: any) => q.type));
    for (const type of ["HIGHLIGHT_CORRECT_SUMMARY", "SELECT_MISSING_WORD", "HIGHLIGHT_INCORRECT_WORDS", "LISTENING_DICTATION"]) {
      record("PTE Attempt", `PTE listening type loads: ${type}`, loadedTypes.has(type), [...loadedTypes].join(", "));
    }
    const highlightQuestion = (attemptDetail?.data?.questions || []).find((q: any) => q.type === "HIGHLIGHT_INCORRECT_WORDS");
    if (attemptId && highlightQuestion?._id) {
      const saveRes = await request(`/student/attempts/${attemptId}/answers`, {
        method: "PATCH",
        token: token("pteStudent"),
        body: JSON.stringify({ answers: [{ questionId: highlightQuestion._id, answer: ["A", "B"], answered: true }] }),
      });
      record("PTE Attempt", "Save highlight incorrect words answer", saveRes.ok && saveRes.json?.data?.saved === 1, `HTTP ${saveRes.status}`);
    }
  }

  const submissions = await checkApi("Teacher", "Exam submissions", "/exams/submissions?status=UNDER_REVIEW,SUBMITTED,GRADED,PUBLISHED&limit=100", token("teacher"));
  const speakingSubmission = dataRows(submissions).find((row) => String(row.examId?.title || "").includes("IELTS Speaking"));
  record("Audio", "Speaking submission available to teacher", Boolean(speakingSubmission?._id), speakingSubmission?._id);
  if (speakingSubmission?._id) {
    const detail = await checkApi("Audio", "Teacher loads speaking submission detail", `/exams/submissions/${speakingSubmission._id}`, token("teacher"));
    const audioAnswer = detail?.data?.answers?.find((answer: any) => answer?.answer?.url);
    record("Audio", "Recorded answer URL present", Boolean(audioAnswer?.answer?.url), audioAnswer?.answer?.url);
    if (audioAnswer?.answer?.url) {
      const stream = await request(audioAnswer.answer.url.replace(/^\/api/, ""), { token: token("teacher"), expected: [200, 206, 302] });
      record("Audio", "Teacher can stream student recording", stream.ok, `HTTP ${stream.status}`);
    }
  }

  const failed = checks.filter((check) => check.status === "FAIL");
  console.table(checks);
  console.log(JSON.stringify({
    apiBase: API_BASE,
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failures: failed,
  }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error("[qa-audit] failed", err);
  process.exit(1);
});

export {};
