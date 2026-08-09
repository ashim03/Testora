import { NextFunction, Request, Response } from "express";

/**
 * Recursively looks for a key starting with `$` (MongoDB operator) at any depth.
 * Express parses `?status[$ne]=ACTIVE` into nested objects; this guard blocks
 * those before they reach query/filter building.
 */
export function containsOperator(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsOperator(item, seen));
  }
  return Object.keys(value as Record<string, unknown>).some((key) => {
    if (key.startsWith("$")) return true;
    return containsOperator((value as Record<string, unknown>)[key], seen);
  });
}

/**
 * Rejects NoSQL operator injection in query params and request body.
 */
export function sanitizeMongoQuery(req: Request, res: Response, next: NextFunction): void {
  const queryBad = containsOperator(req.query);
  const bodyBad = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? containsOperator(req.body)
    : false;
  if (queryBad || bodyBad) {
    res.status(400).json({ success: false, message: "Invalid query parameters" });
    return;
  }
  next();
}

/**
 * Clamps `page` and `limit` query params to safe ranges and integer values.
 */
export function sanitizePagination(req: Request, res: Response, next: NextFunction): void {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;
  if (pageRaw !== undefined) {
    const n = Number(pageRaw);
    req.query.page = Number.isFinite(n) ? String(Math.max(1, Math.floor(n))) : "1";
  }
  if (limitRaw !== undefined) {
    const n = Number(limitRaw);
    req.query.limit = Number.isFinite(n) ? String(Math.min(100, Math.max(1, Math.floor(n)))) : "10";
  }
  next();
}