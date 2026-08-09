import mongoose from "mongoose";
import { config } from "./index";

export async function connectDatabase(): Promise<void> {
  try {
    const conn = await mongoose.connect(config.mongodbUri);
    console.log(`[db] connected to ${conn.connection.host}`);
  } catch (error) {
    console.error("[db] connection error:", error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}