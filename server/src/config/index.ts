import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

export interface ServerConfig {
  nodeEnv: string;
  port: number;
  clientUrl: string;
  allowedOrigins: string[];
  mongodbUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  cookieSecret: string;
  maxFileSizeMb: number;
  audioMaxSizeMb: number;
  uploadsDir: string;
  speaking: {
    maxDurationSec: number;
    minDurationSec: number;
    maxSizeMb: number;
    keepAudio: boolean;
  };
  isProduction: boolean;
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
}

function fail(message: string): void {
  throw new Error(`[config] ${message}`);
}

function read(name: string): string {
  const value = process.env[name];
  if (!value) fail(`Missing environment variable: ${name}`);
  return value;
}

function safeRead(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config: ServerConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  clientUrl: safeRead("CLIENT_URL", "http://localhost:5173"),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
  mongodbUri: process.env.MONGODB_URI || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  cookieSecret: process.env.COOKIE_SECRET || "",
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 20),
  audioMaxSizeMb: Number(process.env.AUDIO_MAX_SIZE_MB || 30),
  uploadsDir: process.env.UPLOADS_DIR || "uploads",
  speaking: {
    maxDurationSec: Number(process.env.SPEAKING_MAX_DURATION_SEC || 180),
    minDurationSec: Number(process.env.SPEAKING_MIN_DURATION_SEC || 5),
    maxSizeMb: Number(process.env.SPEAKING_MAX_SIZE_MB || 30),
    keepAudio: String(process.env.SPEAKING_KEEP_AUDIO || "").toLowerCase() === "true",
  },
  isProduction: process.env.NODE_ENV === "production",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
};

export function validateEnv(): void {
  read("MONGODB_URI");
  read("JWT_ACCESS_SECRET");
  read("JWT_REFRESH_SECRET");
  read("COOKIE_SECRET");
}