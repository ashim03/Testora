import crypto from "crypto";
import { User, RefreshToken, PasswordResetToken } from "../models";
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  randomToken,
  sanitizeUser,
} from "../utils/tokens";
import { ApiError } from "../utils/helpers";
import { config } from "../config";
import { logActivity, audit } from "./notificationService";

const refreshTtlMs = (): number => {
  const days = parseDays(config.jwtRefreshExpiresIn);
  return days * 24 * 60 * 60 * 1000;
};

function parseDays(exp: string): number {
  const match = /^(\d+)[dD]$/.exec(exp);
  if (match) return Number(match[1]);
  return 7;
}

export async function login(
  email: string,
  password: string,
  ip?: string | null,
): Promise<{ accessToken: string; user: unknown; refreshToken: string }> {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) throw new ApiError(401, "Invalid email or password");
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password");
  if (user.status === "SUSPENDED") {
    throw new ApiError(403, "Account suspended. Contact your administrator.");
  }
  if (user.status === "INACTIVE") {
    throw new ApiError(403, "Account is inactive. Contact your administrator.");
  }
  user.lastLoginAt = new Date();
  await user.save();
  const payload = sanitizeUser(user);
  const accessToken = signAccessToken(payload.id, payload.role);
  const refreshToken = await storeRefreshToken(payload.id);
  await logActivity(payload.id, "LOGIN", "User", null, { email }, ip);
  return { accessToken, user: payload, refreshToken };
}

async function storeRefreshToken(userId: string): Promise<string> {
  const token = signRefreshToken(userId, "refresh");
  await RefreshToken.create({
    userId,
    token: hashRefresh(token),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
  return token;
}

const hashRefresh = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function loginResponse(
  userId: string,
  role: string,
  refreshToken?: string,
): Promise<{ accessToken: string; user: unknown; refreshToken?: string }> {
  return { accessToken: signAccessToken(userId, role), user: await getUserPublic(userId), refreshToken };
}

export async function refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await RefreshToken.findOne({ token: hashRefresh(refreshToken) });
  if (!stored || stored.revoked) throw new ApiError(401, "Invalid refresh token");
  if (stored.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, "Refresh token expired");
  }
  const user = await User.findById(payload.sub);
  if (!user || user.deletedAt || user.status === "SUSPENDED") {
    throw new ApiError(401, "Account unavailable");
  }
  const newRefresh = signRefreshToken(String(user._id), user.role);
  await RefreshToken.updateOne({ _id: stored._id }, { $set: { revoked: true, replacedBy: hashRefresh(newRefresh) } });
  await RefreshToken.create({
    userId: user._id,
    token: hashRefresh(newRefresh),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
  return { accessToken: signAccessToken(String(user._id), user.role), refreshToken: newRefresh };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const stored = await RefreshToken.findOne({ token: hashRefresh(refreshToken) });
  if (stored) {
    stored.revoked = true;
    await stored.save();
  }
}

export async function getUserPublic(userId: string): Promise<unknown> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return sanitizePerson(user);
}

const sanitizePerson = (user: {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
}) => sanitizeUser(user);

export async function forgotPassword(email: string): Promise<string> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, "No account found with that email");
  const token = randomToken();
  await PasswordResetToken.create({
    userId: user._id,
    token: hashRefresh(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await logActivity(String(user._id), "FORGOT_PASSWORD", "User", null, { email });
  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await PasswordResetToken.findOne({ token: hashRefresh(token) });
  if (!record || record.used) throw new ApiError(400, "Invalid or already-used reset token");
  if (record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "Reset token expired");
  }
  const user = await User.findById(record.userId);
  if (!user) throw new ApiError(404, "User not found");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  record.used = true;
  await record.save();
  await RefreshToken.deleteMany({ userId: user._id });
  await audit("PASSWORD_RESET", {
    actorId: user._id,
    actorRole: user.role,
    entityType: "User",
    entityId: String(user._id),
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new ApiError(404, "User not found");
  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(400, "Current password is incorrect");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await RefreshToken.deleteMany({ userId: user._id });
  await audit("CHANGE_PASSWORD", {
    actorId: user._id,
    actorRole: user.role,
    entityType: "User",
    entityId: String(user._id),
  });
}

export async function createRefreshRecord(userId: string): Promise<void> {
  await RefreshToken.create({
    userId,
    token: randomToken(),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
}