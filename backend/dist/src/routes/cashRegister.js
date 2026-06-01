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
        // Recalcular expectedBalance basado en órdenes reales del día
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const ordersToday = await index_1.prisma.order.findMany({
            where: {
                restaurantId: req.restaurantId,
                paidAt: { gte: today, lt: tomorrow },
                status: { not: "CANCELLED" },
            },
            select: { total: true, paymentMethod: true },
        });
        // Calcular por método de pago desde las órdenes REALES
        let realCash = 0, realCard = 0, realTransfer = 0;
        for (const o of ordersToday) {
            if (o.paymentMethod === "CASH")
                realCash += o.total;
            else if (o.paymentMethod === "CARD")
                realCard += o.total;
            else if (o.paymentMethod === "TRANSFER")
                realTransfer += o.total;
        }
        const realTotalSales = realCash + realCard + realTransfer;
        const expectedBalance = register.openingBalance + realTotalSales - register.totalExpenses;
        // Detectar discrepancia vs lo que la caja registró en memoria
        const discrepancy = Math.round((register.totalSales - realTotalSales) * 100) / 100;
        const hasDiscrepancy = Math.abs(discrepancy) > 0.01;
        const closingBalance = req.body.closingBalance !== undefined ? req.body.closingBalance : expectedBalance;
        const closingDiscrepancy = Math.round((closingBalance - expectedBalance) * 100) / 100;
        const hasClosingDiscrepancy = Math.abs(closingDiscrepancy) > 0.01;
        const closed = await index_1.prisma.cashRegister.update({
            where: { id: register.id },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                closingBalance,
                expectedBalance,
                totalSales: realTotalSales,
                totalCash: realCash,
                totalCard: realCard,
                totalTransfer: realTransfer,
                notes: req.body.notes ?
                    `${req.body.notes}${hasDiscrepancy ? ` | ⚠️ Discrepancia: la caja reportó $${discrepancy.toFixed(2)} más de lo facturado` : ""}${hasClosingDiscrepancy ? ` | ⚠️ Cierre difiere $${closingDiscrepancy.toFixed(2)} del esperado` : ""}`
                    : `${hasDiscrepancy ? `⚠️ Discrepancia: caja reportó $${discrepancy.toFixed(2)} más de lo facturado` : "✅ Sin discrepancia"}${hasClosingDiscrepancy ? ` | ⚠️ Cierre difiere $${closingDiscrepancy.toFixed(2)} del esperado` : ""}`,
            },
        });
        res.json({
            register: closed,
            verification: {
                openingBalance: register.openingBalance,
                realSales: realTotalSales,
                expectedBalance,
                closingBalance,
                discrepancy: hasDiscrepancy ? discrepancy : 0,
                closingDiscrepancy: hasClosingDiscrepancy ? closingDiscrepancy : 0,
                breakdown: { cash: realCash, card: realCard, transfer: realTransfer },
            },
        });
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
// GET /api/cash-register/history
crRouter.get("/history", (0, auth_1.authorize)("CASHIER", "ADMIN"), async (req, res) => {
    try {
        const registers = await index_1.prisma.cashRegister.findMany({
            where: { restaurantId: req.restaurantId, status: "CLOSED" },
            include: { cashier: { select: { name: true } } },
            orderBy: { closedAt: "desc" },
            take: 30,
        });
        res.json({ registers });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
//# sourceMappingURL=cashRegister.js.map