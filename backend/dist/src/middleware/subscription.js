"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSubscription = checkSubscription;
exports.checkLimit = checkLimit;
const index_1 = require("../index");
/**
 * Subscription validation middleware.
 * Checks that the restaurant's subscription is active and within limits.
 * Runs AFTER tenant isolation (req.restaurantId is set).
 */
function checkSubscription(req, res, next) {
    // SUPERADMIN bypasses subscription checks
    if (req.user?.role === "SUPERADMIN") {
        next();
        return;
    }
    if (!req.restaurantId) {
        res.status(403).json({ error: "Restaurante no identificado" });
        return;
    }
    index_1.prisma.subscription.findUnique({
        where: { restaurantId: req.restaurantId },
    }).then((sub) => {
        if (!sub) {
            res.status(403).json({ error: "Sin suscripción activa. Contacta al administrador." });
            return;
        }
        // Check subscription status
        if (sub.status === "CANCELED" || sub.status === "EXPIRED") {
            res.status(403).json({
                error: "Tu suscripción ha expirado. Renueva tu plan para continuar.",
                code: "SUBSCRIPTION_EXPIRED",
            });
            return;
        }
        // Check trial expiration
        if (sub.status === "TRIAL" && sub.trialEndsAt && new Date() > sub.trialEndsAt) {
            res.status(403).json({
                error: "Tu período de prueba ha terminado. Elige un plan para continuar.",
                code: "TRIAL_EXPIRED",
            });
            return;
        }
        // Attach subscription to request for limit checks in controllers
        req.subscription = sub;
        next();
    }).catch((err) => {
        console.error("Subscription check failed:", err);
        res.status(500).json({ error: "Error verificando suscripción" });
    });
}
/** Helper: check if a specific limit is exceeded */
async function checkLimit(restaurantId, limitType) {
    const sub = await index_1.prisma.subscription.findUnique({
        where: { restaurantId },
    });
    if (!sub)
        return { allowed: false, current: 0, max: 0 };
    let current = 0;
    let max = 0;
    switch (limitType) {
        case "users":
            current = await index_1.prisma.user.count({ where: { restaurantId, active: true } });
            max = sub.maxUsers;
            break;
        case "products":
            current = await index_1.prisma.menuItem.count({ where: { restaurantId, active: true } });
            max = sub.maxProducts;
            break;
        case "combos":
            current = await index_1.prisma.combo.count({ where: { restaurantId, active: true } });
            max = sub.maxCombos;
            break;
    }
    return { allowed: current < max, current, max };
}
//# sourceMappingURL=subscription.js.map