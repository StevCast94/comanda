import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, authorize } from "../middleware/auth";
import { tenantIsolation } from "../middleware/tenant";
import { checkSubscription } from "../middleware/subscription";

const router = Router();
router.use(authenticate, tenantIsolation, checkSubscription, authorize("ADMIN"));

const inventorySchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().max(50).optional().nullable(),
  unit: z.string().max(20).default("unidad"),
  currentStock: z.number().nonnegative().default(0),
  minStock: z.number().nonnegative().default(0),
  costPerUnit: z.number().nonnegative().default(0),
  supplierId: z.string().optional().nullable(),
});

const supplierSchema = z.object({
  name: z.string().min(1).max(100),
  contact: z.string().max(100).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

// ─── Inventory Items ────────────────────────────────────────

// GET /api/inventory
router.get("/", async (req: Request, res: Response) => {
  try {
    const { lowStock, category, search } = req.query;
    const where: Record<string, unknown> = { restaurantId: req.restaurantId! };
    if (category) where.category = category;
    if (search) where.name = { contains: search as string, mode: "insensitive" };

    let items = await prisma.inventory.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    if (lowStock === "true") {
      items = items.filter((i) => i.currentStock <= i.minStock);
    }

    const lowStockCount = items.filter((i) => i.currentStock <= i.minStock).length;

    res.json({ items, lowStockCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando inventario" });
  }
});

// POST /api/inventory
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = inventorySchema.parse(req.body);
    const item = await prisma.inventory.create({
      data: { ...data, restaurantId: req.restaurantId! },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error creando insumo" });
  }
});

// PUT /api/inventory/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const data = inventorySchema.partial().parse(req.body);
    const existing = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.restaurantId !== req.restaurantId!) {
      res.status(404).json({ error: "Insumo no encontrado" }); return;
    }
    const item = await prisma.inventory.update({
      where: { id: req.params.id },
      data,
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error actualizando insumo" });
  }
});

// POST /api/inventory/:id/restock
router.post("/:id/restock", async (req: Request, res: Response) => {
  try {
    const { quantity, costPerUnit } = z.object({
      quantity: z.number().positive("Cantidad debe ser mayor a 0"),
      costPerUnit: z.number().nonnegative().optional(),
    }).parse(req.body);

    const existing = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.restaurantId !== req.restaurantId!) {
      res.status(404).json({ error: "Insumo no encontrado" }); return;
    }

    const updateData: Record<string, unknown> = {
      currentStock: { increment: quantity },
      lastRestockDate: new Date(),
    };
    if (costPerUnit !== undefined) updateData.costPerUnit = costPerUnit;

    const item = await prisma.inventory.update({
      where: { id: req.params.id },
      data: updateData,
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error reabasteciendo" });
  }
});

// DELETE /api/inventory/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const existing = await prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.restaurantId !== req.restaurantId!) {
      res.status(404).json({ error: "Insumo no encontrado" }); return;
    }
    await prisma.inventory.delete({ where: { id: req.params.id } });
    res.json({ message: "Insumo eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// ─── Suppliers ──────────────────────────────────────────────

// GET /api/inventory/suppliers
router.get("/suppliers", async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { restaurantId: req.restaurantId! },
      include: { _count: { select: { inventory: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ suppliers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// POST /api/inventory/suppliers
router.post("/suppliers", async (req: Request, res: Response) => {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({
      data: { ...data, restaurantId: req.restaurantId! },
    });
    res.status(201).json({ supplier });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// DELETE /api/inventory/suppliers/:id
router.delete("/suppliers/:id", async (req: Request, res: Response) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.json({ message: "Proveedor eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error. Puede tener insumos asociados." });
  }
});

export default router;
