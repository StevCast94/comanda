import { Router as OrdRouter, Request as OrdReq, Response as OrdRes } from "express";
import { prisma as ordPrisma } from "../index";
import { authenticate as ordAuth, authorize as ordAuthz } from "../middleware/auth";
import { tenantIsolation as ordTenant } from "../middleware/tenant";
import { checkSubscription as ordSub } from "../middleware/subscription";
import { z as ordZ } from "zod";

const ordRouter = OrdRouter();
ordRouter.use(ordAuth, ordTenant, ordSub);

const createOrderSchema = ordZ.object({
  tableId: ordZ.string().optional(),
  customerName: ordZ.string().optional(),
  orderType: ordZ.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  status: ordZ.enum(["PENDING", "PAID"]).optional(),
  paymentMethod: ordZ.enum(["CASH", "CARD", "TRANSFER"]).optional(),
  waiterId: ordZ.string().optional(),
  notes: ordZ.string().optional(),
  items: ordZ.array(ordZ.object({
    menuItemId: ordZ.string().optional(),
    comboId: ordZ.string().optional(),
    quantity: ordZ.number().int().positive(),
    unitPrice: ordZ.number().nonnegative(),
    notes: ordZ.string().optional(),
    kitchen: ordZ.enum(["KITCHEN_1", "KITCHEN_2", "BAR", "BOTH", "NONE"]),
    modifiers: ordZ.array(ordZ.object({
      modifierId: ordZ.string(),
      name: ordZ.string(),
      priceAdjustment: ordZ.number(),
    })).default([]),
    comboSelections: ordZ.record(ordZ.string()).optional(),
  })).min(1, "La orden debe tener al menos un ítem"),
});

// POST /api/orders — Create order (CASHIER, ADMIN, WAITER)
ordRouter.post("/", ordAuthz("CASHIER", "ADMIN", "WAITER"), async (req: OrdReq, res: OrdRes) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const rId = req.restaurantId!;
    const isPending = data.status === "PENDING";

    // Validate DINE_IN requires table
    if (data.orderType === "DINE_IN" && !data.tableId) {
      res.status(400).json({ error: "Mesa requerida para pedidos en salón" });
      return;
    }

    // Payment required unless PENDING
    if (!isPending && !data.paymentMethod) {
      res.status(400).json({ error: "Método de pago requerido" });
      return;
    }

    // Check cash register only for paid orders
    let openRegister = null;
    if (!isPending) {
      openRegister = await ordPrisma.cashRegister.findFirst({
        where: { restaurantId: rId, status: "OPEN" },
      });
      if (!openRegister) {
        res.status(400).json({ error: "No hay caja abierta. Abre la caja antes de cobrar." });
        return;
      }
    }

    // Get restaurant settings for tax/service
    const restaurant = await ordPrisma.restaurant.findUnique({ where: { id: rId } });
    const settings = (restaurant?.settings as Record<string, number>) || {};
    const taxRate = settings.taxRate ?? 0.15;
    const serviceRate = settings.serviceRate ?? 0.10;

    // Calculate totals
    let subtotal = 0;
    const orderItems = data.items.map((item) => {
      const modTotal = item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0);
      const totalPrice = (item.unitPrice + modTotal) * item.quantity;
      subtotal += totalPrice;
      return {
        menuItemId: item.menuItemId || null,
        comboId: item.comboId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        notes: item.notes,
        kitchen: item.kitchen,
        modifiers: item.modifiers,
        comboSelections: item.comboSelections ? item.comboSelections : undefined,
      };
    });

    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const serviceAmount = Math.round(subtotal * serviceRate * 100) / 100;
    const total = Math.round((subtotal + taxAmount + serviceAmount) * 100) / 100;

    // Get next order number for this restaurant
    const lastOrder = await ordPrisma.order.findFirst({
      where: { restaurantId: rId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

    const order = await ordPrisma.order.create({
      data: {
        orderNumber,
        restaurantId: rId,
        tableId: data.tableId || null,
        customerName: data.customerName,
        orderType: data.orderType,
        status: isPending ? "PENDING" : "PAID",
        subtotal,
        taxRate,
        taxAmount,
        serviceRate,
        serviceAmount,
        total,
        paymentMethod: isPending ? null : data.paymentMethod!,
        cashierId: req.user!.userId,
        waiterId: data.waiterId || (req.user!.role === "WAITER" ? req.user!.userId : null),
        paidAt: isPending ? null : new Date(),
        notes: data.notes,
        items: { create: orderItems },
      },
      include: {
        items: { include: { menuItem: true, combo: true } },
        table: true,
        waiter: { select: { name: true } },
      },
    });

    // Update cash register totals only for paid orders
    if (!isPending && openRegister) {
      const updateField = data.paymentMethod === "CASH" ? "totalCash"
        : data.paymentMethod === "CARD" ? "totalCard" : "totalTransfer";
      await ordPrisma.cashRegister.update({
        where: { id: openRegister.id },
        data: {
          totalSales: { increment: total },
          [updateField]: { increment: total },
        },
      });
    }

    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof ordZ.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error("Create order error:", err);
    res.status(500).json({ error: "Error creando orden" });
  }
});

