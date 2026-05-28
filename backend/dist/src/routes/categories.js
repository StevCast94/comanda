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
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Nombre requerido").max(50),
    type: zod_1.z.enum(["COMBO", "A_LA_CARTE", "BEVERAGE", "DESSERT", "BREAKFAST", "LUNCH", "DINNER", "SNACK", "ASADO"]),
    sortOrder: zod_1.z.number().int().optional(),
    active: zod_1.z.boolean().optional(),
});
// GET /api/categories
router.get("/", async (req, res) => {
    try {
        const showAll = req.query.all === "true" && (req.user?.role === "ADMIN" || req.user?.role === "SUPERADMIN");
        const categories = await index_1.prisma.category.findMany({
            where: { restaurantId: req.restaurantId, ...(showAll ? {} : { active: true }) },
            orderBy: { sortOrder: "asc" },
            include: { _count: { select: { menuItems: true, combos: true } } },
        });
        res.json({ categories });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando categorías" });
    }
});
// POST /api/categories
router.post("/", subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = categorySchema.parse(req.body);
        const category = await index_1.prisma.category.create({
            data: { ...data, restaurantId: req.restaurantId },
        });
        res.status(201).json({ category });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando categoría" });
    }
});
// PUT /api/categories/:id
router.put("/:id", subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = categorySchema.partial().parse(req.body);
        const existing = await index_1.prisma.category.findUnique({ where: { id: req.params.id } });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Categoría no encontrada" });
            return;
        }
        const category = await index_1.prisma.category.update({ where: { id: req.params.id }, data });
        res.json({ category });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error actualizando categoría" });
    }
});
// DELETE /api/categories/:id
router.delete("/:id", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const existing = await index_1.prisma.category.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { menuItems: true, combos: true } } },
        });
        if (!existing || (req.restaurantId && existing.restaurantId !== req.restaurantId)) {
            res.status(404).json({ error: "Categoría no encontrada" });
            return;
        }
        if (existing._count.menuItems > 0 || existing._count.combos > 0) {
            res.status(400).json({ error: `No se puede eliminar: tiene ${existing._count.menuItems} productos y ${existing._count.combos} combos` });
            return;
        }
        await index_1.prisma.category.delete({ where: { id: req.params.id } });
        res.json({ message: "Categoría eliminada" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error eliminando categoría" });
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map