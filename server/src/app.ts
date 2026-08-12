import express, { Application, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { config } from "./config";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import teacherRoutes from "./routes/teacherRoutes";
import questionRoutes from "./routes/questionRoutes";
import examRoutes from "./routes/examRoutes";
import studentRoutes from "./routes/studentRoutes";
import courseRoutes from "./routes/courseRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import brandingRoutes from "./routes/brandingRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import chatRoutes from "./routes/chatRoutes";
import { apiLimiter } from "./middleware/rateLimit";
import { sanitizeMongoQuery, sanitizePagination } from "./middleware/sanitize";
import { notFound, errorHandler } from "./middleware/error";

type CreateAppOptions = {
  beforeApi?: RequestHandler | RequestHandler[];
};

export function createApp(options: CreateAppOptions = {}): Application {
  const app = express();

  if (config.isProduction) app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        const allowed = [config.clientUrl].filter(Boolean);
        if (!origin || allowed.includes(origin)) cb(null, true);
        else cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(config.cookieSecret));
  if (!config.isProduction) app.use(morgan("dev"));
  app.use("/api", apiLimiter);

  const api = express.Router();
  if (options.beforeApi) api.use(options.beforeApi);
  api.use(sanitizeMongoQuery);
  api.use(sanitizePagination);
  api.get("/health", (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Health check ok",
      data: {
        time: new Date().toISOString(),
        db: mongoose.connection.readyState,
      },
    });
  });
  api.use("/auth", authRoutes);
  api.use("/admin", adminRoutes);
  api.use("/teacher", teacherRoutes);
  api.use("/questions", questionRoutes);
  api.use("/exams", examRoutes);
  api.use("/student", studentRoutes);
  api.use("/courses", courseRoutes);
  api.use("/media", mediaRoutes);
  api.use("/branding", brandingRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/chat", chatRoutes);

  app.use("/api", api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
