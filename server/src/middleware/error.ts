import { NextFunction, Request, Response } from "express";
import { validateWithSchema, type ValidationResult } from "./validate";
import { ApiError } from "../utils/helpers";

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors ?? undefined,
    });
    return;
  }
  if (err instanceof Error && "kind" in (err as unknown as { kind?: string }) && (err as unknown as { kind: string }).kind === "ObjectId") {
    res.status(400).json({ success: false, message: "Invalid identifier" });
    return;
  }
  const code = (err as { code?: number }).code;
  if (Number(code) === 11000) {
    res.status(409).json({ success: false, message: "Duplicate record already exists" });
    return;
  }
  if (err instanceof Error && err.name === "JsonWebTokenError") {
    res.status(401).json({ success: false, message: "Invalid token" });
    return;
  }
  if (err instanceof Error && err.name === "TokenExpiredError") {
    res.status(401).json({ success: false, message: "Token expired" });
    return;
  }
  if (err instanceof Error && err.name === "MulterError") {
    res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    return;
  }
  console.error("[error]", err);
  const message = process.env.NODE_ENV === "production" ? "Internal server error" : "Internal server error";
  res.status(500).json({ success: false, message });
};

export const validateRequest = (schema: Parameters<typeof validateWithSchema>[0]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result: ValidationResult<unknown> = validateWithSchema(schema, req.body);
    if ("errors" in result) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
};

export const validateQuery = (schema: Parameters<typeof validateWithSchema>[0]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result: ValidationResult<unknown> = validateWithSchema(schema, req.query);
    if ("errors" in result) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.errors,
      });
      return;
    }
    req.query = result.data as Request["query"];
    next();
  };
};