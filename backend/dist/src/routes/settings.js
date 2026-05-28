"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const subscription_1 = require("../middleware/subscription");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, tenant_1.tenantIsolation, subscription_1.checkSubscription);
// GET /api/restaurant/settings
router.get("/settings", async (req, res) => {
    const restaurantId = req.restaurantId;
    try {
        const restaurant = await index_1.prisma.restaurant.findUnique({
            where: { id: restaurantId },
            select: { settings: true, name: true, slug: true, address: true, phone: true, timezone: true, currency: true, logo: true },
        });
        if (!restaurant)
            return res.status(404).json({ error: "Restaurante no encontrado" });
        res.json(restaurant);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/restaurant/settings
router.put("/settings", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    const restaurantId = req.restaurantId;
    try {
        const updated = await index_1.prisma.restaurant.update({
            where: { id: restaurantId },
            data: { settings: req.body.settings ?? req.body },
        });
        res.json(updated);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/restaurant/tables
router.get("/tables", async (req, res) => {
    const restaurantId = req.restaurantId;
    try {
        const tables = await index_1.prisma.table.findMany({
            where: { restaurantId, active: true },
            orderBy: [{ floor: "asc" }, { number: "asc" }],
        });
        res.json({ data: tables });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/restaurant/tables
router.post("/tables", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    const restaurantId = req.restaurantId;
    const { number, floor, capacity } = req.body;
    try {
        const table = await index_1.prisma.table.create({
            data: { restaurantId, number: parseInt(number), floor: floor || "Piso 1", capacity: parseInt(capacity) || 4 },
        });
        res.status(201).json(table);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// DELETE /api/restaurant/tables/:id
router.delete("/tables/:id", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    const restaurantId = req.restaurantId;
    try {
        await index_1.prisma.table.deleteMany({ where: { id: req.params.id, restaurantId } });
        res.json({ deleted: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map