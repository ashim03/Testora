import { Router } from "express";
import * as authController from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { authLimiter } from "../middleware/rateLimit";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, updateProfileSchema } from "@ielts-pte-platform/shared";

const router = Router();

router.post("/login", authLimiter, validateRequest(loginSchema as never), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", validateRequest(forgotPasswordSchema as never), authController.forgotPassword);
router.post("/reset-password", validateRequest(resetPasswordSchema as never), authController.resetPassword);
router.patch("/change-password", authenticate, validateRequest(changePasswordSchema as never), authController.changePassword);
router.get("/me", authenticate, authController.me);
router.get("/me/full", authenticate, authController.getSelfFull);
router.patch("/me", authenticate, validateRequest(updateProfileSchema as never), authController.updateProfile);
router.post("/delete-account", authenticate, authController.deleteOwnAccount);

export default router;