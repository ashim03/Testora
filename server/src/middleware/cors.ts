import { NextFunction, Request, RequestHandler, Response } from "express";

export type OriginDecision = "same-origin" | "known" | "deny";

export function resolveOriginDecision(
  origin: string | undefined,
  host: string | undefined,
  knownOrigins: readonly string[],
): OriginDecision {
  if (!origin) return "known";
  if (!host) return "deny";
  if (origin === `https://${host}` || origin === `http://${host}`) return "same-origin";
  return knownOrigins.some((known) => known.trim() === origin) ? "known" : "deny";
}

export function createCorsMiddleware(knownOrigins: readonly string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const decision = resolveOriginDecision(origin, host, knownOrigins);

    if (decision === "deny") {
      res.status(403).json({ success: false, message: "Origin not allowed by server configuration" });
      return;
    }

    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  };
}