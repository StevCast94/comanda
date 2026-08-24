import { useState, useEffect } from "react";
import * as api from "../services/api";
import type { AuditLogEntry } from "../types";
import { ScrollText, Loader2, Store, CreditCard } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  "restaurant.create": "Restaurante creado",
  "restaurant.delete": "Restaurante eliminado",
  "restaurant.suspend": "Restaurante suspendido",
  "restaurant.reactivate": "Restaurante reactivado",
  "subscription.plan_change": "Cambio de plan",
};

const ACTION_ICON: Record<string, typeof Store> = {
  "restaurant.create": Store,
  "restaurant.delete": Store,
  "restaurant.suspend": Store,
  "restaurant.reactivate": Store,
  "subscription.plan_change": CreditCard,
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
}

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auditLog.list(100)
      .then((r) => setLogs(r.logs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-text-muted">
        {logs.length} acci{logs.length !== 1 ? "ones" : "ón"} crítica{logs.length !== 1 ? "s" : ""} registrada{logs.length !== 1 ? "s" : ""}
      </h3>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <ScrollText className="mb-3 h-14 w-14 opacity-20" />
          <p className="text-lg font-medium">Sin actividad registrada</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface-2">
          {logs.map((log) => {
            const Icon = ACTION_ICON[log.action] || ScrollText;
            return (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{ACTION_LABEL[log.action] || log.action}</p>
                  {log.details && (
                    <p className="truncate text-xs text-text-muted">
                      {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-text-muted">
                    {log.userName || "Sistema"} · {formatDate(log.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
