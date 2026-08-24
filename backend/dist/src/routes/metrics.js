"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const router = (0, express_1.Router)();
// GET /api/metrics — público, sin auth. Consumido por Matrix (cron cada 6h).
router.get("/", async (_req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [restaurantsTotal, restaurantsActive, usersTotal, ordersToday, revenueToday, revenueMonth, subscriptionsTrial, subscriptionsActive,] = await Promise.all([
            index_1.prisma.restaurant.count(),
            index_1.prisma.restaurant.count({ where: { active: true } }),
            index_1.prisma.user.count({ where: { active: true } }),
            index_1.prisma.order.count({ where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } } }),
            index_1.prisma.order.aggregate({
                _sum: { total: true },
                where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
            }),
            index_1.prisma.order.aggregate({
                _sum: { total: true },
                where: { createdAt: { gte: monthStart }, status: { not: "CANCELLED" } },
            }),
            index_1.prisma.subscription.count({ where: { status: "TRIAL" } }),
            index_1.prisma.subscription.count({ where: { status: "ACTIVE" } }),
        ]);
        res.json({
            restaurants_total: restaurantsTotal,
            restaurants_active: restaurantsActive,
            users_total: usersTotal,
            orders_today: ordersToday,
            revenue_today: (revenueToday._sum.total ?? 0).toFixed(2),
            revenue_month: (revenueMonth._sum.total ?? 0).toFixed(2),
            subscriptions_trial: subscriptionsTrial,
            subscriptions_active: subscriptionsActive,
            support_tickets_open: 0, // módulo de tickets aún no implementado
            updated_at: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al calcular métricas" });
    }
});
exports.default = router;
//# sourceMappingURL=metrics.js.map