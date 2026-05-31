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

const TIME_GREEN = 3;
const TIME_YELLOW = 6;

function getTimeColor(minutes: number): string {
  if (minutes < 3) return "border-success/30 bg-success/5";
  if (minutes < 6) return "border-warning/30 bg-warning/5";
  return "border-danger/30 bg-danger/5";
}

function getTimeBg(minutes: number): string {
  if (minutes < 3) return "bg-success";
  if (minutes < 6) return "bg-warning";
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

  const { data, error, loading, refresh } = usePolling(
    () => api.kitchen.orders(undefined, "PENDING,PREPARING"),
    { interval: 5000 }
  );

  const orders: KDSOrder[] = data?.orders || [];

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

  const handleUpdateStatus = useCallback(async (itemId: string, newStatus: "PREPARING" | "READY") => {
    setUpdatingItem(itemId);
    try { await api.kitchen.updateItemStatus(itemId, newStatus); await refresh(); }
    catch { /* error handled by polling */ }
    setUpdatingItem(null);
  }, [refresh]);

  const handleMarkAllReady = useCallback(async (items: OrderItem[]) => {
    const pending = items.filter((i) => i.status !== "READY");
    for (const item of pending) await api.kitchen.updateItemStatus(item.id, "READY");
    await refresh();
  }, [refresh]);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold text-text">Cocina</h1>
          {error ? <WifiOff className="h-5 w-5 text-danger" /> : <Wifi className="h-5 w-5 text-accent" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-accent/10 px-4 py-1.5 text-base font-bold text-accent">
            {orders.length} orden{orders.length !== 1 ? "es" : ""}
          </span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="btn btn-ghost p-2">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-text-muted" />}
          </button>
          <button onClick={() => refresh()} className="btn btn-ghost p-2">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      {/* Orders grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <ChefHat className="mb-4 h-20 w-20 opacity-20" />
            <p className="text-2xl font-bold">Sin órdenes pendientes</p>
            <p className="mt-2 text-base">Las nuevas órdenes aparecerán aquí automáticamente</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((kdsOrder) => {
            const mins = minutesAgo(kdsOrder.order.createdAt);
            const colorClass = getTimeColor(mins);
            const hasNew = kdsOrder.items.some((i) => i.status === "PENDING");

            return (
              <div
                key={kdsOrder.order.id}
                className={`rounded-xl border-2 ${colorClass} ${hasNew ? "pulse-new" : ""} overflow-hidden`}
              >
                {/* Ticket header */}
                <div className={`flex items-center justify-between px-4 py-3 ${getTimeBg(mins)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">#{kdsOrder.order.orderNumber}</span>
                    {kdsOrder.order.table && (
                      <span className="rounded bg-white/20 px-3 py-1 text-sm font-bold text-white">
                        M{kdsOrder.order.table.number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-white">
                    <Clock className="h-5 w-5" />
                    <span className="text-base font-bold">{formatTime(mins)}</span>
                  </div>
                </div>

                {/* Items — BIG */}
                <div className="p-4 space-y-4">
                  {kdsOrder.items.map((item) => {
                    const hasSelections = item.comboSelections && Object.keys(item.comboSelections).length > 0;
                    return (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-2xl font-extrabold text-text leading-tight">
                          {item.quantity > 1 && <span className="mr-2 text-accent">{item.quantity}x</span>}
                          {item.menuItem?.name || item.combo?.name || hasSelections ? "Combo" : "Ítem"}
                        </p>
                        {/* Combo selections — BIG */}
                        {hasSelections && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(item.comboSelections).map(([group, name]) => (
                              <p key={group} className="flex items-baseline gap-2 text-lg">
                                <span className="font-extrabold text-accent">{group}:</span>
                                <span className="font-semibold text-text">{name as string}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        {/* Modifiers */}
                        {item.modifiers && (item.modifiers as Array<{name: string}>).length > 0 && (
                          <p className="text-base font-medium text-warning mt-1">
                            {(item.modifiers as Array<{name: string}>).map((m) => m.name).join(", ")}
                          </p>
                        )}
                        {/* Notes */}
                        {item.notes && (
                          <p className="text-lg font-extrabold text-danger mt-1">⚠ {item.notes}</p>
                        )}
                      </div>

                      {/* Status button — BIG */}
                      <div className="shrink-0">
                      {item.status === "PENDING" ? (
                        <button
                          onClick={() => handleUpdateStatus(item.id, "PREPARING")}
                          disabled={updatingItem === item.id}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-3.5 text-base font-extrabold text-white hover:opacity-90 min-w-[110px] justify-center"
                        >
                          {updatingItem === item.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flame className="h-5 w-5" />}
                          Preparar
                        </button>
                      ) : item.status === "PREPARING" ? (
                        <button
                          onClick={() => handleUpdateStatus(item.id, "READY")}
                          disabled={updatingItem === item.id}
                          className="flex items-center gap-1.5 rounded-xl bg-warning px-5 py-3.5 text-base font-extrabold text-white hover:opacity-90 min-w-[110px] justify-center"
                        >
                          {updatingItem === item.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                          Listo ✓
                        </button>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-xl bg-success/10 px-5 py-3.5 text-base font-extrabold text-success min-w-[110px]">✓ Listo</span>
                      )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Bulk action — BIG */}
                {kdsOrder.items.length > 1 && !kdsOrder.items.every((i) => i.status === "READY") && (
                  <div className="border-t border-border/30 p-3">
                    <button
                      onClick={() => handleMarkAllReady(kdsOrder.items)}
                      className="btn btn-primary w-full gap-2 py-3.5 text-lg font-extrabold"
                    >
                      <Check className="h-5 w-5" />
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
