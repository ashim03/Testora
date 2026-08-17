import { type Page, expect } from "@playwright/test";

export async function mockBranding(page: Page): Promise<void> {
  await page.route("**/api/branding", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: null }) });
  });
}

export async function mockAuth(page: Page): Promise<void> {
  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON() as { email?: string; password?: string };
    if (body.email === "student@example.com" && body.password === "Student@12345") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            accessToken: "e2e-test-token",
            user: { id: "e2e-student", firstName: "Student", role: "STUDENT", email: body.email },
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false, message: "Invalid credentials" }) });
  });
}

export async function signInAsStudent(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Student@12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/student$/);
}

export function completedAttempt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const attemptId = (overrides.id as string) || "66a0f0000000000000000001";
  return {
    id: attemptId,
    taskType: "FREE_PRACTICE",
    title: "Free practice",
    prompt: "Talk about anything you like",
    status: "COMPLETED",
    createdAt: "2026-08-17T10:00:00.000Z",
    overallScore: 74,
    skillScores: { overall: 74, fluency: 78, grammar: 71, vocabulary: 76, coherence: 73 },
    metrics: {
      durationSec: 60,
      words: 148,
      sentences: 12,
      wpm: 148,
      fillerWordCount: 3,
      fillerWords: ["um (×2)", "like (×1)"],
      pauseCount: 6,
      pauseFrequencyPerMinute: 6,
      repetitionCount: 0,
      repeatedPhrases: [],
      avgWordsPerSentence: 12.3,
      sentenceComplexity: "medium",
      typeTokenRatio: 0.62,
    },
    error: null,
    audioRetained: false,
    audioUrl: null,
    audioDurationSec: 60,
    transcript:
      "Um, I think staying healthy matters because it affects everything else. Like, when I exercise regularly I sleep better and concentrate more. First of all I avoid long hours of screen time, and in addition I try to eat balanced meals every day.",
    report: {
      overallScore: 74,
      skillScores: { overall: 74, fluency: 78, grammar: 71, vocabulary: 76, coherence: 73 },
      strengths: ["Good vocabulary", "Clear organization"],
      weaknesses: ["Long pauses", "Repeated filler words", "Article mistakes"],
      recommendations: ["Practice spontaneous speaking", "Review articles", "Practice 2-minute responses"],
      disclaimer: "Heuristic estimate from transcript analysis — not an official IELTS/PTE score.",
      providerModel: null,
      estimate: true,
    },
    ...overrides,
  };
}

export function speakingProgress(): Record<string, unknown> {
  return {
    totals: { attempts: 3, completed: 3, averageOverall: 68, averageWpm: 140 },
    skills: [
      { skill: "fluency", label: "Fluency", score: 70, trend: 4, attempts: 3 },
      { skill: "grammar", label: "Grammar", score: 64, trend: 2, attempts: 3 },
      { skill: "vocabulary", label: "Vocabulary", score: 75, trend: 6, attempts: 3 },
      { skill: "coherence", label: "Coherence", score: 61, trend: -3, attempts: 3 },
    ],
    byTaskType: [{ taskType: "FREE_PRACTICE", label: "Free practice", count: 3, average: 68 }],
    trend: [
      { date: "2026-07-28", score: 62 },
      { date: "2026-08-05", score: 66 },
      { date: "2026-08-10", score: 76 },
    ],
    weakestSkill: { skill: "grammar", label: "Grammar", score: 64 },
  };
}