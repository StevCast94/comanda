"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const PLANS = [
    { id: "FREE", name: "Gratis", price: 0, billing: "forever", maxUsers: 3, maxProducts: 50, maxCombos: 5, features: { delivery: false, advancedReports: false, whatsapp: false } },
    { id: "TRIAL", name: "Prueba", price: 0, billing: "14 días", maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
    { id: "BASIC", name: "Básico", price: 29, billing: "mensual", maxUsers: 7, maxProducts: 200, maxCombos: 20, features: { delivery: true, advancedReports: false, whatsapp: false } },
    { id: "PRO", name: "Profesional", price: 59, billing: "mensual", maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
    { id: "ENTERPRISE", name: "Empresarial", price: 99, billing: "mensual", maxUsers: 9999, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: true } },
];
router.get("/", (_req, res) => {
    res.json({ plans: PLANS });
});
exports.default = router;
//# sourceMappingURL=plans.js.map