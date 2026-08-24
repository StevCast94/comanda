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
export declare function logAudit(entry: AuditEntry): Promise<void>;
export {};
//# sourceMappingURL=audit.d.ts.map