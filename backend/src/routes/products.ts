import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";
import { checkSubscription, checkLimit } from "../middleware/subscription";

const router = Router();
router.use(authenticate, tenantIsolation);

const productSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  basePrice: z.number().nonnegative(),
  categoryId: z.string().min(1),
  type: z.enum(["MAIN", "PROTEIN", "SIDE", "DRINK", "DESSERT"]),
  kitchen: z.enum(["KITCHEN_1", "KITCHEN_2", "BAR", "BOTH", "NONE"]).default("KITCHEN_1"),
  active: z.boolean().optional(),
  image: z.string().url().optional().nullable(),
  prepTime: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
});

const modifierSchema = z.object({
  name: z.string().min(1).max(100),
  priceAdjustment: z.number().nonnegative().default(0),
  active: z.boolean().optional(),
});

// ─── Products ───────────────────────────────────────────────

// GET /api/products
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, active, kitchen, search } = req.query;
    const where: Record<string, unknown> = {};
    if (req.restaurantId) where.restaurantId = req.restaurantId;
    if (category) where.categoryId = category as string;
    if (kitchen) where.kitchen = kitchen as string;
    if (active !== undefined) where.active = active === "true";
    else if (req.user?.role !== "ADMIN" && req.user?.role !== "SUPERADMIN") where.active = true;
    if (search) where.name = { contains: search as string, mode: "insensitive" };

    const products = await prisma.menuItem.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        modifiers: { where: { active: true }, orderBy: { name: "asc" } },
        category: { select: { id: true, name: true, type: true } },
      },
    });
    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando productos" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const product = await prisma.menuItem.findUnique({
      where: { id: req.params.id as string },
      include: { modifiers: true, category: true },
    });
    if (!product || (req.restaurantId && product.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Producto no encontrado" }); return;
    }
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// POST /api/products
router.post("/", checkSubscription, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = productSchema.parse(req.body);
    const rId = req.restaurantId!;

    // Check plan limit
    const limit = await checkLimit(rId, "products");
    if (!limit.allowed) {
      res.status(403).json({ error: `Límite de productos alcanzado (${limit.current}/${limit.max}). Actualiza tu plan.` });
      return;
    }

    const product = await prisma.menuItem.create({
      data: { ...data, restaurantId: rId },
      include: { modifiers: true, category: { select: { id: true, name: true, type: true } } },
    });
    res.status(201).json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error creando producto" });
  }
});

// PUT /api/products/:id
router.put("/:id", checkSubscription, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id as string } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Producto no encontrado" }); return;
    }
    const product = await prisma.menuItem.update({
      where: { id: req.params.id as string },
      data,
      include: { modifiers: true, category: { select: { id: true, name: true, type: true } } },
    });
    res.json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error actualizando producto" });
  }
});

// PATCH /api/products/:id/toggle-active
router.patch("/:id/toggle-active", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id as string } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Producto no encontrado" }); return;
    }
    const product = await prisma.menuItem.update({
      where: { id: req.params.id as string },
      data: { active: !existing.active },
    });
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id as string } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Producto no encontrado" }); return;
    }
    await prisma.menuItem.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Producto eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando. Puede tener órdenes asociadas." });
  }
});

// ─── Modifiers ──────────────────────────────────────────────

// GET /api/products/:id/modifiers
router.get("/:id/modifiers", async (req: Request, res: Response) => {
  try {
    const modifiers = await prisma.modifier.findMany({
      where: { menuItemId: req.params.id as string },
      orderBy: { name: "asc" },
    });
    res.json({ modifiers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// POST /api/products/:id/modifiers
router.post("/:id/modifiers", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = modifierSchema.parse(req.body);
    const product = await prisma.menuItem.findUnique({ where: { id: req.params.id as string } });
    if (!product || (req.restaurantId && product.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Producto no encontrado" }); return;
    }
    const modifier = await prisma.modifier.create({
      data: { ...data, menuItemId: req.params.id as string },
    });
    res.status(201).json({ modifier });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// PUT /api/modifiers/:id
router.put("/modifiers/:id", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = modifierSchema.partial().parse(req.body);
    const modifier = await prisma.modifier.update({ where: { id: req.params.id as string }, data });
    res.json({ modifier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// DELETE /api/modifiers/:id
router.delete("/modifiers/:id", authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    await prisma.modifier.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Modificador eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

export default router;
