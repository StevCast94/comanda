"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, tenant_1.tenantIsolation, (0, auth_1.authorize)("ADMIN"));
// Helper: date range
function dateRange(from, to) {
    const start = from ? new Date(from + "T00:00:00") : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const end = to ? new Date(to + "T23:59:59.999") : (() => { const d = new Date(start); d.setHours(23, 59, 59, 999); return d; })();
    return { gte: start, lte: end };
}
// GET /api/reports/summary?date=YYYY-MM-DD
router.get("/summary", async (req, res) => {
    try {
        const dateStr = req.query.date || new Date().toISOString().split("T")[0];
        const createdAt = dateRange(dateStr, dateStr);
        const rId = req.restaurantId;
        const orders = await index_1.prisma.order.findMany({
            where: { restaurantId: rId, createdAt, status: { not: "CANCELLED" } },
            select: { total: true, paymentMethod: true, orderType: true },
        });
        const cancelled = await index_1.prisma.order.count({
            where: { restaurantId: rId, createdAt, status: "CANCELLED" },
        });
        const totalSales = orders.reduce((s, o) => s + o.total, 0);
        const totalOrders = orders.length;
        const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
        const byPayment = { cash: 0, card: 0, transfer: 0 };
        const byType = { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 };
        for (const o of orders) {
            if (o.paymentMethod === "CASH")
                byPayment.cash += o.total;
            else if (o.paymentMethod === "CARD")
                byPayment.card += o.total;
            else if (o.paymentMethod === "TRANSFER")
                byPayment.transfer += o.total;
            byType[o.orderType] = (byType[o.orderType] || 0) + 1;
        }
        res.json({
            date: dateStr, totalSales: Math.round(totalSales * 100) / 100,
            totalOrders, avgTicket: Math.round(avgTicket * 100) / 100, cancelled,
            byPaymentMethod: byPayment, byOrderType: byType,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error generando reporte" });
    }
});
// GET /api/reports/hourly?date=YYYY-MM-DD
router.get("/hourly", async (req, res) => {
    try {
        const dateStr = req.query.date || new Date().toISOString().split("T")[0];
        const createdAt = dateRange(dateStr, dateStr);
        const rId = req.restaurantId;
        const orders = await index_1.prisma.order.findMany({
            where: { restaurantId: rId, createdAt, status: { not: "CANCELLED" } },
            select: { total: true, createdAt: true },
        });
        // Group by hour (0-23)
        const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, sales: 0, orders: 0 }));
        for (const o of orders) {
            const h = new Date(o.createdAt).getHours();
            hourly[h].sales += o.total;
            hourly[h].orders += 1;
        }
        // Only return hours with activity + padding
        const active = hourly.filter((h) => h.orders > 0);
        const minH = active.length > 0 ? Math.max(0, active[0].hour - 1) : 6;
        const maxH = active.length > 0 ? Math.min(23, active[active.length - 1].hour + 1) : 22;
        res.json({
            date: dateStr,
            hourly: hourly.slice(minH, maxH + 1).map((h) => ({
                ...h,
                label: `${h.hour.toString().padStart(2, "0")}:00`,
                sales: Math.round(h.sales * 100) / 100,
            })),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// GET /api/reports/top-products?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10
router.get("/top-products", async (req, res) => {
    try {
        const createdAt = dateRange(req.query.from, req.query.to);
        const limit = parseInt(req.query.limit || "10", 10);
        const rId = req.restaurantId;
        const items = await index_1.prisma.orderItem.groupBy({
            by: ["menuItemId"],
            where: {
                order: { restaurantId: rId, createdAt, status: { not: "CANCELLED" } },
                menuItemId: { not: null },
            },
            _sum: { quantity: true, totalPrice: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: limit,
        });
        // Fetch product names
        const productIds = items.map((i) => i.menuItemId).filter(Boolean);
        const products = await index_1.prisma.menuItem.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, basePrice: true, category: { select: { name: true } } },
        });
        const pMap = new Map(products.map((p) => [p.id, p]));
        const topProducts = items.map((i) => {
            const p = pMap.get(i.menuItemId);
            return {
                id: i.menuItemId,
                name: p?.name || "Desconocido",
                category: p?.category?.name || "",
                quantity: i._sum.quantity || 0,
                revenue: Math.round((i._sum.totalPrice || 0) * 100) / 100,
            };
        });
        res.json({ topProducts });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
// GET /api/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/sales", async (req, res) => {
    try {
        const fromStr = req.query.from || (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })();
        const toStr = req.query.to || new Date().toISOString().split("T")[0];
        const createdAt = dateRange(fromStr, toStr);
        const rId = req.restaurantId;
        const orders = await index_1.prisma.order.findMany({
            where: { restaurantId: rId, createdAt, status: { not: "CANCELLED" } },
            select: { total: true, createdAt: true },
        });
        // Group by date
        const dailyMap = new Map();
        // Init all dates in range
        const curr = new Date(fromStr);
        const end = new Date(toStr);
        while (curr <= end) {
            const key = curr.toISOString().split("T")[0];
            dailyMap.set(key, { date: key, sales: 0, orders: 0 });
            curr.setDate(curr.getDate() + 1);
        }
        for (const o of orders) {
            const key = new Date(o.createdAt).toISOString().split("T")[0];
            const day = dailyMap.get(key);
            if (day) {
                day.sales += o.total;
                day.orders += 1;
            }
        }
        const daily = Array.from(dailyMap.values()).map((d) => ({
            ...d, sales: Math.round(d.sales * 100) / 100,
        }));
        res.json({ from: fromStr, to: toStr, daily });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error" });
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map