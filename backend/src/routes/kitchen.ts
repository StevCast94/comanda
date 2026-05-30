import { Router as KitRouter, Request as KitReq, Response as KitRes } from "express";
import { prisma as kitPrisma } from "../index";
import { authenticate as kitAuth, authorize as kitAuthz } from "../middleware/auth";
import { tenantIsolation as kitTenant } from "../middleware/tenant";

const kitRouter = KitRouter();
kitRouter.use(kitAuth, kitTenant);

// GET /api/kitchen/orders?status=PENDING,PREPARING
// Unified KDS — ALL kitchen stations (except NONE) shown in one screen
// COOK_1, COOK_2, ADMIN all see the same view
kitRouter.get("/orders", kitAuthz("COOK_1", "COOK_2", "ADMIN"), async (req: KitReq, res: KitRes) => {
  try {
    const { status } = req.query;
    const statuses = status ? (status as string).split(",") : ["PENDING", "PREPARING"];

    // All non-NONE items visible to the single kitchen screen
    const items = await kitPrisma.orderItem.findMany({
      where: {
        kitchen: { not: "NONE" },
        status: { in: statuses as ("PENDING" | "PREPARING" | "READY" | "DELIVERED")[] },
        order: {
          restaurantId: req.restaurantId!,
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
    const orderMap = new Map<string, { order: typeof items[0]["order"]; items: typeof items }>();
    for (const item of items) {
      const key = item.order.id;
      if (!orderMap.has(key)) orderMap.set(key, { order: item.order, items: [] });
      orderMap.get(key)!.items.push(item);
    }

    res.json({ orders: Array.from(orderMap.values()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando órdenes de cocina" });
  }
});

// PATCH /api/kitchen/items/:id/status — Atomic: update item + check order readiness in one transaction
kitRouter.patch("/items/:id/status", kitAuthz("COOK_1", "COOK_2", "ADMIN"), async (req: KitReq, res: KitRes) => {
  try {
    const { status } = req.body;

    const result = await kitPrisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "PREPARING") updateData.prepStartedAt = new Date();
      if (status === "READY") updateData.readyAt = new Date();

      const item = await tx.orderItem.update({
        where: { id: req.params.id as string },
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
      } else if (status === "PREPARING") {
        await tx.order.update({
          where: { id: item.orderId },
          data: { status: "PREPARING" },
        });
      }

      return { item, allReady: pendingItems === 0 };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando ítem" });
  }
});

export { kitRouter as default };



