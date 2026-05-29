"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Email inválido"),
    password: zod_1.z.string().min(1, "Contraseña requerida"),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(6, "Mínimo 6 caracteres"),
});
// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await index_1.prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
            res.status(401).json({ error: "Credenciales inválidas" });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, user.password);
        if (!valid) {
            res.status(401).json({ error: "Credenciales inválidas" });
            return;
        }
        // Update last login
        await index_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });
        // Set expiration based on role
        const expiresIn = user.role === "ADMIN" || user.role === "SUPERADMIN" ? "24h" : "12h";
        const token = (0, auth_1.signToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
            restaurantId: user.restaurantId,
        }, expiresIn);
        // Include restaurant data so frontend has settings immediately
        let restaurant = null;
        if (user.restaurantId) {
            restaurant = await index_1.prisma.restaurant.findUnique({
                where: { id: user.restaurantId },
                select: { id: true, name: true, slug: true, logo: true, settings: true, currency: true },
            });
        }
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                username: user.username,
                role: user.role,
                restaurantId: user.restaurantId,
                avatar: user.avatar,
                restaurant,
            },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error("Login error:", err);
        res.status(500).json({ error: "Error interno" });
    }
});
// GET /api/auth/me
router.get("/me", auth_1.authenticate, async (req, res) => {
    try {
        const user = await index_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true, email: true, name: true, username: true,
                role: true, restaurantId: true, avatar: true, phone: true,
                restaurant: { select: { id: true, name: true, slug: true, logo: true, settings: true, currency: true } },
            },
        });
        if (!user || !user) {
            res.status(404).json({ error: "Usuario no encontrado" });
            return;
        }
        res.json({ user });
    }
    catch (err) {
        console.error("Me error:", err);
        res.status(500).json({ error: "Error interno" });
    }
});
// PUT /api/auth/change-password
router.put("/change-password", auth_1.authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
        const user = await index_1.prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user) {
            res.status(404).json({ error: "Usuario no encontrado" });
            return;
        }
        const valid = await bcrypt_1.default.compare(currentPassword, user.password);
        if (!valid) {
            res.status(400).json({ error: "Contraseña actual incorrecta" });
            return;
        }
        const hashed = await bcrypt_1.default.hash(newPassword, 10);
        await index_1.prisma.user.update({
            where: { id: user.id },
            data: { password: hashed },
        });
        res.json({ message: "Contraseña actualizada" });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        res.status(500).json({ error: "Error interno" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map