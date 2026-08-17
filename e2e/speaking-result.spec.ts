import { expect, test } from "@playwright/test";
import { completedAttempt, mockAuth, mockBranding, signInAsStudent } from "./helpers";

const ATTEMPT_ID = "66a0f0000000000000000001";
const FAILED_ATTEMPT = completedAttempt({
  id: ATTEMPT_ID,
  status: "FAILED",
  error: "Speech-to-text is not configured. Transcription is disabled on this server.",
  overallScore: null,
  skillScores: null,
  metrics: null,
  report: null,
  transcript: null,
});

test.beforeEach(async ({ page }) => {
  await mockBranding(page);
  await mockAuth(page);
});

test("results page renders the full speaking report", async ({ page }) => {
  await page.route("**/api/speaking/attempts/" + ATTEMPT_ID, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Speaking attempt", data: completedAttempt({ id: ATTEMPT_ID }) }),
    });
  });

  await signInAsStudent(page);
  await page.goto(`/student/speaking/result/${ATTEMPT_ID}`);

  // report header + overall score
  await expect(page.getByTestId("overall-score")).toHaveText("74");
  await expect(page.getByTestId("estimate-badge")).toHaveText("Heuristic estimate");

  // skill breakdown
  await expect(page.getByText("Fluency", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Vocabulary", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("78/100").first()).toBeVisible();

  // delivery metrics
  await expect(page.getByText("Words per minute")).toBeVisible();
  await expect(page.getByText("148", { exact: true }).first()).toBeVisible();

  // feedback sections
  await expect(page.getByText("Good vocabulary")).toBeVisible();
  await expect(page.getByText("Long pauses")).toBeVisible();
  await expect(page.getByText("Practice spontaneous speaking")).toBeVisible();

  // transcript
  const transcript = page.getByTestId("transcript");
  await expect(transcript).toBeVisible();
  await expect(transcript).toContainText("staying healthy matters");

  // private-by-default note about raw audio removal
  await expect(page.getByText(/raw recording was removed after analysis/i)).toBeVisible();
});

test("failed attempt shows the error and retry action", async ({ page }) => {
  let detailCalls = 0;
  await page.route("**/api/speaking/attempts/" + ATTEMPT_ID + "/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Speaking attempt queued for reprocessing", data: completedAttempt({ id: ATTEMPT_ID, status: "PROCESSING" }) }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, message: "Speaking attempt", data: FAILED_ATTEMPT }) });
  });
  await page.route("**/api/speaking/attempts/" + ATTEMPT_ID, async (route) => {
    detailCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Speaking attempt",
        data: detailCalls >= 2 ? completedAttempt({ id: ATTEMPT_ID, status: "PROCESSING" }) : FAILED_ATTEMPT,
      }),
    });
  });

  await signInAsStudent(page);
  await page.goto(`/student/speaking/result/${ATTEMPT_ID}`);

  await expect(page.getByTestId("attempt-failed")).toContainText("Speech-to-text is not configured");
  await page.getByRole("button", { name: "Retry processing" }).click();
  await expect(page.getByText("Analyzing…")).toBeVisible();
});