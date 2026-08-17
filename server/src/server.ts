import { config, validateEnv } from "./config";
import { connectDatabase } from "./config/db";
import { createApp } from "./app";
import { startAutoSubmitInterval } from "./jobs/autoSubmit";
import { startAssignmentReminderInterval } from "./jobs/assignmentReminders";

async function bootstrap(): Promise<void> {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });
  try {
    validateEnv();
    await connectDatabase();
    startAutoSubmitInterval();
    startAssignmentReminderInterval();
  } catch (error) {
    console.error("[server] database/env init failed:", error);
    console.error("[server] retrying database connection every 10s");
    const retry = setInterval(async () => {
      try {
        await connectDatabase();
        startAutoSubmitInterval();
        startAssignmentReminderInterval();
        clearInterval(retry);
        console.log("[server] database connected after retry");
      } catch (err) {
        console.error("[server] database retry failed:", err);
      }
    }, 10000);
  }
}

bootstrap().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
