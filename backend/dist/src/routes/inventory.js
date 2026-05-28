"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, tenant_1.tenantIsolation, subscription_1.checkSubscription, (0, auth_1.authorize)("ADMIN"));
const inventorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: zod_1.z.string().max(50).optional().nullable(),
    unit: zod_1.z.string().max(20).default("unidad"),
    currentStock: zod_1.z.number().nonnegative().default(0),
    minStock: zod_1.z.number().nonnegative().default(0),
    costPerUnit: zod_1.z.number().nonnegative().default(0),
    supplierId: zod_1.z.string().optional().nullable(),
});
const supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    contact: zod_1.z.string().max(100).optional().nullable(),
    phone: zod_1.z.string().max(30).optional().nullable(),
    email: zod_1.z.string().email().optional().nullable(),
});
// ─── Inventory Items ────────────────────────────────────────
// GET /api/inventory
router.get("/", async (req, res) => {
    try {
        const { lowStock, category, search } = req.query;
        const where = { restaurantId: req.restaurantId };
        if (category)
            where.category = category;
        if (search)
            where.name = { contains: search, mode: "insensitive" };
        let items = await index_1.prisma.inventory.findMany({
            where,
            include: { supplier: { select: { id: true, name: true } } },
            orderBy: { name: "asc" },
        });
        if (lowStock === "true") {
            items = items.filter((i) => i.currentStock <= i.minStock);
        }
        const lowStockCount = items.filter((i) => i.currentStock <= i.minStock).length;
        res.json({ items, lowStockCount });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando inventario" });
    }
});
// POST /api/inventory
router.post("/", async (req, res) => {
    try {
        const data = inventorySchema.parse(req.body);
        const item = await index_1.prisma.inventory.create({
            data: { ...data, restaurantId: req.restaurantId },
            include: { supplier: { select: { id: true, name: true } } },
        });
        res.status(201).json({ item });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando insumo" });
    }
});
// PUT /api/inventory/:id
router.put("/:id", async (req, res) => {
    try {
        const data = inventorySchema.partial().parse(req.body);
        const existing = await index_1.prisma.inventory.findUnique({ where: { id: req.params.id } });
        if (!existing || existing.restaurantId !== req.restaurantId) {
            res.status(404).json({ error: "Insumo no encontrado" });
            return;
        }
        const item = await index_1.prisma.inventory.update({
            where: { id: req.params.id },
            data,
            include: { supplier: { select: { id: true, name: true } } },
        });
        res.json({ item });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error actualizando insumo" });
    }
});
// POST /api/inventory/:id/restock
router.post("/:id/restock", async (req, res) => {
    try {
        const { quantity, costPerUnit } = zod_1.z.object({
            quantity: zod_1.z.number().positive("Cantidad debe ser mayor a 0"),
            costPerUnit: zod_1.z.number().nonnegative().optional(),
        }).parse(req.body);
        const existing = await index_1.prisma.inventory.findUnique({ where: { id: req.params.id } });
        if (!existing || existing.restaurantId !== req.restaurantId) {
            res.status(404).json({ error: "Insumo no encontrado" });
            return;
        }
        const updateData = {
            currentStock: { increment: quantity },
            lastRestockDate: new Date(),
        };
        if (costPerUnit !== undefined)
            updateData.costPerUnit = costPerUnit;
        const item = await index_1.prisma.inventory.update({
            where: { id: req.params.id },
            data: updateData,
            include: { supplier: { select: { id: true, name: true } } },
        });
        res.json({ item });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error reabasteciendo" });
    }
});
// DELETE /api/inventory/:id
router.delete("/:id", async (req, res) => {
    try {
        const existing = await index_1.prisma.inventory.findUnique({ where: { id: req.params.id } });
        if (!existing || existing.restaurantId !== req.restaurantId) {
            res.status(404).json({ error: "Insumo no encontrado" });
            return;
        }
        await index_1.prisma.inventory.delete({ where: { id: req.params.id } });
        res.json({ message: "Insumo eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// ─── Suppliers ──────────────────────────────────────────────
// GET /api/inventory/suppliers
router.get("/suppliers", async (req, res) => {
    try {
        const suppliers = await index_1.prisma.supplier.findMany({
            where: { restaurantId: req.restaurantId },
            include: { _count: { select: { inventory: true } } },
            orderBy: { name: "asc" },
        });
        res.json({ suppliers });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// POST /api/inventory/suppliers
router.post("/suppliers", async (req, res) => {
    try {
        const data = supplierSchema.parse(req.body);
        const supplier = await index_1.prisma.supplier.create({
            data: { ...data, restaurantId: req.restaurantId },
        });
        res.status(201).json({ supplier });
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
// DELETE /api/inventory/suppliers/:id
router.delete("/suppliers/:id", async (req, res) => {
    try {
        await index_1.prisma.supplier.delete({ where: { id: req.params.id } });
        res.json({ message: "Proveedor eliminado" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error. Puede tener insumos asociados." });
    }
});
exports.default = router;
//# sourceMappingURL=inventory.js.map