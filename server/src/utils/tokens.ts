import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config";

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export interface TokenPayload {
  sub: string;
  role: string;
  type: "access" | "refresh";
}

export interface AccessPayload extends TokenPayload {
  type: "access";
}

export const signAccessToken = (userId: string, role: string): string =>
  jwt.sign({ sub: userId, role, type: "access" }, config.jwtAccessSecret, {
    expiresIn: config.jwtAccessExpiresIn as jwt.SignOptions["expiresIn"],
  });

export const signRefreshToken = (userId: string, role: string): string =>
  jwt.sign({ sub: userId, role, type: "refresh" }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): AccessPayload =>
  jwt.verify(token, config.jwtAccessSecret) as AccessPayload;

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;

export const randomToken = (): string => crypto.randomBytes(32).toString("hex");

export const sanitizeUser = (
  user: {
    _id: unknown;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
    avatarUrl?: string | null;
  },
): {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
} => ({
  id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl || null,
});