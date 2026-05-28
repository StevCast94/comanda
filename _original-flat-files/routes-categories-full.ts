import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";
import { checkSubscription } from "../middleware/subscription";

const router = Router();
router.use(authenticate, tenantIsolation);

const categorySchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(50),
  type: z.enum(["COMBO", "A_LA_CARTE", "BEVERAGE", "DESSERT", "BREAKFAST", "LUNCH", "DINNER", "SNACK", "ASADO"]),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

// GET /api/categories
router.get("/", async (req: Request, res: Response) => {
  try {
    const showAll = req.query.all === "true" && (req.user?.role === "ADMIN" || req.user?.role === "SUPERADMIN");
    const where: Record<string, unknown> = {};
    if (req.restaurantId) where.restaurantId = req.restaurantId;
    if (!showAll) where.active = true;

    const categories = await prisma.category.findMany({
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

// POST /api/categories
router.post("/", checkSubscription, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: { ...data, restaurantId: req.restaurantId! },
    });
    res.status(201).json({ category });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error creando categoría" });
  }
});

// PUT /api/categories/:id
router.put("/:id", checkSubscription, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Categoría no encontrada" }); return;
    }
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ category });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error actualizando categoría" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { menuItems: true, combos: true } } },
    });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Categoría no encontrada" }); return;
    }
    if (existing._count.menuItems > 0 || existing._count.combos > 0) {
      res.status(400).json({ error: `No se puede eliminar: tiene ${existing._count.menuItems} productos y ${existing._count.combos} combos` }); return;
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: "Categoría eliminada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando categoría" });
  }
});

export default router;
