"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../lib/audit");
const saRouter = (0, express_1.Router)();
exports.default = saRouter;
saRouter.use(auth_1.authenticate, (0, auth_1.authorize)("SUPERADMIN"));
// GET /api/superadmin/restaurants
saRouter.get("/restaurants", async (_req, res) => {
    try {
        const restaurants = await index_1.prisma.restaurant.findMany({
            include: {
                subscription: true,
                _count: { select: { users: true, orders: true, menuItems: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ restaurants });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// GET /api/superadmin/metrics
saRouter.get("/metrics", async (_req, res) => {
    try {
        const totalRestaurants = await index_1.prisma.restaurant.count();
        const activeRestaurants = await index_1.prisma.restaurant.count({ where: { active: true } });
        const totalSubscriptions = await index_1.prisma.subscription.groupBy({
            by: ["plan"],
            _count: true,
        });
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const newThisMonth = await index_1.prisma.restaurant.count({
            where: { createdAt: { gte: monthStart } },
        });
        res.json({
            totalRestaurants,
            activeRestaurants,
            newThisMonth,
            subscriptionsByPlan: totalSubscriptions,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// ─── Create Restaurant (SUPERADMIN only) ────────────────────
const createRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nombre requerido"),
    slug: zod_1.z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
    type: zod_1.z.enum(["COMIDA_RAPIDA", "CEVICHERIA", "COCKTELERIA", "BAR", "PARRILLADA", "RESTAURANTE", "CAFETERIA", "PIZZERIA", "MARISQUERIA", "OTRO"]).optional().default("OTRO"),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    adminName: zod_1.z.string().min(2, "Nombre del admin requerido"),
    adminEmail: zod_1.z.string().email("Email inválido"),
    adminPassword: zod_1.z.string().min(6, "Mínimo 6 caracteres"),
    plan: zod_1.z.enum(["FREE", "TRIAL", "BASIC", "PRO", "ENTERPRISE"]).optional().default("TRIAL"),
});
// POST /api/superadmin/restaurants — Create restaurant + admin + subscription
saRouter.post("/restaurants", async (req, res) => {
    try {
        const data = createRestaurantSchema.parse(req.body);
        const existingSlug = await index_1.prisma.restaurant.findUnique({ where: { slug: data.slug } });
        if (existingSlug) {
            res.status(409).json({ error: "Slug ya en uso" });
            return;
        }
        const existingEmail = await index_1.prisma.user.findUnique({ where: { email: data.adminEmail } });
        if (existingEmail) {
            res.status(409).json({ error: "Email ya registrado" });
            return;
        }
        const hashedPassword = await bcrypt_1.default.hash(data.adminPassword, 10);
        const trialEndsAt = data.plan === "TRIAL" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;
        const planLimits = {
            FREE: { maxUsers: 3, maxProducts: 50, maxCombos: 5, features: { delivery: false, advancedReports: false, whatsapp: false } },
            TRIAL: { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
            BASIC: { maxUsers: 7, maxProducts: 200, maxCombos: 20, features: { delivery: true, advancedReports: false, whatsapp: false } },
            PRO: { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: false } },
            ENTERPRISE: { maxUsers: 9999, maxProducts: 9999, maxCombos: 9999, features: { delivery: true, advancedReports: true, whatsapp: true } },
        };
        const limits = planLimits[data.plan || "TRIAL"];
        const result = await index_1.prisma.$transaction(async (tx) => {
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
        await (0, audit_1.logAudit)({
            userId: req.user?.userId, userName: req.user?.email,
            action: "restaurant.create", targetType: "Restaurant", targetId: result.restaurant.id,
            details: { name: result.restaurant.name, slug: result.restaurant.slug, plan: data.plan || "TRIAL" },
        });
        res.status(201).json({
            message: "Restaurante creado exitosamente",
            restaurant: { id: result.restaurant.id, name: result.restaurant.name, slug: result.restaurant.slug },
            admin: { email: result.admin.email, name: result.admin.name },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando restaurante" });
    }
});
// GET /api/superadmin/restaurants/:id — Detail
saRouter.get("/restaurants/:id", async (req, res) => {
    try {
        const restaurant = await index_1.prisma.restaurant.findUnique({
            where: { id: req.params.id },
            include: {
                subscription: true,
                _count: { select: { users: true, orders: true, menuItems: true } },
            },
        });
        if (!restaurant) {
            res.status(404).json({ error: "Restaurante no encontrado" });
            return;
        }
        res.json({ restaurant });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// PATCH /api/superadmin/restaurants/:id/suspend
saRouter.patch("/restaurants/:id/suspend", async (req, res) => {
    try {
        const restaurant = await index_1.prisma.restaurant.update({
            where: { id: req.params.id },
            data: { active: false },
        });
        await (0, audit_1.logAudit)({
            userId: req.user?.userId, userName: req.user?.email,
            action: "restaurant.suspend", targetType: "Restaurant", targetId: restaurant.id,
            details: { name: restaurant.name },
        });
        res.json({ restaurant });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error suspendiendo" });
    }
});
// PATCH /api/superadmin/restaurants/:id/reactivate
saRouter.patch("/restaurants/:id/reactivate", async (req, res) => {
    try {
        const restaurant = await index_1.prisma.restaurant.update({
            where: { id: req.params.id },
            data: { active: true },
        });
        await (0, audit_1.logAudit)({
            userId: req.user?.userId, userName: req.user?.email,
            action: "restaurant.reactivate", targetType: "Restaurant", targetId: restaurant.id,
            details: { name: restaurant.name },
        });
        res.json({ restaurant });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error reactivando" });
    }
});
// PUT /api/superadmin/subscriptions/:id — Change plan
saRouter.put("/subscriptions/:id", async (req, res) => {
    try {
        const { plan } = req.body;
        if (!["FREE", "TRIAL", "BASIC", "PRO", "ENTERPRISE"].includes(plan)) {
            res.status(400).json({ error: "Plan inválido" });
            return;
        }
        const planLimits = {
            FREE: { maxUsers: 3, maxProducts: 50, maxCombos: 5, price: 0 },
            TRIAL: { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, price: 0 },
            BASIC: { maxUsers: 7, maxProducts: 200, maxCombos: 20, price: 29 },
            PRO: { maxUsers: 20, maxProducts: 9999, maxCombos: 9999, price: 59 },
            ENTERPRISE: { maxUsers: 9999, maxProducts: 9999, maxCombos: 9999, price: 99 },
        };
        const limits = planLimits[plan];
        const sub = await index_1.prisma.subscription.update({
            where: { id: req.params.id },
            data: {
                plan,
                price: limits.price,
                maxUsers: limits.maxUsers,
                maxProducts: limits.maxProducts,
                maxCombos: limits.maxCombos,
            },
        });
        await (0, audit_1.logAudit)({
            userId: req.user?.userId, userName: req.user?.email,
            action: "subscription.plan_change", targetType: "Subscription", targetId: sub.id,
            details: { restaurantId: sub.restaurantId, newPlan: plan },
        });
        res.json({ subscription: sub });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error actualizando suscripción" });
    }
});
// GET /api/superadmin/audit-log — log de acciones críticas
saRouter.get("/audit-log", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
        const logs = await index_1.prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        res.json({ logs });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando auditoría" });
    }
});
// PATCH /api/superadmin/restaurants/:id � Edit restaurant details
saRouter.patch("/restaurants/:id", async (req, res) => {
    try {
        const { name, slug, type, address, phone } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (slug !== undefined)
            data.slug = slug;
        if (type !== undefined)
            data.type = type;
        if (address !== undefined)
            data.address = address;
        if (phone !== undefined)
            data.phone = phone;
        if (slug) {
            const existing = await index_1.prisma.restaurant.findFirst({
                where: { slug: slug, id: { not: req.params.id } },
            });
            if (existing) {
                res.status(409).json({ error: "Slug ya en uso" });
                return;
            }
        }
        const restaurant = await index_1.prisma.restaurant.update({
            where: { id: req.params.id },
            data,
        });
        res.json({ restaurant });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error editando restaurante" });
    }
});
// DELETE /api/superadmin/restaurants/:id � Hard delete
saRouter.delete("/restaurants/:id", async (req, res) => {
    try {
        const restaurant = await index_1.prisma.restaurant.findUnique({
            where: { id: req.params.id },
            select: { id: true, name: true, slug: true },
        });
        await index_1.prisma.restaurant.delete({
            where: { id: req.params.id },
        });
        await (0, audit_1.logAudit)({
            userId: req.user?.userId, userName: req.user?.email,
            action: "restaurant.delete", targetType: "Restaurant", targetId: req.params.id,
            details: restaurant ? { name: restaurant.name, slug: restaurant.slug } : undefined,
        });
        res.json({ message: "Restaurante eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando restaurante" });
    }
});
// PATCH /api/superadmin/restaurants/:id/admin � Reset admin credentials
saRouter.patch("/restaurants/:id/admin", async (req, res) => {
    try {
        const { username, password, name } = req.body;
        const restaurant = await index_1.prisma.restaurant.findUnique({
            where: { id: req.params.id },
            select: { id: true },
        });
        if (!restaurant) {
            res.status(404).json({ error: "Restaurante no encontrado" });
            return;
        }
        const admin = await index_1.prisma.user.findFirst({
            where: { restaurantId: restaurant.id, role: "ADMIN" },
        });
        if (!admin) {
            res.status(404).json({ error: "Admin no encontrado" });
            return;
        }
        const updates = {};
        if (name)
            updates.name = name;
        if (username)
            updates.username = username;
        if (password) {
            const hash = await bcrypt_1.default.hash(password, 10);
            updates.password = hash;
        }
        const updated = await index_1.prisma.user.update({
            where: { id: admin.id },
            data: updates,
            select: { id: true, name: true, username: true, email: true },
        });
        res.json({ admin: updated });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error actualizando admin" });
    }
});
//# sourceMappingURL=superadmin.js.map