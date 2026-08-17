import { expect, test } from "@playwright/test";
import { completedAttempt, mockAuth, mockBranding, signInAsStudent, speakingProgress } from "./helpers";

const ATTEMPT_ID = "66a0f0000000000000000001";

function mockSpeakingApi(page: import("@playwright/test").Page) {
  let detailCalls = 0;
  const processingAttempt = completedAttempt({ id: ATTEMPT_ID, status: "PROCESSING", overallScore: null, skillScores: null, metrics: null, report: null, audioRetained: true });

  page.route("**/api/speaking/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (pathname.endsWith("/speaking/attempts/progress")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Speaking progress", data: speakingProgress() }),
      });
      return;
    }

    if (pathname.endsWith("/speaking/attempts") && method === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Speaking attempt accepted; processing started", data: processingAttempt }),
      });
      return;
    }

    if (pathname.endsWith("/speaking/attempts") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Speaking attempts", data: [], pagination: { page: 1, limit: 8, total: 0, pages: 1 } }),
      });
      return;
    }

    if (pathname.endsWith("/speaking/attempts/" + ATTEMPT_ID) && method === "GET") {
      detailCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Speaking attempt", data: detailCalls >= 3 ? completedAttempt({ id: ATTEMPT_ID }) : processingAttempt }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, message: "not found" }) });
  });
}

test.beforeEach(async ({ page }) => {
  await mockBranding(page);
  await mockAuth(page);
  mockSpeakingApi(page);
});

test("recording UI: record, pause, play back and submit a speaking attempt", async ({ page }) => {
  await signInAsStudent(page);
  await page.goto("/student/speaking");

  await expect(page.getByRole("heading", { name: "Speaking practice" })).toBeVisible();

  // choose a task, then start recording with the fake microphone
  await page.getByRole("button", { name: /Free practice/ }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByTestId("recorder-timer")).toBeVisible();
  await expect(page.getByTestId("recorder-timer")).toContainText("Recording");

  // pause and resume
  await page.getByTestId("recorder-pause").click();
  await expect(page.getByTestId("recorder-timer")).toContainText("Paused");
  await page.getByTestId("recorder-resume").click();
  await expect(page.getByTestId("recorder-timer")).toContainText("Recording");

  // record long enough to clear the 10s minimum
  await page.waitForTimeout(10_500);

  await page.getByTestId("recorder-stop").click();
  await expect(page.getByTestId("recorder-playback")).toBeVisible();

  // submit -> processing spinner -> automatic navigation to the result page (polling takes a few seconds)
  await page.getByTestId("submit-recording").click();
  await expect(page.getByTestId("speaking-processing")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/student/speaking/result/${ATTEMPT_ID}$`), { timeout: 20_000 });
  await expect(page.getByTestId("overall-score")).toHaveText("74");
});

test("unsupported browser shows a clear message instead of a recorder", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "MediaRecorder", { value: undefined, configurable: true });
  });
  await signInAsStudent(page);
  await page.goto("/student/speaking");

  // page-level banner when the recorder is unavailable
  await expect(page.getByText(/This browser does not support microphone recording/i)).toBeVisible();

  // selecting a task still shows the recorder area with its own unsupported message
  await page.getByRole("button", { name: /Free practice/ }).click();
  await expect(page.getByText("Voice recording is not supported in this browser.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start recording" })).toHaveCount(0);
});