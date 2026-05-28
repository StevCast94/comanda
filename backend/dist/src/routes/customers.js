"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, tenant_1.tenantIsolation, (0, auth_1.authorize)("ADMIN"));
// TODO: Phase 2
exports.default = router;
//# sourceMappingURL=customers.js.map