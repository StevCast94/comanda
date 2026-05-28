"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
// ============================================================
// FILE: backend/src/routes/users.ts — CRUD completo
// ============================================================
const express_1 = require("express");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const uRouter = (0, express_1.Router)();
exports.default = uRouter;
uRouter.use(auth_1.authenticate, tenant_1.tenantIsolation, subscription_1.checkSubscription);
const userSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/i, "Solo letras, números, guión y guión bajo"),
    password: zod_1.z.string().min(6),
    name: zod_1.z.string().min(2).max(100),
    role: zod_1.z.enum(["ADMIN", "CASHIER", "COOK_1", "COOK_2", "WAITER", "DELIVERY"]),
    phone: zod_1.z.string().optional().nullable(),
    active: zod_1.z.boolean().optional(),
});
const updateUserSchema = userSchema.partial().omit({ password: true }).extend({
    password: zod_1.z.string().min(6).optional(),
});
// GET /api/users
uRouter.get("/", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const users = await index_1.prisma.user.findMany({
            where: { restaurantId: req.restaurantId },
            select: {
                id: true, email: true, username: true, name: true, role: true,
                phone: true, active: true, lastLogin: true, createdAt: true,
            },
            orderBy: { name: "asc" },
        });
        res.json({ users });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando usuarios" });
    }
});
// POST /api/users
uRouter.post("/", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = userSchema.parse(req.body);
        const rId = req.restaurantId;
        // ADMIN can't create SUPERADMIN
        if (data.role === "ADMIN" && req.user?.role !== "SUPERADMIN") {
            res.status(403).json({ error: "No puedes crear usuarios ADMIN" });
            return;
        }
        const limit = await (0, subscription_1.checkLimit)(rId, "users");
        if (!limit.allowed) {
            res.status(403).json({ error: `Límite de usuarios alcanzado (${limit.current}/${limit.max}). Actualiza tu plan.` });
            return;
        }
        const hashed = await bcrypt_1.default.hash(data.password, 10);
        const user = await index_1.prisma.user.create({
            data: { ...data, password: hashed, restaurantId: rId },
            select: { id: true, email: true, username: true, name: true, role: true, phone: true, active: true },
        });
        res.status(201).json({ user });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando usuario" });
    }
});
// PUT /api/users/:id
uRouter.put("/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = updateUserSchema.parse(req.body);
        const existing = await index_1.prisma.user.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Usuario no encontrado" });
            return;
        }
        if (existing.role === "SUPERADMIN") {
            res.status(403).json({ error: "No puedes editar un SUPERADMIN" });
            return;
        }
        const updateData = { ...data };
        if (data.password) {
            updateData.password = await bcrypt_1.default.hash(data.password, 10);
        }
        else {
            delete updateData.password;
        }
        const user = await index_1.prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: { id: true, email: true, username: true, name: true, role: true, phone: true, active: true },
        });
        res.json({ user });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error actualizando usuario" });
    }
});
// PATCH /api/users/:id/toggle-active
uRouter.patch("/:id/toggle-active", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.user.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Usuario no encontrado" });
            return;
        }
        if (existing.id === req.user?.userId) {
            res.status(400).json({ error: "No puedes desactivarte a ti mismo" });
            return;
        }
        const user = await index_1.prisma.user.update({
            where: { id: req.params.id },
            data: { active: !existing.active },
            select: { id: true, name: true, active: true },
        });
        res.json({ user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// DELETE /api/users/:id
uRouter.delete("/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.user.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Usuario no encontrado" });
            return;
        }
        if (existing.id === req.user?.userId) {
            res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
            return;
        }
        await index_1.prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: "Usuario eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando. El usuario puede tener órdenes asociadas." });
    }
});
//# sourceMappingURL=users.js.map