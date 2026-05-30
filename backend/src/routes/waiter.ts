import { Router as WaitRouter, Request as WaitReq, Response as WaitRes } from "express";
import { prisma as waitPrisma } from "../index";
import { authenticate as waitAuth, authorize as waitAuthz } from "../middleware/auth";
import { tenantIsolation as waitTenant } from "../middleware/tenant";

const waitRouter = WaitRouter();
waitRouter.use(waitAuth, waitTenant);

// GET /api/waiter/pending?orderType=DINE_IN,TAKEAWAY — Orders ready for delivery
waitRouter.get("/pending", waitAuthz("WAITER", "ADMIN"), async (req: WaitReq, res: WaitRes) => {
  try {
    const orderTypeParam = req.query.orderType as string;
    const orderTypes = orderTypeParam ? orderTypeParam.split(",") : ["DINE_IN", "TAKEAWAY"];

    const orders = await waitPrisma.order.findMany({
      where: {
        restaurantId: req.restaurantId!,
        status: "READY",
        orderType: { in: orderTypes as any },
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// PATCH /api/waiter/deliver/:id
waitRouter.patch("/deliver/:id", waitAuthz("WAITER", "ADMIN"), async (req: WaitReq, res: WaitRes) => {
  try {
    const order = await waitPrisma.order.update({
      where: { id: req.params.id as string },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        waiterId: req.user!.userId,
        items: { updateMany: { where: { status: "READY" }, data: { status: "DELIVERED" } } },
      },
    });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error entregando orden" });
  }
});

export { waitRouter as default };



