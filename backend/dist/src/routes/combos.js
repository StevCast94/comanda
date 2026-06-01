"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// ============================================================
// FILE: backend/src/routes/combos.ts — CRUD completo
// ============================================================
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, tenant_1.tenantIsolation);
const comboItemSchema = zod_1.z.object({
    menuItemId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().positive().default(1),
    isOptional: zod_1.z.boolean().default(false),
    isDefault: zod_1.z.boolean().default(true),
    groupName: zod_1.z.string().optional().nullable(),
    alternatives: zod_1.z.array(zod_1.z.string()).default([]),
});
const comboSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    basePrice: zod_1.z.number().nonnegative(),
    categoryId: zod_1.z.string().min(1),
    type: zod_1.z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "ASADO", "CUSTOM"]),
    active: zod_1.z.boolean().optional(),
    image: zod_1.z.string().url().optional().nullable(),
    availableDays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
    items: zod_1.z.array(comboItemSchema).min(1, "Un combo necesita al menos 1 ítem"),
});
// GET /api/combos
router.get("/", async (req, res) => {
    try {
        const { category } = req.query;
        const where = {};
        if (req.restaurantId)
            where.restaurantId = req.restaurantId;
        if (category)
            where.categoryId = category;
        const showAll = req.query.all === "true" && (req.user?.role === "ADMIN" || req.user?.role === "SUPERADMIN");
        if (!showAll)
            where.active = true;
        const combos = await index_1.prisma.combo.findMany({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando combos" });
    }
});
// POST /api/combos
router.post("/", subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const { items, ...data } = comboSchema.parse(req.body);
        const rId = req.restaurantId;
        const limit = await (0, subscription_1.checkLimit)(rId, "combos");
        if (!limit.allowed) {
            res.status(403).json({ error: `Límite de combos alcanzado (${limit.current}/${limit.max}). Actualiza tu plan.` });
            return;
        }
        const combo = await index_1.prisma.combo.create({
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando combo" });
    }
});
// PUT /api/combos/:id
router.put("/:id", subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const { items, ...data } = comboSchema.parse(req.body);
        const existing = await index_1.prisma.combo.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Combo no encontrado" });
            return;
        }
        // Delete old items and recreate
        await index_1.prisma.comboItem.deleteMany({ where: { comboId: req.params.id } });
        const combo = await index_1.prisma.combo.update({
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error actualizando combo" });
    }
});
// DELETE /api/combos/:id
router.delete("/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.combo.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Combo no encontrado" });
            return;
        }
        await index_1.prisma.combo.delete({ where: { id: req.params.id } });
        res.json({ message: "Combo eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando combo" });
    }
});
exports.default = router;
//# sourceMappingURL=combos.js.map