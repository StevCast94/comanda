"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, tenant_1.tenantIsolation);
const productSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(500).optional().nullable(),
    basePrice: zod_1.z.number().nonnegative(),
    categoryId: zod_1.z.string().min(1),
    type: zod_1.z.enum(["MAIN", "PROTEIN", "SIDE", "DRINK", "DESSERT"]),
    customType: zod_1.z.string().max(100).optional().nullable(),
    kitchen: zod_1.z.enum(["KITCHEN_1", "NONE"]).default("KITCHEN_1"),
    active: zod_1.z.boolean().optional(),
    image: zod_1.z.string().url().optional().nullable(),
    prepTime: zod_1.z.number().int().positive().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
const modifierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    priceAdjustment: zod_1.z.number().nonnegative().default(0),
    active: zod_1.z.boolean().optional(),
});
// ─── Products ───────────────────────────────────────────────
// GET /api/products
router.get("/", async (req, res) => {
    try {
        const { category, active, kitchen, search } = req.query;
        const where = {};
        if (req.restaurantId)
            where.restaurantId = req.restaurantId;
        if (category)
            where.categoryId = category;
        if (kitchen)
            where.kitchen = kitchen;
        if (active !== undefined)
            where.active = active === "true";
        else if (req.user?.role !== "ADMIN" && req.user?.role !== "SUPERADMIN")
            where.active = true;
        if (search)
            where.name = { contains: search, mode: "insensitive" };
        const products = await index_1.prisma.menuItem.findMany({
            where,
            orderBy: { sortOrder: "asc" },
            include: {
                modifiers: { where: { active: true }, orderBy: { name: "asc" } },
                category: { select: { id: true, name: true, type: true } },
            },
        });
        res.json({ products });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando productos" });
    }
});
// GET /api/products/:id
router.get("/:id", async (req, res) => {
    try {
        const product = await index_1.prisma.menuItem.findUnique({
            where: { id: req.params.id },
            include: { modifiers: true, category: true },
        });
        if (!product || (req.restaurantId && product.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Producto no encontrado" });
            return;
        }
        res.json({ product });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// POST /api/products
router.post("/", subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = productSchema.parse(req.body);
        const rId = req.restaurantId;
        // Check plan limit
        const limit = await (0, subscription_1.checkLimit)(rId, "products");
        if (!limit.allowed) {
            res.status(403).json({ error: `Límite de productos alcanzado (${limit.current}/${limit.max}). Actualiza tu plan.` });
            return;
        }
        const product = await index_1.prisma.menuItem.create({
            data: { ...data, restaurantId: rId },
            include: { modifiers: true, category: { select: { id: true, name: true, type: true } } },
        });
        res.status(201).json({ product });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando producto" });
    }
});
// PUT /api/products/:id
router.put("/:id", subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = productSchema.partial().parse(req.body);
        const existing = await index_1.prisma.menuItem.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Producto no encontrado" });
            return;
        }
        const product = await index_1.prisma.menuItem.update({
            where: { id: req.params.id },
            data,
            include: { modifiers: true, category: { select: { id: true, name: true, type: true } } },
        });
        res.json({ product });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error actualizando producto" });
    }
});
// PATCH /api/products/:id/toggle-active
router.patch("/:id/toggle-active", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.menuItem.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Producto no encontrado" });
            return;
        }
        const product = await index_1.prisma.menuItem.update({
            where: { id: req.params.id },
            data: { active: !existing.active },
        });
        res.json({ product });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// DELETE /api/products/:id
router.delete("/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.menuItem.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Producto no encontrado" });
            return;
        }
        await index_1.prisma.menuItem.delete({ where: { id: req.params.id } });
        res.json({ message: "Producto eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando. Puede tener órdenes asociadas." });
    }
});
// ─── Modifiers ──────────────────────────────────────────────
// GET /api/products/:id/modifiers
router.get("/:id/modifiers", async (req, res) => {
    try {
        const modifiers = await index_1.prisma.modifier.findMany({
            where: { menuItemId: req.params.id },
            orderBy: { name: "asc" },
        });
        res.json({ modifiers });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// POST /api/products/:id/modifiers
router.post("/:id/modifiers", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = modifierSchema.parse(req.body);
        const product = await index_1.prisma.menuItem.findUnique({ where: { id: req.params.id } });
        if (!product || (req.restaurantId && product.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Producto no encontrado" });
            return;
        }
        const modifier = await index_1.prisma.modifier.create({
            data: { ...data, menuItemId: req.params.id },
        });
        res.status(201).json({ modifier });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// PUT /api/modifiers/:id
router.put("/modifiers/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = modifierSchema.partial().parse(req.body);
        const existing = await index_1.prisma.modifier.findUnique({
            where: { id: req.params.id },
            include: { menuItem: { select: { restaurantId: true } } },
        });
        if (!existing || (req.restaurantId && existing.menuItem.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Modificador no encontrado" });
            return;
        }
        const modifier = await index_1.prisma.modifier.update({ where: { id: req.params.id }, data });
        res.json({ modifier });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// DELETE /api/modifiers/:id
router.delete("/modifiers/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.modifier.findUnique({
            where: { id: req.params.id },
            include: { menuItem: { select: { restaurantId: true } } },
        });
        if (!existing || (req.restaurantId && existing.menuItem.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Modificador no encontrado" });
            return;
        }
        await index_1.prisma.modifier.delete({ where: { id: req.params.id } });
        res.json({ message: "Modificador eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
exports.default = router;
//# sourceMappingURL=products.js.map