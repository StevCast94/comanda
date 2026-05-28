import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";

const router = Router();
router.use(authenticate, tenantIsolation, authorize("ADMIN"));
// TODO: Phase 2
export default router;
