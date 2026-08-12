import mongoose from "mongoose";
import { createApp } from "../server/src/app";
import { connectDatabase } from "../server/src/config/db";

let dbPromise: Promise<void> | null = null;

function ensureDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!dbPromise || mongoose.connection.readyState === 0) dbPromise = connectDatabase();
  return dbPromise;
}

const app = createApp({
  beforeApi: async (_req, _res, next) => {
    try {
      await ensureDatabase();
      next();
    } catch (err) {
      dbPromise = null;
      next(err);
    }
  },
});

export default app;
