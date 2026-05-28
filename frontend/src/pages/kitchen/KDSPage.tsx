import { useCallback, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import * as api from "../../services/api";
import type { KDSOrder, OrderItem } from "../../types";
import {
  LogOut, ChefHat, RefreshCw, Volume2, VolumeX,
  Clock, Check, Flame, Loader2, Wifi, WifiOff,
} from "lucide-react";
import { useState, useEffect } from "react";

// Time color thresholds (minutes)
const TIME_GREEN = 3;
const TIME_YELLOW = 6;

function getTimeColor(minutes: number): string {
  if (minutes < TIME_GREEN) return "text-accent border-accent/30 bg-accent/5";
  if (minutes < TIME_YELLOW) return "text-warning border-warning/30 bg-warning/5";
  return "text-danger border-danger/30 bg-danger/5";
}

function getTimeBg(minutes: number): string {
  if (minutes < TIME_GREEN) return "bg-accent";
  if (minutes < TIME_YELLOW) return "bg-warning";
  return "bg-danger";
}

function minutesAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function formatTime(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function KDSPage() {
  const { user, logout } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const kitchenStation = user?.role === "COOK_1" ? "KITCHEN_1" : "KITCHEN_2";
  const kitchenLabel = user?.role === "COOK_1" ? "Cocina 1 — Acompañantes" : "Cocina 2 — Proteína";

  const { data, error, loading, refresh } = usePolling(
    () => api.kitchen.orders(kitchenStation, "PENDING,PREPARING"),
    { interval: 5000 }
  );

  const orders: KDSOrder[] = data?.orders || [];

  // Play sound on new orders
  useEffect(() => {
    const count = orders.length;
    if (count > prevCountRef.current && soundEnabled && prevCountRef.current > 0) {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgipGGfW5ydH+IjYV6cXR5gIaJiIJ5c3F2fYKGiYiFfHV0eH6DiIqIhHx1dHh+goaIiIR8dXR4foKGiIiEfHV1eH6DiIqIhHx1dHh+g4eJh4J6dXZ6f4OHiYiDe3V0eH6ChoiIhHx1dHh+g4eJh4J6dXZ6f4OHiYiDe3V0eX+ChoiIhHx1dHh+g4eJh4J6dXZ6f4OHiYiDe3V1eH6ChoiIhHx1dXl/g4eJh4J6dXZ6f4OHiYiDe3V1eH6ChoiIhHx1dXl/g4eJh4N7dXV5f4OGiIiEfHV1eX+DhoiIhHx1dXl/g4aIiIR8dXV5f4OGiIiEfHV1eX+DhoiIhHx1dXl/g4aIiA==");
        }
        audioRef.current.play().catch(() => {});
      } catch { /* ignore */ }
    }
    prevCountRef.current = count;
  }, [orders.length, soundEnabled]);

  // Update item status
  const handleUpdateStatus = useCallback(async (itemId: string, newStatus: "PREPARING" | "READY") => {
    setUpdatingItem(itemId);
    try {
      await api.kitchen.updateItemStatus(itemId, newStatus);
      await refresh();
    } catch { /* error handled by polling */ }
    setUpdatingItem(null);
  }, [refresh]);

  // Mark all items in an order
  const handleMarkAllReady = useCallback(async (items: OrderItem[]) => {
    const pending = items.filter((i) => i.status !== "READY");
    for (const item of pending) {
      await api.kitchen.updateItemStatus(item.id, "READY");
    }
    await refresh();
  }, [refresh]);

  // Separate into PENDING and PREPARING
  const newOrders = orders.filter((o) => o.items.some((i) => i.status === "PENDING"));
  const inProgress = orders.filter((o) => o.items.every((i) => i.status === "PREPARING"));

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-accent" />
          <h1 className="text-lg font-bold text-text">{kitchenLabel}</h1>
          {error ? (
            <WifiOff className="h-4 w-4 text-danger" />
          ) : (
            <Wifi className="h-4 w-4 text-accent" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
            {orders.length} orden{orders.length !== 1 ? "es" : ""}
          </span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="btn btn-ghost p-2">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-text-muted" />}
          </button>
          <button onClick={() => refresh()} className="btn btn-ghost p-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {/* Orders grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <ChefHat className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-xl">Sin órdenes pendientes</p>
            <p className="mt-1 text-sm">Las nuevas órdenes aparecerán aquí automáticamente</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((kdsOrder) => {
            const mins = minutesAgo(kdsOrder.order.createdAt);
            const colorClass = getTimeColor(mins);
            const allPreparing = kdsOrder.items.every((i) => i.status === "PREPARING");
            const hasNew = kdsOrder.items.some((i) => i.status === "PENDING");

            return (
              <div
                key={kdsOrder.order.id}
                className={`rounded-xl border-2 ${colorClass} ${hasNew ? "pulse-new" : ""} overflow-hidden`}
              >
                {/* Ticket header */}
                <div className={`flex items-center justify-between px-4 py-2 ${getTimeBg(mins)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">
                      #{kdsOrder.order.orderNumber}
                    </span>
                    {kdsOrder.order.table && (
                      <span className="rounded bg-white/20 px-2 py-0.5 text-sm font-medium text-white">
                        Mesa {kdsOrder.order.table.number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-white">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-bold">{formatTime(mins)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="p-3 space-y-2">
                  {kdsOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="kds-text font-medium text-text">
                          {item.quantity > 1 && <span className="mr-1 text-accent">{item.quantity}x</span>}
                          {item.menuItem?.name || item.combo?.name || "Ítem"}
                        </p>
                        {/* Modifiers */}
                        {item.modifiers && (item.modifiers as Array<{name: string}>).length > 0 && (
                          <p className="text-sm text-warning">
                            {(item.modifiers as Array<{name: string}>).map((m) => m.name).join(", ")}
                          </p>
                        )}
                        {/* Notes */}
                        {item.notes && (
                          <p className="text-sm font-medium text-danger">⚠ {item.notes}</p>
                        )}
                      </div>

                      {/* Status button */}
                      {item.status === "PENDING" ? (
                        <button
                          onClick={() => handleUpdateStatus(item.id, "PREPARING")}
                          disabled={updatingItem === item.id}
                          className="btn shrink-0 gap-1 bg-info px-3 py-2 text-sm text-white hover:opacity-90"
                        >
                          {updatingItem === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Flame className="h-4 w-4" />
                          )}
                          Preparar
                        </button>
                      ) : item.status === "PREPARING" ? (
                        <button
                          onClick={() => handleUpdateStatus(item.id, "READY")}
                          disabled={updatingItem === item.id}
                          className="btn shrink-0 gap-1 bg-accent px-3 py-2 text-sm text-white hover:opacity-90"
                        >
                          {updatingItem === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Listo ✓
                        </button>
                      ) : (
                        <span className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">✓ Listo</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bulk action */}
                {kdsOrder.items.length > 1 && !kdsOrder.items.every((i) => i.status === "READY") && (
                  <div className="border-t border-border/30 p-2">
                    <button
                      onClick={() => handleMarkAllReady(kdsOrder.items)}
                      className="btn btn-primary w-full gap-1 py-2 text-sm"
                    >
                      <Check className="h-4 w-4" />
                      Todo listo
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
