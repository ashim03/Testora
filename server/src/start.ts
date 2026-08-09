import { connectDatabase, disconnectDatabase } from "./config/db";
import { startAutoSubmitInterval } from "./jobs/autoSubmit";

export async function startApp(): Promise<void> {
  await connectDatabase();
  startAutoSubmitInterval();
}

export { disconnectDatabase };