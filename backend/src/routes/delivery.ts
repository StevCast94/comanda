import { Router as DelRouter, Request as DelReq, Response as DelRes } from "express";
import { prisma as delPrisma } from "../index";
import { authenticate as delAuth, authorize as delAuthz } from "../middleware/auth";
import { tenantIsolation as delTenant } from "../middleware/tenant";
import { z as delZ } from "zod";

const delRouter = DelRouter();
delRouter.use(delAuth, delTenant);

const deliveryInclude = {
  order: {
    include: {
      items: { include: { menuItem: { select: { name: true } }, combo: { select: { name: true } } } },
    },
  },
  driver: { select: { id: true, name: true } },
  deliveryZone: { select: { id: true, name: true, fee: true } },
} as const;

// ─── Zones ────────────────────────────────────────────────

const zoneSchema = delZ.object({
  name: delZ.string().min(1).max(60),
  fee: delZ.number().nonnegative(),
  estimatedMin: delZ.number().int().positive().optional(),
});

// GET /api/delivery/zones
delRouter.get("/zones", async (req: DelReq, res: DelRes) => {
  try {
    const zones = await delPrisma.deliveryZone.findMany({
      where: { restaurantId: req.restaurantId!, active: true },
      orderBy: { name: "asc" },
    });
    res.json({ zones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando zonas" });
  }
});

// POST /api/delivery/zones — ADMIN
delRouter.post("/zones", delAuthz("ADMIN"), async (req: DelReq, res: DelRes) => {
  try {
    const data = zoneSchema.parse(req.body);
    const zone = await delPrisma.deliveryZone.create({
      data: { ...data, restaurantId: req.restaurantId! },
    });
    res.status(201).json({ zone });
  } catch (err) {
    if (err instanceof delZ.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Error creando zona" });
  }
});

// PATCH /api/delivery/zones/:id — ADMIN
delRouter.patch("/zones/:id", delAuthz("ADMIN"), async (req: DelReq, res: DelRes) => {
  try {
    const zone = await delPrisma.deliveryZone.findUnique({ where: { id: req.params.id as string } });
    if (!zone || zone.restaurantId !== req.restaurantId) {
      res.status(404).json({ error: "Zona no encontrada" });
      return;
    }
    const data = zoneSchema.partial().parse(req.body);
    const updated = await delPrisma.deliveryZone.update({ where: { id: zone.id }, data });
    res.json({ zone: updated });
  } catch (err) {
    if (err instanceof delZ.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Error actualizando zona" });
  }
});

// ─── Drivers ──────────────────────────────────────────────

// GET /api/delivery/drivers — ADMIN: motoristas disponibles para asignar
delRouter.get("/drivers", delAuthz("ADMIN"), async (req: DelReq, res: DelRes) => {
  try {
    const drivers = await delPrisma.user.findMany({
      where: { restaurantId: req.restaurantId!, role: "DELIVERY", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json({ drivers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando motoristas" });
  }
});

// ─── Deliveries ───────────────────────────────────────────

// GET /api/delivery/pending — DELIVERY ve solo las suyas, ADMIN ve todas las no entregadas
delRouter.get("/pending", delAuthz("DELIVERY", "ADMIN"), async (req: DelReq, res: DelRes) => {
  try {
    const where: Record<string, unknown> = {
      status: { not: "DELIVERED" },
      order: { restaurantId: req.restaurantId! },
    };
    if (req.user!.role === "DELIVERY") where.driverId = req.user!.userId;

    const deliveries = await delPrisma.deliveryOrder.findMany({
      where,
      include: deliveryInclude,
      orderBy: { createdAt: "asc" },
    });
    res.json({ deliveries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando entregas" });
  }
});

// PATCH /api/delivery/:id/assign — ADMIN asigna motorista
delRouter.patch("/:id/assign", delAuthz("ADMIN"), async (req: DelReq, res: DelRes) => {
  try {
    const { driverId } = delZ.object({ driverId: delZ.string() }).parse(req.body);

    const delivery = await delPrisma.deliveryOrder.findUnique({
      where: { id: req.params.id as string },
      include: { order: { select: { restaurantId: true } } },
    });
    if (!delivery || delivery.order.restaurantId !== req.restaurantId) {
      res.status(404).json({ error: "Entrega no encontrada" });
      return;
    }

    const driver = await delPrisma.user.findFirst({
      where: { id: driverId, restaurantId: req.restaurantId!, role: "DELIVERY", active: true },
    });
    if (!driver) {
      res.status(400).json({ error: "Motorista inválido" });
      return;
    }

    const updated = await delPrisma.deliveryOrder.update({
      where: { id: delivery.id },
      data: { driverId },
      include: deliveryInclude,
    });
    res.json({ delivery: updated });
  } catch (err) {
    if (err instanceof delZ.ZodError) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Error asignando motorista" });
  }
});

const STATUS_FLOW: Record<string, "PICKED_UP" | "IN_TRANSIT" | "DELIVERED"> = {
  ASSIGNED: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

// PATCH /api/delivery/:id/advance — el motorista (dueño) o ADMIN avanza al siguiente estado
delRouter.patch("/:id/advance", delAuthz("DELIVERY", "ADMIN"), async (req: DelReq, res: DelRes) => {
  try {
    const delivery = await delPrisma.deliveryOrder.findUnique({
      where: { id: req.params.id as string },
      include: { order: { select: { restaurantId: true, id: true } } },
    });
    if (!delivery || delivery.order.restaurantId !== req.restaurantId) {
      res.status(404).json({ error: "Entrega no encontrada" });
      return;
    }
    if (req.user!.role === "DELIVERY" && delivery.driverId !== req.user!.userId) {
      res.status(403).json({ error: "Esta entrega no está asignada a ti" });
      return;
    }

    const next = STATUS_FLOW[delivery.status];
    if (!next) {
      res.status(400).json({ error: "La entrega ya está finalizada" });
      return;
    }

    const updated = await delPrisma.$transaction(async (tx) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando entrega" });
  }
});

export { delRouter as default };
