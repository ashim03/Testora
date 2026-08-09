import { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  statusCode: number;
  errors?: Array<{ field?: string; message: string }>;

  constructor(
    statusCode: number,
    message: string,
    errors?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const sendSuccess = (
  res: Response,
  message: string,
  data?: unknown,
  pagination?: { page: number; limit: number; total: number; pages: number },
): Response => {
  const body: Record<string, unknown> = { success: true, message };
  if (data !== undefined) body.data = data;
  if (pagination) body.pagination = pagination;
  return res.status(200).json(body);
};

export const sendCreated = (res: Response, message: string, data?: unknown): Response => {
  return res.status(201).json({ success: true, message, data });
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export const asyncWrapper =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export const round = (value: number, digits = 2): number => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

export const parseSort = (sort: string, allowed: string[]): Record<string, 1 | -1> => {
  const field = sort.replace(/^-/, "");
  const dir = sort.startsWith("-") ? -1 : 1;
  if (!allowed.includes(field)) return { createdAt: -1 };
  return { [field]: dir };
};

export const generateReceipt = (): string =>
  `RCPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;