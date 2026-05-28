// ============================================================
// FILE: backend/src/routes/plans.ts
// Public endpoint — no auth needed
// ============================================================
import { Router, Request, Response } from "express";

const router = Router();

const PLANS = [
  { id: "FREE", name: "Gratis", price: 0, billing: "forever", maxUsers: 3, maxProducts: 50, maxCombos: 5, features: { delivery: false, advancedReports: false, whatsapp: false } },
  { id: "TRIAL", name: "Prueba", price: 0, billing: "14 días", maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
  { id: "BASIC", name: "Básico", price: 29, billing: "mensual", maxUsers: 7, maxProducts: 200, maxCombos: 20, features: { delivery: true, advancedReports: false, whatsapp: false } },
  { id: "PRO", name: "Profesional", price: 59, billing: "mensual", maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
  { id: "ENTERPRISE", name: "Empresarial", price: 99, billing: "mensual", maxUsers: 9999, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: true } },
];

router.get("/", (_req: Request, res: Response) => {
  res.json({ plans: PLANS });
});

export default router;


// ============================================================
// FILE: backend/src/routes/users.ts
// ============================================================
import { Router as UsersRouter } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";
import { checkSubscription } from "../middleware/subscription";

const usersRouter = UsersRouter();
usersRouter.use(authenticate, tenantIsolation, checkSubscription);
usersRouter.use(authorize("ADMIN"));

// TODO: Implement in Phase 2
// GET    /api/users
// POST   /api/users
// PUT    /api/users/:id
// DELETE /api/users/:id
// PATCH  /api/users/:id/toggle-active

export { usersRouter as default };


// ============================================================
// FILE: backend/src/routes/categories.ts
// ============================================================
import { Router as CatRouter, Request as CatReq, Response as CatRes } from "express";
import { prisma as catPrisma } from "../index";
import { authenticate as catAuth } from "../middleware/auth";
import { tenantIsolation as catTenant } from "../middleware/tenant";

const catRouter = CatRouter();

// GET /api/categories — all roles can read (POS needs this)
catRouter.get("/", catAuth, catTenant, async (req: CatReq, res: CatRes) => {
  try {
    const where = req.restaurantId ? { restaurantId: req.restaurantId, active: true } : { active: true };
    const categories = await catPrisma.category.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { menuItems: true, combos: true } } },
    });
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando categorías" });
  }
});

export { catRouter as default };


// ============================================================
// FILE: backend/src/routes/products.ts
// ============================================================
import { Router as ProdRouter, Request as ProdReq, Response as ProdRes } from "express";
import { prisma as prodPrisma } from "../index";
import { authenticate as prodAuth } from "../middleware/auth";
import { tenantIsolation as prodTenant } from "../middleware/tenant";

const prodRouter = ProdRouter();

// GET /api/products — POS and all roles can read
prodRouter.get("/", prodAuth, prodTenant, async (req: ProdReq, res: ProdRes) => {
  try {
    const { category, active, kitchen } = req.query;
    const where: Record<string, unknown> = {};
    if (req.restaurantId) where.restaurantId = req.restaurantId;
    if (category) where.categoryId = category as string;
    if (active !== undefined) where.active = active === "true";
    else where.active = true;
    if (kitchen) where.kitchen = kitchen as string;

    const products = await prodPrisma.menuItem.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        modifiers: { where: { active: true } },
        category: { select: { id: true, name: true, type: true } },
      },
    });
    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando productos" });
  }
});

export { prodRouter as default };


// ============================================================
// FILE: backend/src/routes/combos.ts
// ============================================================
import { Router as ComboRouter, Request as ComboReq, Response as ComboRes } from "express";
import { prisma as comboPrisma } from "../index";
import { authenticate as comboAuth } from "../middleware/auth";
import { tenantIsolation as comboTenant } from "../middleware/tenant";

const comboRouter = ComboRouter();

