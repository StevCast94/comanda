"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const saRouter = (0, express_1.Router)();
exports.default = saRouter;
saRouter.use(auth_1.authenticate, (0, auth_1.authorize)("SUPERADMIN"));
// GET /api/superadmin/restaurants
saRouter.get("/restaurants", async (_req, res) => {
    try {
        const restaurants = await index_1.prisma.restaurant.findMany({
            include: {
                subscription: true,
                _count: { select: { users: true, orders: true, menuItems: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ restaurants });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// GET /api/superadmin/metrics
saRouter.get("/metrics", async (_req, res) => {
    try {
        const totalRestaurants = await index_1.prisma.restaurant.count();
        const activeRestaurants = await index_1.prisma.restaurant.count({ where: { active: true } });
        const totalSubscriptions = await index_1.prisma.subscription.groupBy({
            by: ["plan"],
            _count: true,
        });
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const newThisMonth = await index_1.prisma.restaurant.count({
            where: { createdAt: { gte: monthStart } },
        });
        res.json({
            totalRestaurants,
            activeRestaurants,
            newThisMonth,
            subscriptionsByPlan: totalSubscriptions,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
//# sourceMappingURL=superadmin.js.map