"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const waitRouter = (0, express_1.Router)();
exports.default = waitRouter;
waitRouter.use(auth_1.authenticate, tenant_1.tenantIsolation);
// GET /api/waiter/pending?orderType=DINE_IN,TAKEAWAY — Orders ready for delivery
waitRouter.get("/pending", (0, auth_1.authorize)("WAITER", "ADMIN"), async (req, res) => {
    try {
        const orderTypeParam = req.query.orderType;
        const orderTypes = orderTypeParam ? orderTypeParam.split(",") : ["DINE_IN", "TAKEAWAY"];
        const orders = await index_1.prisma.order.findMany({
            where: {
                restaurantId: req.restaurantId,
                status: "READY",
                orderType: { in: orderTypes },
            },
            include: {
                items: {
                    include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } },
                },
                table: { select: { number: true, floor: true } },
            },
            orderBy: { updatedAt: "asc" },
        });
        res.json({ orders });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// PATCH /api/waiter/deliver/:id
waitRouter.patch("/deliver/:id", (0, auth_1.authorize)("WAITER", "ADMIN"), async (req, res) => {
    try {
        const order = await index_1.prisma.order.update({
            where: { id: req.params.id },
            data: {
                status: "DELIVERED",
                deliveredAt: new Date(),
                waiterId: req.user.userId,
                items: { updateMany: { where: { status: "READY" }, data: { status: "DELIVERED" } } },
            },
        });
        res.json({ order });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error entregando orden" });
    }
});
//# sourceMappingURL=waiter.js.map