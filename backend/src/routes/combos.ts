// ============================================================
// FILE: backend/src/routes/combos.ts — CRUD completo
// ============================================================
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";
import { checkSubscription, checkLimit } from "../middleware/subscription";

const router = Router();
router.use(authenticate, tenantIsolation);

const comboItemSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  isOptional: z.boolean().default(false),
  isDefault: z.boolean().default(true),
  groupName: z.string().optional().nullable(),
  alternatives: z.array(z.string()).default([]),
});

const comboSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  basePrice: z.number().nonnegative(),
  categoryId: z.string().min(1),
  type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "ASADO", "CUSTOM"]),
  active: z.boolean().optional(),
  image: z.string().url().optional().nullable(),
  availableDays: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  items: z.array(comboItemSchema).min(1, "Un combo necesita al menos 1 ítem"),
});

// GET /api/combos
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const where: Record<string, unknown> = {};
    if (req.restaurantId) where.restaurantId = req.restaurantId;
    if (category) where.categoryId = category as string;
    const showAll = req.query.all as string === "true" && (req.user?.role === "ADMIN" || req.user?.role === "SUPERADMIN");
    if (!showAll) where.active = true;

    const combos = await prisma.combo.findMany({
      where,
      include: {
        comboItems: {
          include: { menuItem: { select: { id: true, name: true, basePrice: true, kitchen: true, type: true } } },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ combos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando combos" });
  }
});

// POST /api/combos
router.post("/", checkSubscription, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { items, ...data } = comboSchema.parse(req.body);
    const rId = req.restaurantId!;

    const limit = await checkLimit(rId, "combos");
    if (!limit.allowed) {
      res.status(403).json({ error: `Límite de combos alcanzado (${limit.current}/${limit.max}). Actualiza tu plan.` });
      return;
    }

    const combo = await prisma.combo.create({
      data: {
        ...data,
        restaurantId: rId,
        comboItems: {
          create: items.map((item) => ({
            ...item,
            alternatives: JSON.stringify(item.alternatives),
          })),
        },
      },
      include: {
        comboItems: { include: { menuItem: { select: { id: true, name: true, basePrice: true, kitchen: true, type: true } } } },
        category: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ combo });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error creando combo" });
  }
});

// PUT /api/combos/:id
router.put("/:id", checkSubscription, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { items, ...data } = comboSchema.parse(req.body);
    const existing = await prisma.combo.findUnique({ where: { id: req.params.id as string } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Combo no encontrado" }); return;
    }

    // Delete old items and recreate
    await prisma.comboItem.deleteMany({ where: { comboId: req.params.id as string } });

    const combo = await prisma.combo.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        comboItems: {
          create: items.map((item) => ({
            ...item,
            alternatives: JSON.stringify(item.alternatives),
          })),
        },
      },
      include: {
        comboItems: { include: { menuItem: { select: { id: true, name: true, basePrice: true, kitchen: true, type: true } } } },
        category: { select: { id: true, name: true } },
      },
    });
    res.json({ combo });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error actualizando combo" });
  }
});

// DELETE /api/combos/:id
router.delete("/:id", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.combo.findUnique({ where: { id: req.params.id as string } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Combo no encontrado" }); return;
    }
    await prisma.combo.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Combo eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando combo" });
  }
});

export default router;