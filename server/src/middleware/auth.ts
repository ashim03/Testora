import { NextFunction, Request, Response } from "express";
import { User } from "../models";
import { verifyAccessToken } from "../utils/tokens";
import { ApiError } from "../utils/helpers";
import type { AccessPayload } from "../utils/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        status: string;
      };
    }
  }
}

export interface AuthUser {
  id: string;
  role: string;
  status: string;
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required");
    }
    const token = header.split(" ")[1];
    let payload: AccessPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === "TokenExpiredError") throw new ApiError(401, "Token expired");
      throw new ApiError(401, "Invalid token");
    }
    const user = await User.findById(payload.sub).select("role status").lean();
    if (!user || user.deletedAt) {
      throw new ApiError(401, "Account no longer exists");
    }
    if (user.status === "SUSPENDED") {
      throw new ApiError(403, "Account suspended");
    }
    if (user.status === "INACTIVE") {
      throw new ApiError(403, "Account is inactive");
    }
    req.user = { id: String(user._id), role: user.role, status: user.status };
    next();
  } catch (err) {
    next(err);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, "You do not have permission to perform this action"));
      return;
    }
    next();
  };
};

export const isActive = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.user && req.user.status === "INACTIVE") {
    next(new ApiError(403, "Account is inactive"));
    return;
  }
  next();
};