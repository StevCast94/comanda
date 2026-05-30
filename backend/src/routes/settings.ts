import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";
import { checkSubscription } from "../middleware/subscription";

const router = Router();
router.use(authenticate, tenantIsolation, checkSubscription);

// GET /api/restaurant/settings
router.get("/settings", async (req: Request, res: Response) => {
  const restaurantId = req.restaurantId!;
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { settings: true, name: true, slug: true, address: true, phone: true, timezone: true, currency: true, logo: true },
    });
    if (!restaurant) return res.status(404).json({ error: "Restaurante no encontrado" });
    res.json(restaurant);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/restaurant/settings
router.put("/settings", authorize("ADMIN", "SUPERADMIN"), async (req: Request, res: Response) => {
  const restaurantId = req.restaurantId!;
  try {
    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { settings: req.body.settings ?? req.body },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/restaurant/tables
router.get("/tables", async (req: Request, res: Response) => {
  const restaurantId = req.restaurantId!;
  try {
    const tables = await prisma.table.findMany({
      where: { restaurantId, active: true },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    });
    res.json({ data: tables });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/restaurant/tables
router.post("/tables", authorize("ADMIN", "SUPERADMIN"), async (req: Request, res: Response) => {
  const restaurantId = req.restaurantId!;
  const { number, floor, capacity } = req.body;
  try {
    const table = await prisma.table.create({
      data: { restaurantId, number: parseInt(number), floor: floor || "Piso 1", capacity: parseInt(capacity) || 4 },
    });
    res.status(201).json(table);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/restaurant/tables/:id
router.delete("/tables/:id", authorize("ADMIN", "SUPERADMIN"), async (req: Request, res: Response) => {
  const restaurantId = req.restaurantId!;
  try {
    await prisma.table.deleteMany({ where: { id: req.params.id as string, restaurantId } });
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/restaurant/info — admin + superadmin
router.patch("/info", authorize("ADMIN", "SUPERADMIN"), async (req: Request, res: Response) => {
  const restaurantId = req.restaurantId!;
  try {
    const { name, address, phone, timezone, currency } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (timezone !== undefined) data.timezone = timezone;
    if (currency !== undefined) data.currency = currency;

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data,
    });
    res.json({ restaurant });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
