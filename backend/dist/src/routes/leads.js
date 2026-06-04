"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
// S8 — rate-limit dedicado: 5 leads / 15 min por IP.
const leadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos." },
});
const leadSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nombre requerido"),
    email: zod_1.z.string().email("Email inválido"),
    restaurant: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
// POST /api/leads — Public landing page form
router.post("/", leadLimiter, async (req, res) => {
    try {
        // S8 — honeypot: si el campo oculto viene relleno, es un bot.
        // TODO: anti-bot más fuerte → Cloudflare Turnstile.
        if (typeof req.body?.honeypot === "string" && req.body.honeypot.trim() !== "") {
            res.status(201).json({ message: "Recibido! Te contactaremos pronto." });
            return;
        }
        const data = leadSchema.parse(req.body);
        const lead = await index_1.prisma.lead.create({ data });
        res.status(201).json({ message: "Recibido! Te contactaremos pronto.", lead });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error("Lead error:", err);
        res.status(500).json({ error: "Error" });
    }
});
exports.default = router;
//# sourceMappingURL=leads.js.map