comboRouter.get("/", comboAuth, comboTenant, async (req: ComboReq, res: ComboRes) => {
  try {
    const { category } = req.query;
    const where: Record<string, unknown> = { active: true };
    if (req.restaurantId) where.restaurantId = req.restaurantId;
    if (category) where.categoryId = category as string;

    const combos = await comboPrisma.combo.findMany({
      where,
      include: {
        comboItems: {
          include: { menuItem: { select: { id: true, name: true, basePrice: true, kitchen: true, type: true } } },
        },
        category: { select: { id: true, name: true } },
      },
    });
    res.json({ combos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando combos" });
  }
});

export { comboRouter as default };


// ============================================================
// FILE: backend/src/routes/orders.ts
// ============================================================
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
  paymentMethod: ordZ.enum(["CASH", "CARD", "TRANSFER"]),
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

// POST /api/orders — Create order (CASHIER, ADMIN)
ordRouter.post("/", ordAuthz("CASHIER", "ADMIN"), async (req: OrdReq, res: OrdRes) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const rId = req.restaurantId!;

    // Validate DINE_IN requires table
    if (data.orderType === "DINE_IN" && !data.tableId) {
      res.status(400).json({ error: "Mesa requerida para pedidos en salón" });
      return;
    }

    // Check cash register is open
    const openRegister = await ordPrisma.cashRegister.findFirst({
      where: { restaurantId: rId, status: "OPEN" },
    });
    if (!openRegister) {
      res.status(400).json({ error: "No hay caja abierta. Abre la caja antes de cobrar." });
      return;
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
        status: "PAID",
        subtotal,
        taxRate,
        taxAmount,
        serviceRate,
        serviceAmount,
        total,
        paymentMethod: data.paymentMethod,
        cashierId: req.user!.userId,
        paidAt: new Date(),
        notes: data.notes,
        items: { create: orderItems },
      },
      include: {
        items: { include: { menuItem: true, combo: true } },
        table: true,
      },
    });

    // Update cash register totals
    const updateField = data.paymentMethod === "CASH" ? "totalCash"
      : data.paymentMethod === "CARD" ? "totalCard" : "totalTransfer";
    await ordPrisma.cashRegister.update({
      where: { id: openRegister.id },
      data: {
        totalSales: { increment: total },
        [updateField]: { increment: total },
      },
    });

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
    if (status) where.status = status;
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

// GET /api/orders/:id
ordRouter.get("/:id", async (req: OrdReq, res: OrdRes) => {
  try {
    const order = await ordPrisma.order.findUnique({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
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

export { ordRouter as default };


// ============================================================
// FILE: backend/src/routes/kitchen.ts
// ============================================================
import { Router as KitRouter, Request as KitReq, Response as KitRes } from "express";
import { prisma as kitPrisma } from "../index";
import { authenticate as kitAuth, authorize as kitAuthz } from "../middleware/auth";
import { tenantIsolation as kitTenant } from "../middleware/tenant";

const kitRouter = KitRouter();
kitRouter.use(kitAuth, kitTenant);

// GET /api/kitchen/orders?kitchen=KITCHEN_1&status=PENDING,PREPARING
kitRouter.get("/orders", kitAuthz("COOK_1", "COOK_2", "ADMIN"), async (req: KitReq, res: KitRes) => {
  try {
    const { kitchen, status } = req.query;
    const statuses = status ? (status as string).split(",") : ["PENDING", "PREPARING"];
    const kitchenFilter = kitchen as string || (req.user!.role === "COOK_1" ? "KITCHEN_1" : "KITCHEN_2");

    // Get order items for this kitchen station
    const items = await kitPrisma.orderItem.findMany({
      where: {
        kitchen: { in: kitchenFilter === "KITCHEN_1" ? ["KITCHEN_1", "BOTH"] : ["KITCHEN_2", "BOTH"] },
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

// PATCH /api/kitchen/items/:id/status
kitRouter.patch("/items/:id/status", kitAuthz("COOK_1", "COOK_2", "ADMIN"), async (req: KitReq, res: KitRes) => {
  try {
    const { status } = req.body;
    const updateData: Record<string, unknown> = { status };
    if (status === "PREPARING") updateData.prepStartedAt = new Date();
    if (status === "READY") updateData.readyAt = new Date();

    const item = await kitPrisma.orderItem.update({
      where: { id: req.params.id },
      data: updateData,
      include: { order: { select: { id: true, restaurantId: true } } },
    });

    // Check if ALL items in this order are READY
    const pendingItems = await kitPrisma.orderItem.count({
      where: { orderId: item.orderId, status: { not: "READY" }, kitchen: { not: "NONE" } },
    });

    if (pendingItems === 0) {
      await kitPrisma.order.update({
        where: { id: item.orderId },
        data: { status: "READY" },
      });
    } else if (status === "PREPARING") {
      await kitPrisma.order.update({
        where: { id: item.orderId },
        data: { status: "PREPARING" },
      });
    }

    res.json({ item, allReady: pendingItems === 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando ítem" });
  }
});

export { kitRouter as default };


// ============================================================
// FILE: backend/src/routes/waiter.ts
// ============================================================
import { Router as WaitRouter, Request as WaitReq, Response as WaitRes } from "express";
import { prisma as waitPrisma } from "../index";
import { authenticate as waitAuth, authorize as waitAuthz } from "../middleware/auth";
import { tenantIsolation as waitTenant } from "../middleware/tenant";

const waitRouter = WaitRouter();
waitRouter.use(waitAuth, waitTenant);

// GET /api/waiter/pending — Orders ready for delivery
waitRouter.get("/pending", waitAuthz("WAITER", "ADMIN"), async (req: WaitReq, res: WaitRes) => {
  try {
    const orders = await waitPrisma.order.findMany({
      where: {
        restaurantId: req.restaurantId!,
        status: "READY",
        orderType: "DINE_IN",
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
      where: { id: req.params.id },
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


// ============================================================
// FILE: backend/src/routes/cashRegister.ts
// ============================================================
import { Router as CRRouter, Request as CRReq, Response as CRRes } from "express";
import { prisma as crPrisma } from "../index";
import { authenticate as crAuth, authorize as crAuthz } from "../middleware/auth";
import { tenantIsolation as crTenant } from "../middleware/tenant";
import { checkSubscription as crSub } from "../middleware/subscription";

const crRouter = CRRouter();
crRouter.use(crAuth, crTenant, crSub);

// POST /api/cash-register/open
crRouter.post("/open", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const existing = await crPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
    });
    if (existing) {
      res.status(400).json({ error: "Ya hay una caja abierta" });
      return;
    }
    const register = await crPrisma.cashRegister.create({
      data: {
        restaurantId: req.restaurantId!,
        cashierId: req.user!.userId,
        openingBalance: req.body.openingBalance || 0,
      },
    });
    res.status(201).json({ register });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error abriendo caja" });
  }
});

// POST /api/cash-register/close
crRouter.post("/close", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const register = await crPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
    });
    if (!register) {
      res.status(400).json({ error: "No hay caja abierta" });
      return;
    }
    const expectedBalance = register.openingBalance + register.totalSales - register.totalExpenses;
    const closed = await crPrisma.cashRegister.update({
      where: { id: register.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closingBalance: req.body.closingBalance || 0,
        expectedBalance,
        notes: req.body.notes,
      },
    });
    res.json({ register: closed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cerrando caja" });
  }
});

// GET /api/cash-register/current
crRouter.get("/current", crAuthz("CASHIER", "ADMIN"), async (req: CRReq, res: CRRes) => {
  try {
    const register = await crPrisma.cashRegister.findFirst({
      where: { restaurantId: req.restaurantId!, status: "OPEN" },
      include: { cashier: { select: { name: true } } },
    });
    res.json({ register });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

export { crRouter as default };


// ============================================================
// FILE: backend/src/routes/reports.ts (stub)
// ============================================================
import { Router as RepRouter, Request as RepReq, Response as RepRes } from "express";
import { prisma as repPrisma } from "../index";
import { authenticate as repAuth, authorize as repAuthz } from "../middleware/auth";
import { tenantIsolation as repTenant } from "../middleware/tenant";

const repRouter = RepRouter();
repRouter.use(repAuth, repTenant);

// GET /api/reports/summary?date=YYYY-MM-DD
repRouter.get("/summary", repAuthz("ADMIN"), async (req: RepReq, res: RepRes) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const start = new Date(dateStr + "T00:00:00");
    const end = new Date(dateStr + "T23:59:59.999");

    const where = { restaurantId: req.restaurantId!, createdAt: { gte: start, lte: end } };

    const orders = await repPrisma.order.findMany({ where, select: { total: true, status: true, paymentMethod: true } });

    const delivered = orders.filter(o => o.status !== "CANCELLED");
    const totalSales = delivered.reduce((s, o) => s + o.total, 0);
    const totalOrders = delivered.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const byCash = delivered.filter(o => o.paymentMethod === "CASH").reduce((s, o) => s + o.total, 0);
    const byCard = delivered.filter(o => o.paymentMethod === "CARD").reduce((s, o) => s + o.total, 0);
    const byTransfer = delivered.filter(o => o.paymentMethod === "TRANSFER").reduce((s, o) => s + o.total, 0);

    res.json({
      date: dateStr,
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      avgTicket: Math.round(avgTicket * 100) / 100,
      cancelled: orders.filter(o => o.status === "CANCELLED").length,
      byPaymentMethod: { cash: byCash, card: byCard, transfer: byTransfer },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error generando reporte" });
  }
});

export { repRouter as default };


// ============================================================
// FILE: backend/src/routes/inventory.ts (stub)
// ============================================================
import { Router as InvRouter } from "express";
import { authenticate as invAuth, authorize as invAuthz } from "../middleware/auth";
import { tenantIsolation as invTenant } from "../middleware/tenant";
import { checkSubscription as invSub } from "../middleware/subscription";

const invRouter = InvRouter();
invRouter.use(invAuth, invTenant, invSub, invAuthz("ADMIN"));
// TODO: Phase 2
export { invRouter as default };


// ============================================================
// FILE: backend/src/routes/customers.ts (stub)
// ============================================================
import { Router as CustRouter } from "express";
import { authenticate as custAuth, authorize as custAuthz } from "../middleware/auth";
import { tenantIsolation as custTenant } from "../middleware/tenant";

const custRouter = CustRouter();
custRouter.use(custAuth, custTenant, custAuthz("ADMIN"));
// TODO: Phase 2
export { custRouter as default };


// ============================================================
// FILE: backend/src/routes/delivery.ts (stub)
// ============================================================
import { Router as DelRouter } from "express";
import { authenticate as delAuth } from "../middleware/auth";
import { tenantIsolation as delTenant } from "../middleware/tenant";

const delRouter = DelRouter();
delRouter.use(delAuth, delTenant);
// TODO: Phase 3
export { delRouter as default };


// ============================================================
// FILE: backend/src/routes/settings.ts (stub)
// ============================================================
import { Router as SetRouter, Request as SetReq, Response as SetRes } from "express";
import { prisma as setPrisma } from "../index";
import { authenticate as setAuth, authorize as setAuthz } from "../middleware/auth";
import { tenantIsolation as setTenant } from "../middleware/tenant";

const setRouter = SetRouter();
setRouter.use(setAuth, setTenant);

setRouter.get("/settings", setAuthz("ADMIN"), async (req: SetReq, res: SetRes) => {
  try {
    const restaurant = await setPrisma.restaurant.findUnique({ where: { id: req.restaurantId! } });
    if (!restaurant) { res.status(404).json({ error: "Restaurante no encontrado" }); return; }
    res.json({ restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

setRouter.get("/tables", async (req: SetReq, res: SetRes) => {
  try {
    const tables = await setPrisma.table.findMany({
      where: { restaurantId: req.restaurantId!, active: true },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    });
    res.json({ tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

export { setRouter as default };


// ============================================================
// FILE: backend/src/routes/superadmin.ts
// ============================================================
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
