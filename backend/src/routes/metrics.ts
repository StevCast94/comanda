import { Router } from "express";
import { prisma } from "../index";

const router = Router();

// GET /api/metrics — público, sin auth. Consumido por Matrix (cron cada 6h).
router.get("/", async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      restaurantsTotal,
      restaurantsActive,
      usersTotal,
      ordersToday,
      revenueToday,
      revenueMonth,
      subscriptionsTrial,
      subscriptionsActive,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: todayStart }, status: { not: "CANCELLED" } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: monthStart }, status: { not: "CANCELLED" } },
      }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular métricas" });
  }
});

export default router;
