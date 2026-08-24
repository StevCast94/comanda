"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const zod_1 = require("zod");
const ordRouter = (0, express_1.Router)();
exports.default = ordRouter;
ordRouter.use(auth_1.authenticate, tenant_1.tenantIsolation, subscription_1.checkSubscription);
const createOrderSchema = zod_1.z.object({
    tableId: zod_1.z.string().optional(),
    customerName: zod_1.z.string().optional(),
    orderType: zod_1.z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
    status: zod_1.z.enum(["PENDING", "PAID"]).optional(),
    paymentMethod: zod_1.z.enum(["CASH", "CARD", "TRANSFER"]).optional(),
    waiterId: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    customerAddress: zod_1.z.string().optional(),
    customerPhone: zod_1.z.string().optional(),
    deliveryZoneId: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        menuItemId: zod_1.z.string().optional(),
        comboId: zod_1.z.string().optional(),
        quantity: zod_1.z.number().int().positive(),
        unitPrice: zod_1.z.number().nonnegative(),
        notes: zod_1.z.string().optional(),
        kitchen: zod_1.z.enum(["KITCHEN_1", "NONE"]),
        modifiers: zod_1.z.array(zod_1.z.object({
            modifierId: zod_1.z.string(),
            name: zod_1.z.string(),
            priceAdjustment: zod_1.z.number(),
        })).default([]),
        comboSelections: zod_1.z.record(zod_1.z.string()).optional(),
    })).min(1, "La orden debe tener al menos un ítem"),
});
// POST /api/orders — Create order (CASHIER, ADMIN, WAITER)
ordRouter.post("/", (0, auth_1.authorize)("CASHIER", "ADMIN", "WAITER"), async (req, res) => {
    try {
        const data = createOrderSchema.parse(req.body);
        const rId = req.restaurantId;
        const isPending = data.status === "PENDING";
        // Validate DINE_IN requires table
        if (data.orderType === "DINE_IN" && !data.tableId) {
            res.status(400).json({ error: "Mesa requerida para pedidos en salón" });
            return;
        }
        // Validate DELIVERY requires address + phone
        if (data.orderType === "DELIVERY" && (!data.customerAddress || !data.customerPhone)) {
            res.status(400).json({ error: "Dirección y teléfono requeridos para pedidos a domicilio" });
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
            openRegister = await index_1.prisma.cashRegister.findFirst({
                where: { restaurantId: rId, status: "OPEN" },
            });
            if (!openRegister) {
                res.status(400).json({ error: "No hay caja abierta. Abre la caja antes de cobrar." });
                return;
            }
        }
        // Get restaurant settings for tax/service
        const restaurant = await index_1.prisma.restaurant.findUnique({ where: { id: rId } });
        const settings = restaurant?.settings || {};
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
        const lastOrder = await index_1.prisma.order.findFirst({
            where: { restaurantId: rId },
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
        });
        const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;
        const order = await index_1.prisma.$transaction(async (tx) => {
            const o = await tx.order.create({
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
                    paymentMethod: isPending ? null : data.paymentMethod,
                    cashierId: req.user.userId,
                    waiterId: data.waiterId || (req.user.role === "WAITER" ? req.user.userId : null),
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
            if (data.orderType === "DELIVERY") {
                let deliveryFee = 0;
                if (data.deliveryZoneId) {
                    const zone = await tx.deliveryZone.findFirst({
                        where: { id: data.deliveryZoneId, restaurantId: rId },
                    });
                    if (zone)
                        deliveryFee = zone.fee;
                }
                await tx.deliveryOrder.create({
                    data: {
                        orderId: o.id,
                        customerAddress: data.customerAddress,
                        customerPhone: data.customerPhone,
                        deliveryZoneId: data.deliveryZoneId || null,
                        deliveryFee,
                    },
                });
            }
            return o;
        });
        // Update cash register totals only for paid orders
        if (!isPending && openRegister) {
            const updateField = data.paymentMethod === "CASH" ? "totalCash"
                : data.paymentMethod === "CARD" ? "totalCard" : "totalTransfer";
            await index_1.prisma.cashRegister.update({
                where: { id: openRegister.id },
                data: {
                    totalSales: { increment: total },
                    [updateField]: { increment: total },
                },
            });
        }
        res.status(201).json({ order });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error("Create order error:", err);
        res.status(500).json({ error: "Error creando orden" });
    }
});
// GET /api/orders
ordRouter.get("/", async (req, res) => {
    try {
        const { status, date, limit = "50", offset = "0" } = req.query;
        const where = {};
        if (req.restaurantId)
            where.restaurantId = req.restaurantId;
        if (status) {
            const statusStr = status;
            where.status = statusStr.includes(",") ? { in: statusStr.split(",") } : statusStr;
        }
        if (date) {
            const d = new Date(date);
            where.createdAt = {
                gte: new Date(d.setHours(0, 0, 0, 0)),
                lt: new Date(d.setHours(23, 59, 59, 999)),
            };
        }
        const orders = await index_1.prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: parseInt(limit, 10),
            skip: parseInt(offset, 10),
            include: {
                items: { include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } } },
                table: { select: { number: true, floor: true } },
                cashier: { select: { name: true } },
                waiter: { select: { name: true } },
            },
        });
        const total = await index_1.prisma.order.count({ where });
        res.json({ orders, total });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando órdenes" });
    }
});
// GET /api/orders/live — tracking en tiempo real para caja (DEBE ir antes de /:id)
ordRouter.get("/live", (0, auth_1.authorize)("CASHIER", "ADMIN"), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const orders = await index_1.prisma.order.findMany({
            where: {
                restaurantId: req.restaurantId,
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// GET /api/orders/:id
ordRouter.get("/:id", async (req, res) => {
    try {
        const order = await index_1.prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                items: { include: { menuItem: true, combo: true } },
                table: true, cashier: { select: { name: true } },
                waiter: { select: { name: true } }, deliveryOrder: true,
            },
        });
        if (!order) {
            res.status(404).json({ error: "Orden no encontrada" });
            return;
        }
        if (req.restaurantId && order.restaurantId !== req.restaurantId) {
            res.status(403).json({ error: "Sin acceso" });
            return;
        }
        res.json({ order });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// PATCH /api/orders/:id/status
ordRouter.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const order = await index_1.prisma.order.update({
            where: { id: req.params.id },
            data: {
                status,
                ...(status === "DELIVERED" ? { deliveredAt: new Date(), waiterId: req.user.userId } : {}),
                ...(status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason: req.body.reason } : {}),
            },
        });
        res.json({ order });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error actualizando estado" });
    }
});
// PATCH /api/orders/:id/confirm-payment — CASHIER confirms payment for PENDING orders
ordRouter.patch("/:id/confirm-payment", (0, auth_1.authorize)("CASHIER", "ADMIN"), async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        if (!paymentMethod || !["CASH", "CARD", "TRANSFER"].includes(paymentMethod)) {
            res.status(400).json({ error: "Método de pago requerido (CASH, CARD, TRANSFER)" });
            return;
        }
        const order = await index_1.prisma.order.findUnique({
            where: { id: req.params.id },
        });
        if (!order) {
            res.status(404).json({ error: "Orden no encontrada" });
            return;
        }
        if (order.status !== "PENDING") {
            res.status(400).json({ error: "Solo se pueden confirmar órdenes pendientes" });
            return;
        }
        // Check cash register is open
        const openRegister = await index_1.prisma.cashRegister.findFirst({
            where: { restaurantId: req.restaurantId, status: "OPEN" },
        });
        if (!openRegister) {
            res.status(400).json({ error: "No hay caja abierta. Abre la caja antes de cobrar." });
            return;
        }
        // Update order to PAID first
        const updated = await index_1.prisma.order.update({
            where: { id: req.params.id },
            data: {
                status: "PAID",
                paymentMethod,
                cashierId: req.user.userId,
                paidAt: new Date(),
            },
            include: {
                items: true,
                table: true,
                waiter: { select: { name: true } },
            },
        });
        // If ALL items have kitchen NONE or BAR (bebidas, postres), auto-advance to READY
        const allItemsNoKitchen = updated.items.length > 0 && updated.items.every((item) => item.kitchen === "NONE" || item.kitchen === "BAR");
        if (allItemsNoKitchen) {
            await index_1.prisma.orderItem.updateMany({
                where: { orderId: updated.id },
                data: { status: "READY", readyAt: new Date() },
            });
            await index_1.prisma.order.update({
                where: { id: updated.id },
                data: { status: "READY" },
            });
            updated.status = "READY";
        }
        // Update cash register totals
        const updateField = paymentMethod === "CASH" ? "totalCash"
            : paymentMethod === "CARD" ? "totalCard" : "totalTransfer";
        await index_1.prisma.cashRegister.update({
            where: { id: openRegister.id },
            data: {
                totalSales: { increment: updated.total },
                [updateField]: { increment: updated.total },
            },
        });
        res.json({ order: updated });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error confirmando pago" });
    }
});
// PATCH /api/orders/:id/items — update items (CASHIER, WAITER, ADMIN edits pending order)
ordRouter.patch("/:id/items", (0, auth_1.authorize)("CASHIER", "ADMIN", "WAITER"), async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: "Se requiere al menos un ítem" });
            return;
        }
        const order = await index_1.prisma.order.findUnique({
            where: { id: req.params.id },
            include: { items: true },
        });
        if (!order) {
            res.status(404).json({ error: "Orden no encontrada" });
            return;
        }
        if (order.status !== "PENDING") {
            res.status(400).json({ error: "Solo se pueden editar órdenes pendientes" });
            return;
        }
        // Delete existing items
        await index_1.prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        // Create new items
        let subtotal = 0;
        const newItems = items.map((item) => {
            const modTotal = (item.modifiers || []).reduce((s, m) => s + m.priceAdjustment, 0);
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
        const restaurant = await index_1.prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
        const settings = restaurant?.settings || {};
        const taxRate = settings.taxRate ?? 0.15;
        const serviceRate = settings.serviceRate ?? 0.10;
        const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
        const serviceAmount = Math.round(subtotal * serviceRate * 100) / 100;
        const total = Math.round((subtotal + taxAmount + serviceAmount) * 100) / 100;
        const updated = await index_1.prisma.order.update({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error actualizando items" });
    }
});
// DELETE /api/orders/:id — ADMIN only, hard delete
ordRouter.delete("/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const order = await index_1.prisma.order.findUnique({
            where: { id: req.params.id },
            select: { id: true, restaurantId: true },
        });
        if (!order) {
            res.status(404).json({ error: "Orden no encontrada" });
            return;
        }
        if (order.restaurantId !== req.restaurantId) {
            res.status(403).json({ error: "Sin acceso" });
            return;
        }
        await index_1.prisma.order.delete({
            where: { id: req.params.id },
        });
        res.json({ message: "Orden eliminada" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando orden" });
    }
});
//# sourceMappingURL=orders.js.map