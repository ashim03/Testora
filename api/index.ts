import { createApp } from "../server/src/app";
import { connectDatabase } from "../server/src/config/db";

let dbPromise: Promise<void> | null = null;

function ensureDatabase(): Promise<void> {
  if (!dbPromise) {
    dbPromise = connectDatabase().catch((err) => {
      console.error("[vercel] database connection failed:", err);
      dbPromise = null;
    });
  }
  return dbPromise;
}

const app = createApp();

ensureDatabase();

export default app;
