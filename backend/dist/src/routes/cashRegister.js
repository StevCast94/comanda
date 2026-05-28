"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const crRouter = (0, express_1.Router)();
exports.default = crRouter;
crRouter.use(auth_1.authenticate, tenant_1.tenantIsolation, subscription_1.checkSubscription);
// POST /api/cash-register/open
crRouter.post("/open", (0, auth_1.authorize)("CASHIER", "ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.cashRegister.findFirst({
            where: { restaurantId: req.restaurantId, status: "OPEN" },
        });
        if (existing) {
            res.status(400).json({ error: "Ya hay una caja abierta" });
            return;
        }
        const register = await index_1.prisma.cashRegister.create({
            data: {
                restaurantId: req.restaurantId,
                cashierId: req.user.userId,
                openingBalance: req.body.openingBalance || 0,
            },
        });
        res.status(201).json({ register });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error abriendo caja" });
    }
});
// POST /api/cash-register/close
crRouter.post("/close", (0, auth_1.authorize)("CASHIER", "ADMIN"), async (req, res) => {
    try {
        const register = await index_1.prisma.cashRegister.findFirst({
            where: { restaurantId: req.restaurantId, status: "OPEN" },
        });
        if (!register) {
            res.status(400).json({ error: "No hay caja abierta" });
            return;
        }
        const expectedBalance = register.openingBalance + register.totalSales - register.totalExpenses;
        const closed = await index_1.prisma.cashRegister.update({
            where: { id: register.id },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closingBalance: req.body.closingBalance || 0,
                expectedBalance,
                notes: req.body.notes,
            },
        });
        res.json({ register: closed });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cerrando caja" });
    }
});
// GET /api/cash-register/current
crRouter.get("/current", (0, auth_1.authorize)("CASHIER", "ADMIN"), async (req, res) => {
    try {
        const register = await index_1.prisma.cashRegister.findFirst({
            where: { restaurantId: req.restaurantId, status: "OPEN" },
            include: { cashier: { select: { name: true } } },
        });
        res.json({ register });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
//# sourceMappingURL=cashRegister.js.map