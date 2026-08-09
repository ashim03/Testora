import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

export interface ServerConfig {
  nodeEnv: string;
  port: number;
  clientUrl: string;
  mongodbUri: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  cookieSecret: string;
  maxFileSizeMb: number;
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

export const config: ServerConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  clientUrl: read("CLIENT_URL") || "http://localhost:5173",
  mongodbUri: read("MONGODB_URI"),
  jwtAccessSecret: read("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: read("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  cookieSecret: read("COOKIE_SECRET"),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 20),
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