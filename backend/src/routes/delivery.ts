import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";

const router = Router();
router.use(authenticate, tenantIsolation);
// TODO: Phase 3
export default router;
