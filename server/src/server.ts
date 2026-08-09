import { config, validateEnv } from "./config";
import { connectDatabase } from "./config/db";
import { createApp } from "./app";
import { startAutoSubmitInterval } from "./jobs/autoSubmit";

async function bootstrap(): Promise<void> {
  validateEnv();
  await connectDatabase();
  startAutoSubmitInterval();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});