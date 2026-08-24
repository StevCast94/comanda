"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const index_1 = require("../index");
/**
 * Registra una acción crítica del SUPERADMIN (creación/eliminación de
 * restaurantes, cambios de suscripción). No debe bloquear la operación
 * principal si falla — solo se registra el error.
 */
async function logAudit(entry) {
    try {
        await index_1.prisma.auditLog.create({
            data: {
                userId: entry.userId ?? null,
                userName: entry.userName ?? null,
                action: entry.action,
                targetType: entry.targetType,
                targetId: entry.targetId,
                details: entry.details,
            },
        });
    }
    catch (err) {
        console.error("No se pudo registrar audit log:", err);
    }
}
//# sourceMappingURL=audit.js.map