import { Router as SARouter, Request as SAReq, Response as SARes } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
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

// ─── Create Restaurant (SUPERADMIN only) ────────────────────

const createRestaurantSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  type: z.enum(["COMIDA_RAPIDA","CEVICHERIA","COCKTELERIA","BAR","PARRILLADA","RESTAURANTE","CAFETERIA","PIZZERIA","MARISQUERIA","OTRO"]).optional().default("OTRO"),
  address: z.string().optional(),
  phone: z.string().optional(),
  adminName: z.string().min(2, "Nombre del admin requerido"),
  adminEmail: z.string().email("Email inválido"),
  adminPassword: z.string().min(6, "Mínimo 6 caracteres"),
  plan: z.enum(["FREE","TRIAL","BASIC","PRO","ENTERPRISE"]).optional().default("TRIAL"),
});

// POST /api/superadmin/restaurants — Create restaurant + admin + subscription
saRouter.post("/restaurants", async (req: SAReq, res: SARes) => {
  try {
    const data = createRestaurantSchema.parse(req.body);

    const existingSlug = await saPrisma.restaurant.findUnique({ where: { slug: data.slug } });
    if (existingSlug) { res.status(409).json({ error: "Slug ya en uso" }); return; }

    const existingEmail = await saPrisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existingEmail) { res.status(409).json({ error: "Email ya registrado" }); return; }

    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
    const trialEndsAt = data.plan === "TRIAL" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

    const planLimits: Record<string, { maxUsers: number; maxProducts: number; maxCombos: number; features: any }> = {
      FREE:     { maxUsers: 3, maxProducts: 50, maxCombos: 5, features: { delivery: false, advancedReports: false, whatsapp: false } },
      TRIAL:    { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
      BASIC:    { maxUsers: 7, maxProducts: 200, maxCombos: 20, features: { delivery: true, advancedReports: false, whatsapp: false } },
      PRO:      { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
      ENTERPRISE:{ maxUsers: 9999, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: true } },
    };

    const limits = planLimits[data.plan || "TRIAL"];

    const result = await saPrisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.name,
          slug: data.slug,
          type: data.type || "OTRO",
          address: data.address,
          phone: data.phone,
          settings: { taxRate: 0.15, serviceRate: 0.10, defaultTip: 0 },
        },
      });

      const admin = await tx.user.create({
        data: {
          email: data.adminEmail,
          username: "admin-" + data.slug,
          password: hashedPassword,
          name: data.adminName,
          role: "ADMIN",
          restaurantId: restaurant.id,
        },
      });

      await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          plan: data.plan || "TRIAL",
          status: data.plan === "FREE" ? "ACTIVE" : data.plan === "TRIAL" ? "TRIAL" : "ACTIVE",
          trialEndsAt,
          price: data.plan === "BASIC" ? 29 : data.plan === "PRO" ? 59 : data.plan === "ENTERPRISE" ? 99 : 0,
          maxUsers: limits.maxUsers,
          maxProducts: limits.maxProducts,
          maxCombos: limits.maxCombos,
          features: limits.features,
        },
      });

      await tx.table.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          restaurantId: restaurant.id,
          number: i + 1,
          floor: "Piso 1",
          capacity: 4,
        })),
      });

      return { restaurant, admin };
    });

    res.status(201).json({
      message: "Restaurante creado exitosamente",
      restaurant: { id: result.restaurant.id, name: result.restaurant.name, slug: result.restaurant.slug },
      admin: { email: result.admin.email, name: result.admin.name },
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Datos inválidos", details: err.errors }); return; }
    console.error(err);
    res.status(500).json({ error: "Error creando restaurante" });
  }
});

// GET /api/superadmin/restaurants/:id — Detail
saRouter.get("/restaurants/:id", async (req: SAReq, res: SARes) => {
  try {
    const restaurant = await saPrisma.restaurant.findUnique({
      where: { id: req.params.id as string },
      include: {
        subscription: true,
        _count: { select: { users: true, orders: true, menuItems: true } },
      },
    });
    if (!restaurant) { res.status(404).json({ error: "Restaurante no encontrado" }); return; }
    res.json({ restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});

// PATCH /api/superadmin/restaurants/:id/suspend
saRouter.patch("/restaurants/:id/suspend", async (req: SAReq, res: SARes) => {
  try {
    const restaurant = await saPrisma.restaurant.update({
      where: { id: req.params.id as string },
      data: { active: false },
    });
    res.json({ restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error suspendiendo" });
  }
});

// PATCH /api/superadmin/restaurants/:id/reactivate
saRouter.patch("/restaurants/:id/reactivate", async (req: SAReq, res: SARes) => {
  try {
    const restaurant = await saPrisma.restaurant.update({
      where: { id: req.params.id as string },
      data: { active: true },
    });
    res.json({ restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error reactivando" });
  }
});

// PUT /api/superadmin/subscriptions/:id — Change plan
saRouter.put("/subscriptions/:id", async (req: SAReq, res: SARes) => {
  try {
    const { plan } = req.body;
    if (!["FREE","TRIAL","BASIC","PRO","ENTERPRISE"].includes(plan)) {
      res.status(400).json({ error: "Plan inválido" }); return;
    }

    const planLimits: Record<string, any> = {
      FREE:     { maxUsers: 3, maxProducts: 50, maxCombos: 5, price: 0 },
      TRIAL:    { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, price: 0 },
      BASIC:    { maxUsers: 7, maxProducts: 200, maxCombos: 20, price: 29 },
      PRO:      { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, price: 59 },
      ENTERPRISE:{ maxUsers: 9999, maxProducts: 9999, maxCombos: 9999, price: 99 },
    };
    const limits = planLimits[plan];

    const sub = await saPrisma.subscription.update({
      where: { id: req.params.id },
      data: {
        plan,
        price: limits.price,
        maxUsers: limits.maxUsers,
        maxProducts: limits.maxProducts,
        maxCombos: limits.maxCombos,
      },
    });
    res.json({ subscription: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando suscripción" });
  }
});

export { saRouter as default };