// GET /api/orders
ordRouter.get("/", async (req: OrdReq, res: OrdRes) => {
  try {
    const { status, date, limit = "50", offset = "0" } = req.query;
    const where: Record<string, unknown> = {};
    if (req.restaurantId) where.restaurantId = req.restaurantId;
    if (status) {
      const statusStr = status as string;
      where.status = statusStr.includes(",") ? { in: statusStr.split(",") } : statusStr;
    }
    if (date) {
      const d = new Date(date as string);
      where.createdAt = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lt: new Date(d.setHours(23, 59, 59, 999)),
      };
    }

    const orders = await ordPrisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      include: {
        items: { include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } } },
        table: { select: { number: true, floor: true } },
        cashier: { select: { name: true } },
        waiter: { select: { name: true } },
      },
    });

    const total = await ordPrisma.order.count({ where });
    res.json({ orders, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando órdenes" });
  }
});

// GET /api/orders/live — tracking en tiempo real para caja (DEBE ir antes de /:id)
ordRouter.get("/live", ordAuthz("CASHIER", "ADMIN"), async (req: OrdReq, res: OrdRes) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const orders = await ordPrisma.order.findMany({
      where: {
        restaurantId: req.restaurantId!,
        createdAt: { gte: today },
        status: { not: "CANCELLED" },
      },
      include: {
        items: { include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } } },
        table: { select: { number: true, floor: true } },
        cashier: { select: { name: true } },
        waiter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// GET /api/orders/:id
ordRouter.get("/:id", async (req: OrdReq, res: OrdRes) => {
  try {
    const order = await ordPrisma.order.findUnique({
      where: { id: req.params.id as string },
      include: {
        items: { include: { menuItem: true, combo: true } },
        table: true, cashier: { select: { name: true } },
        waiter: { select: { name: true } }, deliveryOrder: true,
      },
    });
    if (!order) { res.status(404).json({ error: "Orden no encontrada" }); return; }
    if (req.restaurantId && order.restaurantId !== req.restaurantId) {
      res.status(403).json({ error: "Sin acceso" }); return;
    }
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// PATCH /api/orders/:id/status
ordRouter.patch("/:id/status", async (req: OrdReq, res: OrdRes) => {
  try {
    const { status } = req.body;
    const order = await ordPrisma.order.update({
      where: { id: req.params.id as string },
      data: {
        status,
        ...(status === "DELIVERED" ? { deliveredAt: new Date(), waiterId: req.user!.userId } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason: req.body.reason } : {}),
      },
    });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando estado" });
  }
});

// PATCH /api/orders/:id/confirm-payment — CASHIER confirms payment for PENDING orders
ordRouter.patch("/:id/confirm-payment", ordAuthz("CASHIER", "ADMIN"), async (req: OrdReq, res: OrdRes) => {
  try {
    const { paymentMethod } = req.body;
    if (!paymentMethod || !["CASH", "CARD", "TRANSFER"].includes(paymentMethod)) {
      res.status(400).json({ error: "Método de pago requerido (CASH, CARD, TRANSFER)" });
      return;
    }

    const order = await ordPrisma.order.findUnique({
      where: { id: req.params.id as string },
    });
    if (!order) { res.status(404).json({ error: "Orden no encontrada" }); return; }
    if (order.status !== "PENDING") {
      res.status(400).json({ error: "Solo se pueden confirmar órdenes pendientes" });
      return;
    }

    // Check cash register is open
    const openRegister = await ordPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
    });
    if (!openRegister) {
      res.status(400).json({ error: "No hay caja abierta. Abre la caja antes de cobrar." });
      return;
    }

    // Update order to PAID first
    const updated = await ordPrisma.order.update({
      where: { id: req.params.id as string },
      data: {
        status: "PAID",
        paymentMethod,
        cashierId: req.user!.userId,
        paidAt: new Date(),
      },
      include: {
        items: true,
        table: true,
        waiter: { select: { name: true } },
      },
    });

    // If ALL items have kitchen NONE (bebidas, postres), auto-advance to READY
    const allItemsNone = updated.items.length > 0 && updated.items.every((item: any) => item.kitchen === "NONE");
    if (allItemsNone) {
      await ordPrisma.orderItem.updateMany({
        where: { orderId: updated.id },
        data: { status: "READY", readyAt: new Date() },
      });
      await ordPrisma.order.update({
        where: { id: updated.id },
        data: { status: "READY" },
      });
      updated.status = "READY";
    }

    // Update cash register totals
    const updateField = paymentMethod === "CASH" ? "totalCash"
      : paymentMethod === "CARD" ? "totalCard" : "totalTransfer";
    await ordPrisma.cashRegister.update({
      where: { id: openRegister.id },
      data: {
        totalSales: { increment: updated.total },
        [updateField]: { increment: updated.total },
      },
    });

    res.json({ order: allItemsNone ? finalOrder : updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error confirmando pago" });
  }
});

// PATCH /api/orders/:id/items — update items (CASHIER, WAITER, ADMIN edits pending order)
ordRouter.patch("/:id/items", ordAuthz("CASHIER", "ADMIN", "WAITER"), async (req: OrdReq, res: OrdRes) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Se requiere al menos un ítem" });
      return;
    }

    const order = await ordPrisma.order.findUnique({
      where: { id: req.params.id as string },
      include: { items: true },
    });
    if (!order) { res.status(404).json({ error: "Orden no encontrada" }); return; }
    if (order.status !== "PENDING") {
      res.status(400).json({ error: "Solo se pueden editar órdenes pendientes" });
      return;
    }

    // Delete existing items
    await ordPrisma.orderItem.deleteMany({ where: { orderId: order.id } });

    // Create new items
    let subtotal = 0;
    const newItems = items.map((item: any) => {
      const modTotal = (item.modifiers || []).reduce((s: number, m: any) => s + m.priceAdjustment, 0);
      const totalPrice = (item.unitPrice + modTotal) * item.quantity;
      subtotal += totalPrice;
      return {
        menuItemId: item.menuItemId || null,
        comboId: item.comboId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
        notes: item.notes,
        kitchen: item.kitchen || "KITCHEN_1",
        modifiers: item.modifiers || [],
        comboSelections: item.comboSelections || undefined,
      };
    });

    const restaurant = await ordPrisma.restaurant.findUnique({ where: { id: req.restaurantId! } });
    const settings = (restaurant?.settings as Record<string, number>) || {};
    const taxRate = settings.taxRate ?? 0.15;
    const serviceRate = settings.serviceRate ?? 0.10;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const serviceAmount = Math.round(subtotal * serviceRate * 100) / 100;
    const total = Math.round((subtotal + taxAmount + serviceAmount) * 100) / 100;

    const updated = await ordPrisma.order.update({
      where: { id: order.id },
      data: {
        subtotal,
        taxAmount,
        serviceAmount,
        total,
        items: { create: newItems },
      },
      include: {
        items: { include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } } },
        table: true,
        waiter: { select: { name: true } },
      },
    });

    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando items" });
  }
});

export { ordRouter as default };



