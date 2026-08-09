import { Request, Response } from "express";
import * as authService from "../services/authService";
import * as userService from "../services/userService";
import { ApiError, asyncHandler } from "../utils/helpers";

const REFRESH_COOKIE = "refresh_token";

function setRefreshCookie(res: Response, token: string | undefined): void {
  if (!token) {
    res.clearCookie(REFRESH_COOKIE, cookieOpts());
    return;
  }
  res.cookie(REFRESH_COOKIE, token, cookieOpts());
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const ip = req.ip || null;
  const result: { accessToken: string; user: unknown; refreshToken: string } = await authService.login(email, password, ip);
  setRefreshCookie(res, result.refreshToken);
  res.json({ success: true, message: "Login successful", data: { accessToken: result.accessToken, user: result.user } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) || ((req.body as { refreshToken?: string } | undefined)?.refreshToken);
  if (!token) throw new ApiError(401, "Refresh token required");
  const result = await authService.refreshToken(token);
  setRefreshCookie(res, (result as { refreshToken?: string }).refreshToken);
  res.json({ success: true, message: "Token refreshed", data: { accessToken: (result as { accessToken: string }).accessToken } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(token);
  setRefreshCookie(res, undefined);
  res.json({ success: true, message: "Logged out" });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const token = await authService.forgotPassword(email);
  res.json({ success: true, message: "If that email exists, a reset token has been issued", data: { resetToken: process.env.NODE_ENV === "production" ? undefined : token } });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);
  res.json({ success: true, message: "Password reset successfully" });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: "Password changed" });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const user = await authService.getUserPublic(req.user.id);
  res.json({ success: true, message: "Current user", data: user });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const profile = await userService.updateSelfProfile(req.user.id, req.body);
  res.json({ success: true, message: "Profile updated", data: profile });
});

export const getSelfFull = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const profile = await userService.getSelfProfile(req.user.id);
  res.json({ success: true, message: "Profile", data: profile });
});

export const deleteOwnAccount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, "Authentication required");
  await userService.softDeleteUser(req.user.id, req.user, req.ip);
  res.json({ success: true, message: "Account scheduled for deletion" });
});