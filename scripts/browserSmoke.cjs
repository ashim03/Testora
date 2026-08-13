const { chromium } = require("playwright");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const BASE_URL = process.env.WEB_BASE || "http://localhost:5173";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

const roles = [
  {
    name: "admin",
    email: "qa.admin@test.com",
    home: "/admin",
    routes: ["/admin", "/admin/teachers", "/admin/students", "/admin/batches", "/admin/questions", "/admin/exams", "/admin/submissions", "/admin/results", "/admin/settings", "/admin/chat"],
  },
  {
    name: "teacher",
    email: "qa.teacher@test.com",
    home: "/teacher",
    routes: ["/teacher", "/teacher/students", "/teacher/batches", "/teacher/questions", "/teacher/exams", "/teacher/submissions", "/teacher/results", "/teacher/chat"],
  },
  {
    name: "ieltsStudent",
    email: "ielts.student@test.com",
    home: "/student",
    routes: ["/student", "/student/practice", "/student/results", "/student/progress", "/student/notifications", "/student/chat"],
  },
  {
    name: "pteStudent",
    email: "pte.student@test.com",
    home: "/student",
    routes: ["/student", "/student/practice", "/student/results", "/student/progress", "/student/chat"],
  },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const checks = [];

function record(scope, caseName, pass, detail = "") {
  checks.push({ scope, caseName, status: pass ? "PASS" : "FAIL", detail });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function loadSessions() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/testora";
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is required for browser smoke sessions");
  await mongoose.connect(mongoUri);
  const users = await mongoose.connection.db.collection("users").find({ email: { $in: roles.map((role) => role.email) } }).toArray();
  const sessions = new Map();
  for (const role of roles) {
    const user = users.find((item) => item.email === role.email);
    if (!user) throw new Error(`QA user not found: ${role.email}`);
    const accessToken = jwt.sign({ sub: String(user._id), role: user.role, type: "access" }, secret, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    });
    sessions.set(role.name, {
      accessToken,
      user: {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl || null,
      },
    });
  }
  await mongoose.disconnect();
  return sessions;
}

async function assertPageHealthy(page, scope, route) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForSelector("body", { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 10000 }).catch(() => undefined);
  const state = await page.evaluate(() => {
    const text = document.body.innerText;
    const root = document.documentElement;
    return {
      text,
      hOverflow: root.scrollWidth > window.innerWidth + 2,
      blank: text.trim().length < 10,
      path: window.location.pathname,
    };
  });
  record(scope, `Route renders ${route}`, !state.blank && !/page not found|something went wrong/i.test(state.text), state.path);
  record(scope, `No horizontal overflow ${route}`, !state.hOverflow, `${page.viewportSize()?.width}px`);
}

async function startAttempt(page, search, title) {
  return page.evaluate(
    async ({ search, title }) => {
      const auth = JSON.parse(localStorage.getItem("ielts-auth") || "{}");
      const token = auth?.state?.accessToken;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const listing = await fetch(`/api/student/practice?search=${encodeURIComponent(search)}&limit=10`, { credentials: "include", headers });
      const payload = await listing.json();
      const row = (payload.data || []).find((item) => item.exam?.title === title) || payload.data?.[0];
      if (!row?.exam?._id) throw new Error(`Exam not found: ${title}`);
      const started = await fetch(`/api/student/exams/${row.exam._id}/start`, { method: "POST", credentials: "include", headers });
      const startPayload = await started.json();
      if (!started.ok) {
        if (/attempt limit/i.test(startPayload.message || "") && row.attempt?._id) return row.attempt._id;
        throw new Error(startPayload.message || `Start failed: ${started.status}`);
      }
      return startPayload.data.attempt._id;
    },
    { search, title },
  );
}

async function assertAttemptPage(page, scope, attemptId, expectations) {
  await page.goto(`${BASE_URL}/student/exam/${attemptId}`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForSelector("body", { timeout: 10000 });
  await page.waitForFunction(() => /submit/i.test(document.body.innerText), null, { timeout: 12000 }).catch(() => undefined);
  const result = await page.evaluate(() => ({
    text: document.body.innerText,
    images: document.querySelectorAll("img").length,
    audio: document.querySelectorAll("audio").length,
    recordButtons: Array.from(document.querySelectorAll("button")).filter((button) => /record/i.test(button.textContent || "")).length,
    hOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
  }));
  record(scope, `Attempt renders ${expectations.name}`, /submit/i.test(result.text), result.text.slice(0, 80));
  if (expectations.image) record(scope, `Image prompt renders ${expectations.name}`, result.images > 0, `${result.images} images`);
  if (expectations.audio) record(scope, `Audio prompt renders ${expectations.name}`, result.audio > 0, `${result.audio} audio elements`);
  if (expectations.record) record(scope, `Recording control renders ${expectations.name}`, result.recordButtons > 0, `${result.recordButtons} record buttons`);
  record(scope, `No horizontal overflow attempt ${expectations.name}`, !result.hOverflow, `${page.viewportSize()?.width}px`);
}

async function main() {
  const sessions = await loadSessions();
  const browser = await launchBrowser();
  try {
    for (const viewport of viewports) {
      for (const role of roles) {
        const context = await browser.newContext({ viewport, baseURL: BASE_URL });
        const session = sessions.get(role.name);
        await context.addInitScript((auth) => {
          localStorage.setItem("ielts-auth", JSON.stringify({ state: auth, version: 0 }));
        }, session);
        const page = await context.newPage();
        const scope = `${viewport.name}:${role.name}`;
        const errors = [];
        page.on("pageerror", (err) => errors.push(err.message));
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });

        try {
          page.setDefaultTimeout(10000);
          await page.goto(`${BASE_URL}${role.home}`, { waitUntil: "domcontentloaded", timeout: 12000 });
          await page.waitForFunction((home) => window.location.pathname.startsWith(home), role.home, { timeout: 15000 });
          record(scope, "Authenticated session", page.url().includes(role.home), page.url());
          for (const route of role.routes) await assertPageHealthy(page, scope, route);

          if (role.name === "ieltsStudent") {
            const attemptId = await startAttempt(page, "[QA] IELTS Listening Test B", "[QA] IELTS Listening Test B");
            await assertAttemptPage(page, scope, attemptId, { name: "IELTS Listening", audio: true });
          }

          if (role.name === "pteStudent") {
            const listeningAttemptId = await startAttempt(page, "[QA] PTE Listening Practice", "[QA] PTE Listening Practice");
            await assertAttemptPage(page, scope, listeningAttemptId, { name: "PTE Listening", audio: true });
            const speakingAttemptId = await startAttempt(page, "[QA] PTE Speaking Practice", "[QA] PTE Speaking Practice");
            await assertAttemptPage(page, scope, speakingAttemptId, { name: "PTE Speaking", image: true, record: true });
          }

          record(scope, "No browser console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
        } catch (err) {
          record(scope, "Browser workflow", false, err instanceof Error ? err.message : String(err));
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failed = checks.filter((check) => check.status === "FAIL");
  console.table(checks);
  console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, failures: failed }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error("[browser-smoke] failed", err);
  process.exit(1);
});
