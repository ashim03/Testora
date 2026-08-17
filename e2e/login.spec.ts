import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/branding", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: null }) });
  });

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
});

test("student can sign in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill("student@example.com");
  await page.getByLabel("Password").fill("Student@12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/student$/);
});

test("invalid credentials show an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("student@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid credentials")).toBeVisible();
});
