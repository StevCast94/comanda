"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const kitRouter = (0, express_1.Router)();
exports.default = kitRouter;
kitRouter.use(auth_1.authenticate, tenant_1.tenantIsolation);
// GET /api/kitchen/orders?status=PENDING,PREPARING
// Unified KDS — ALL kitchen stations (except NONE) shown in one screen
// COOK_1, COOK_2, ADMIN all see the same view
kitRouter.get("/orders", (0, auth_1.authorize)("COOK_1", "COOK_2", "ADMIN"), async (req, res) => {
    try {
        const { status } = req.query;
        const statuses = status ? status.split(",") : ["PENDING", "PREPARING"];
        // All non-NONE items visible to the single kitchen screen
        const items = await index_1.prisma.orderItem.findMany({
            where: {
                kitchen: { not: "NONE" },
                status: { in: statuses },
                order: {
                    restaurantId: req.restaurantId,
                    status: { in: ["PAID", "PREPARING", "READY"] },
                },
            },
            include: {
                order: {
                    select: {
                        id: true, orderNumber: true, tableId: true, orderType: true, customerName: true, createdAt: true,
                        table: { select: { number: true, floor: true } },
                    },
                },
                menuItem: { select: { name: true, prepTime: true } },
                combo: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
        });
        // Group by order
        const orderMap = new Map();
        for (const item of items) {
            const key = item.order.id;
            if (!orderMap.has(key))
                orderMap.set(key, { order: item.order, items: [] });
            orderMap.get(key).items.push(item);
        }
        res.json({ orders: Array.from(orderMap.values()) });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando órdenes de cocina" });
    }
});
// PATCH /api/kitchen/items/:id/status — Atomic: update item + check order readiness in one transaction
kitRouter.patch("/items/:id/status", (0, auth_1.authorize)("COOK_1", "COOK_2", "ADMIN"), async (req, res) => {
    try {
        const { status } = req.body;
        const result = await index_1.prisma.$transaction(async (tx) => {
            const updateData = { status };
            if (status === "PREPARING")
                updateData.prepStartedAt = new Date();
            if (status === "READY")
                updateData.readyAt = new Date();
            const item = await tx.orderItem.update({
                where: { id: req.params.id },
                data: updateData,
                include: { order: { select: { id: true, restaurantId: true } } },
            });
            // Count remaining non-NONE, non-READY items (atomic within tx)
            const pendingItems = await tx.orderItem.count({
                where: { orderId: item.orderId, status: { not: "READY" }, kitchen: { not: "NONE" } },
            });
            if (pendingItems === 0) {
                await tx.order.update({
                    where: { id: item.orderId },
                    data: { status: "READY" },
                });
            }
            else if (status === "PREPARING") {
                await tx.order.update({
                    where: { id: item.orderId },
                    data: { status: "PREPARING" },
                });
            }
            return { item, allReady: pendingItems === 0 };
        });
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error actualizando ítem" });
    }
});
//# sourceMappingURL=kitchen.js.map