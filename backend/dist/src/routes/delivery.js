"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const zod_1 = require("zod");
const delRouter = (0, express_1.Router)();
exports.default = delRouter;
delRouter.use(auth_1.authenticate, tenant_1.tenantIsolation);
const deliveryInclude = {
    order: {
        include: {
            items: { include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } } },
        },
    },
    driver: { select: { id: true, name: true } },
    deliveryZone: { select: { id: true, name: true, fee: true } },
};
// ─── Zones ────────────────────────────────────────────────
const zoneSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(60),
    fee: zod_1.z.number().nonnegative(),
    estimatedMin: zod_1.z.number().int().positive().optional(),
});
// GET /api/delivery/zones
delRouter.get("/zones", async (req, res) => {
    try {
        const zones = await index_1.prisma.deliveryZone.findMany({
            where: { restaurantId: req.restaurantId, active: true },
            orderBy: { name: "asc" },
        });
        res.json({ zones });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando zonas" });
    }
});
// POST /api/delivery/zones — ADMIN
delRouter.post("/zones", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = zoneSchema.parse(req.body);
        const zone = await index_1.prisma.deliveryZone.create({
            data: { ...data, restaurantId: req.restaurantId },
        });
        res.status(201).json({ zone });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando zona" });
    }
});
// PATCH /api/delivery/zones/:id — ADMIN
delRouter.patch("/zones/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const zone = await index_1.prisma.deliveryZone.findUnique({ where: { id: req.params.id } });
        if (!zone || zone.restaurantId !== req.restaurantId) {
            res.status(404).json({ error: "Zona no encontrada" });
            return;
        }
        const data = zoneSchema.partial().parse(req.body);
        const updated = await index_1.prisma.deliveryZone.update({ where: { id: zone.id }, data });
        res.json({ zone: updated });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error actualizando zona" });
    }
});
// ─── Drivers ──────────────────────────────────────────────
// GET /api/delivery/drivers — ADMIN: motoristas disponibles para asignar
delRouter.get("/drivers", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const drivers = await index_1.prisma.user.findMany({
            where: { restaurantId: req.restaurantId, role: "DELIVERY", active: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
        res.json({ drivers });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando motoristas" });
    }
});
// ─── Deliveries ───────────────────────────────────────────
// GET /api/delivery/pending — DELIVERY ve solo las suyas, ADMIN ve todas las no entregadas
delRouter.get("/pending", (0, auth_1.authorize)("DELIVERY", "ADMIN"), async (req, res) => {
    try {
        const where = {
            status: { not: "DELIVERED" },
            order: { restaurantId: req.restaurantId },
        };
        if (req.user.role === "DELIVERY")
            where.driverId = req.user.userId;
        const deliveries = await index_1.prisma.deliveryOrder.findMany({
            where,
            include: deliveryInclude,
            orderBy: { createdAt: "asc" },
        });
        res.json({ deliveries });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando entregas" });
    }
});
// PATCH /api/delivery/:id/assign — ADMIN asigna motorista
delRouter.patch("/:id/assign", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const { driverId } = zod_1.z.object({ driverId: zod_1.z.string() }).parse(req.body);
        const delivery = await index_1.prisma.deliveryOrder.findUnique({
            where: { id: req.params.id },
            include: { order: { select: { restaurantId: true } } },
        });
        if (!delivery || delivery.order.restaurantId !== req.restaurantId) {
            res.status(404).json({ error: "Entrega no encontrada" });
            return;
        }
        const driver = await index_1.prisma.user.findFirst({
            where: { id: driverId, restaurantId: req.restaurantId, role: "DELIVERY", active: true },
        });
        if (!driver) {
            res.status(400).json({ error: "Motorista inválido" });
            return;
        }
        const updated = await index_1.prisma.deliveryOrder.update({
            where: { id: delivery.id },
            data: { driverId },
            include: deliveryInclude,
        });
        res.json({ delivery: updated });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos" });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error asignando motorista" });
    }
});
const STATUS_FLOW = {
    ASSIGNED: "PICKED_UP",
    PICKED_UP: "IN_TRANSIT",
    IN_TRANSIT: "DELIVERED",
};
// PATCH /api/delivery/:id/advance — el motorista (dueño) o ADMIN avanza al siguiente estado
delRouter.patch("/:id/advance", (0, auth_1.authorize)("DELIVERY", "ADMIN"), async (req, res) => {
    try {
        const delivery = await index_1.prisma.deliveryOrder.findUnique({
            where: { id: req.params.id },
            include: { order: { select: { restaurantId: true, id: true } } },
        });
        if (!delivery || delivery.order.restaurantId !== req.restaurantId) {
            res.status(404).json({ error: "Entrega no encontrada" });
            return;
        }
        if (req.user.role === "DELIVERY" && delivery.driverId !== req.user.userId) {
            res.status(403).json({ error: "Esta entrega no está asignada a ti" });
            return;
        }
        const next = STATUS_FLOW[delivery.status];
        if (!next) {
            res.status(400).json({ error: "La entrega ya está finalizada" });
            return;
        }
        const updated = await index_1.prisma.$transaction(async (tx) => {
            const d = await tx.deliveryOrder.update({
                where: { id: delivery.id },
                data: {
                    status: next,
                    ...(next === "DELIVERED" ? { actualDeliveryTime: new Date() } : {}),
                },
                include: deliveryInclude,
            });
            if (next === "DELIVERED") {
                await tx.order.update({
                    where: { id: delivery.order.id },
                    data: { status: "DELIVERED", deliveredAt: new Date() },
                });
            }
            return d;
        });
        res.json({ delivery: updated });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error actualizando entrega" });
    }
});
//# sourceMappingURL=delivery.js.map