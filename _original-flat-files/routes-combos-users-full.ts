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
    const showAll = req.query.all === "true" && (req.user?.role === "ADMIN" || req.user?.role === "SUPERADMIN");
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
    const existing = await prisma.combo.findUnique({ where: { id: req.params.id } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Combo no encontrado" }); return;
    }

    // Delete old items and recreate
    await prisma.comboItem.deleteMany({ where: { comboId: req.params.id } });

    const combo = await prisma.combo.update({
      where: { id: req.params.id },
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
    const existing = await prisma.combo.findUnique({ where: { id: req.params.id } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Combo no encontrado" }); return;
    }
    await prisma.combo.delete({ where: { id: req.params.id } });
    res.json({ message: "Combo eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando combo" });
  }
});

export default router;


// ============================================================
// FILE: backend/src/routes/users.ts — CRUD completo
// ============================================================
import { Router as URouter, Request as UReq, Response as URes } from "express";
import { z as uz } from "zod";
import bcrypt from "bcrypt";
import { prisma as uPrisma } from "../index";
import { authenticate as uAuth, authorize as uAuthz } from "../middleware/auth";
import { tenantIsolation as uTenant } from "../middleware/tenant";
import { checkSubscription as uSub, checkLimit as uLimit } from "../middleware/subscription";

const uRouter = URouter();
uRouter.use(uAuth, uTenant, uSub);

const userSchema = uz.object({
  email: uz.string().email(),
  username: uz.string().min(3).max(30).regex(/^[a-z0-9_-]+$/i, "Solo letras, números, guión y guión bajo"),
  password: uz.string().min(6),
  name: uz.string().min(2).max(100),
  role: uz.enum(["ADMIN", "CASHIER", "COOK_1", "COOK_2", "WAITER", "DELIVERY"]),
  phone: uz.string().optional().nullable(),
  active: uz.boolean().optional(),
});

const updateUserSchema = userSchema.partial().omit({ password: true }).extend({
  password: uz.string().min(6).optional(),
});

// GET /api/users
uRouter.get("/", uAuthz("ADMIN"), async (req: UReq, res: URes) => {
  try {
    const users = await uPrisma.user.findMany({
      where: { restaurantId: req.restaurantId! },
      select: {
        id: true, email: true, username: true, name: true, role: true,
        phone: true, active: true, lastLogin: true, createdAt: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando usuarios" });
  }
});

// POST /api/users
uRouter.post("/", uAuthz("ADMIN"), async (req: UReq, res: URes) => {
  try {
    const data = userSchema.parse(req.body);
    const rId = req.restaurantId!;

    // ADMIN can't create SUPERADMIN
    if (data.role === "ADMIN" && req.user?.role !== "SUPERADMIN") {
      res.status(403).json({ error: "No puedes crear usuarios ADMIN" }); return;
    }

    const limit = await uLimit(rId, "users");
    if (!limit.allowed) {
      res.status(403).json({ error: `Límite de usuarios alcanzado (${limit.current}/${limit.max}). Actualiza tu plan.` });
      return;
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await uPrisma.user.create({
      data: { ...data, password: hashed, restaurantId: rId },
      select: { id: true, email: true, username: true, name: true, role: true, phone: true, active: true },
    });
    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof uz.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error creando usuario" });
  }
});

// PUT /api/users/:id
uRouter.put("/:id", uAuthz("ADMIN"), async (req: UReq, res: URes) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const existing = await uPrisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Usuario no encontrado" }); return;
    }
    if (existing.role === "SUPERADMIN") {
      res.status(403).json({ error: "No puedes editar un SUPERADMIN" }); return;
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    } else {
      delete updateData.password;
    }

    const user = await uPrisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, email: true, username: true, name: true, role: true, phone: true, active: true },
    });
    res.json({ user });
  } catch (err) {
    if (err instanceof uz.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error actualizando usuario" });
  }
});

// PATCH /api/users/:id/toggle-active
uRouter.patch("/:id/toggle-active", uAuthz("ADMIN"), async (req: UReq, res: URes) => {
  try {
    const existing = await uPrisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Usuario no encontrado" }); return;
    }
    if (existing.id === req.user?.userId) {
      res.status(400).json({ error: "No puedes desactivarte a ti mismo" }); return;
    }
    const user = await uPrisma.user.update({
      where: { id: req.params.id },
      data: { active: !existing.active },
      select: { id: true, name: true, active: true },
    });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// DELETE /api/users/:id
uRouter.delete("/:id", uAuthz("ADMIN"), async (req: UReq, res: URes) => {
  try {
    const existing = await uPrisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
      res.status(404).json({ error: "Usuario no encontrado" }); return;
    }
    if (existing.id === req.user?.userId) {
      res.status(400).json({ error: "No puedes eliminarte a ti mismo" }); return;
    }
    await uPrisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando. El usuario puede tener órdenes asociadas." });
  }
});

export { uRouter as default };
