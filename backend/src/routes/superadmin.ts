import { Router as SARouter, Request as SAReq, Response as SARes } from "express";
import { prisma as saPrisma } from "../index";
import { authenticate as saAuth, authorize as saAuthz } from "../middleware/auth";

const saRouter = SARouter();
saRouter.use(saAuth, saAuthz("SUPERADMIN"));

// GET /api/superadmin/restaurants
saRouter.get("/restaurants", async (_req: SAReq, res: SARes) => {
  try {
    const restaurants = await saPrisma.restaurant.findMany({
      include: {
        subscription: true,
        _count: { select: { users: true, orders: true, menuItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ restaurants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// GET /api/superadmin/metrics
saRouter.get("/metrics", async (_req: SAReq, res: SARes) => {
  try {
    const totalRestaurants = await saPrisma.restaurant.count();
    const activeRestaurants = await saPrisma.restaurant.count({ where: { active: true } });
    const totalSubscriptions = await saPrisma.subscription.groupBy({
      by: ["plan"],
      _count: true,
    });
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = await saPrisma.restaurant.count({
      where: { createdAt: { gte: monthStart } },
    });

    res.json({
      totalRestaurants,
      activeRestaurants,
      newThisMonth,
      subscriptionsByPlan: totalSubscriptions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

export { saRouter as default };

