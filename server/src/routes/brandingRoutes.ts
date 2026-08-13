import { Router } from "express";
import * as branding from "../controllers/brandingController";
import { authenticate, authorize } from "../middleware/auth";
import { validateRequest } from "../middleware/error";
import { brandingSchema } from "@testora-platform/shared";

const router = Router();

router.get("/", branding.getActive);
router.get("/mine", authenticate, authorize("SUPER_ADMIN", "TEACHER"), branding.getMine);
router.put("/", authenticate, authorize("SUPER_ADMIN"), validateRequest(brandingSchema as never), branding.put);
router.post("/logo/clear", authenticate, authorize("SUPER_ADMIN"), branding.clearLogo);

export default router;