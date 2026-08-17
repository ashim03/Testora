import { config, validateEnv } from "./config";
import { connectDatabase } from "./config/db";
import { createApp } from "./app";
import { startAutoSubmitInterval } from "./jobs/autoSubmit";
import { startAssignmentReminderInterval } from "./jobs/assignmentReminders";

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  let jobsStarted = false;
  const startJobs = (): void => {
    if (jobsStarted) return;
    startAutoSubmitInterval();
    startAssignmentReminderInterval();
    jobsStarted = true;
  };

  try {
    await connectDatabase();
    startJobs();
  } catch (error) {
    console.error("[server] database init failed:", error);
    console.error("[server] retrying database connection every 10s");
    const retry = setInterval(async () => {
      try {
        await connectDatabase();
        startJobs();
        clearInterval(retry);
        console.log("[server] database connected after retry");
      } catch (err) {
        console.error("[server] database retry failed:", err);
      }
    }, 10000);
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} received; shutting down`);
    server.close(async () => {
      try {
        await import("mongoose").then(({ default: mongoose }) => mongoose.connection.close(false));
        console.log("[server] shutdown complete");
        process.exit(0);
      } catch (error) {
        console.error("[server] shutdown failed", error);
        process.exit(1);
      }
    });
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
