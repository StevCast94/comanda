"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const index_1 = require("../index");
const commonPasswords_1 = require("../lib/commonPasswords");
const router = (0, express_1.Router)();
// S8 — rate-limit dedicado: 5 registros / 15 min por IP.
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados registros. Intenta de nuevo en 15 minutos." },
});
const registerSchema = zod_1.z.object({
    restaurantName: zod_1.z.string().min(2, "Nombre del restaurante requerido"),
    slug: zod_1.z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
    type: zod_1.z.enum(["COMIDA_RAPIDA", "CEVICHERIA", "COCKTELERIA", "BAR", "PARRILLADA", "RESTAURANTE", "CAFETERIA", "PIZZERIA", "MARISQUERIA", "OTRO"]).optional().default("RESTAURANTE"),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    adminName: zod_1.z.string().min(2, "Nombre del administrador requerido"),
    adminEmail: zod_1.z.string().email("Email inválido"),
    adminPassword: zod_1.z
        .string()
        .min(8, "Mínimo 8 caracteres")
        .refine((p) => !(0, commonPasswords_1.isCommonPassword)(p), "Contraseña demasiado común, elige otra"),
});
// POST /api/register — Public registration of a new restaurant
router.post("/", registerLimiter, async (req, res) => {
    try {
        // S8 — honeypot: bots rellenan campos ocultos. Si viene con valor,
        // respondemos 200 sin procesar (no le damos pistas al bot).
        // TODO: para anti-bot más fuerte, integrar Cloudflare Turnstile aquí
        // (validar req.body.turnstileToken contra el endpoint de siteverify).
        if (typeof req.body?.honeypot === "string" && req.body.honeypot.trim() !== "") {
            res.status(200).json({ message: "¡Restaurante registrado!" });
            return;
        }
        const data = registerSchema.parse(req.body);
        // Check unique slug
        const existingSlug = await index_1.prisma.restaurant.findUnique({ where: { slug: data.slug } });
        if (existingSlug) {
            res.status(409).json({ error: "Ese slug ya está en uso. Prueba otro." });
            return;
        }
        // Check unique email
        const existingEmail = await index_1.prisma.user.findUnique({ where: { email: data.adminEmail } });
        if (existingEmail) {
            res.status(409).json({ error: "Ese email ya está registrado." });
            return;
        }
        const hashedPassword = await bcrypt_1.default.hash(data.adminPassword, 12);
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
        // Transaction: Restaurant + Admin User + Trial Subscription
        const result = await index_1.prisma.$transaction(async (tx) => {
            const restaurant = await tx.restaurant.create({
                data: {
                    name: data.restaurantName,
                    slug: data.slug,
                    type: data.type || "RESTAURANTE",
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
            const subscription = await tx.subscription.create({
                data: {
                    restaurantId: restaurant.id,
                    plan: "TRIAL",
                    status: "TRIAL",
                    trialEndsAt,
                    price: 0,
                    maxUsers: 20,
                    maxProducts: 9999,
                    maxCombos: 9999,
                    features: { delivery: true, advancedReports: true, whatsapp: false },
                },
            });
            // Create default tables (6 tables)
            await tx.table.createMany({
                data: Array.from({ length: 6 }, (_, i) => ({
                    restaurantId: restaurant.id,
                    number: i + 1,
                    floor: "Piso 1",
                    capacity: 4,
                })),
            });
            return { restaurant, admin, subscription };
        });
        res.status(201).json({
            message: "¡Restaurante registrado! Tu prueba gratuita de 14 días ha comenzado.",
            restaurant: {
                id: result.restaurant.id,
                name: result.restaurant.name,
                slug: result.restaurant.slug,
            },
            admin: {
                email: result.admin.email,
                name: result.admin.name,
            },
            trialEndsAt,
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error("Register error:", err);
        res.status(500).json({ error: "Error interno" });
    }
});
exports.default = router;
//# sourceMappingURL=register.js.map