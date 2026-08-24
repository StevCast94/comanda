import { Prisma } from "@prisma/client";
import { prisma } from "../index";

interface AuditEntry {
  userId?: string | null;
  userName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

/**
 * Registra una acción crítica del SUPERADMIN (creación/eliminación de
 * restaurantes, cambios de suscripción). No debe bloquear la operación
 * principal si falla — solo se registra el error.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        userName: entry.userName ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("No se pudo registrar audit log:", err);
  }
}
