import { useState, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import * as api from "../../services/api";
import type { Order } from "../../types";
import {
  LogOut, HandPlatter, RefreshCw, CheckCircle, Clock,
  MapPin, Loader2, Wifi, WifiOff, Volume2, VolumeX,
} from "lucide-react";
import { useEffect, useRef } from "react";

function minutesAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export default function WaiterPage() {
  const { user, logout } = useAuth();
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [justDelivered, setJustDelivered] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCountRef = useRef(0);

  const { data, error, loading, refresh } = usePolling(
    () => api.waiter.pending(),
    { interval: 5000 }
  );

  const orders: Order[] = data?.orders || [];

  // Sound notification on new ready orders
  useEffect(() => {
    if (orders.length > prevCountRef.current && soundEnabled && prevCountRef.current > 0) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* ignore */ }
    }
    prevCountRef.current = orders.length;
  }, [orders.length, soundEnabled]);

  const handleDeliver = useCallback(async (orderId: string, orderNumber: number) => {
    setDeliveringId(orderId);
    try {
      await api.waiter.deliver(orderId);
      setJustDelivered(orderNumber);
      setTimeout(() => setJustDelivered(null), 2500);
      await refresh();
    } catch { /* error */ }
    setDeliveringId(null);
  }, [refresh]);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <HandPlatter className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold text-text">Mesero</h1>
          {error ? <WifiOff className="h-4 w-4 text-danger" /> : <Wifi className="h-4 w-4 text-accent" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
            {orders.length} lista{orders.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="btn btn-ghost p-2">
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-text-muted" />}
          </button>
          <button onClick={() => refresh()} className="btn btn-ghost p-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-sm text-text-muted">{user?.name}</span>
          <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {/* Success toast */}
      {justDelivered && (
        <div className="flex items-center justify-center gap-2 bg-accent/10 py-2 text-sm text-accent">
          <CheckCircle className="h-4 w-4" />
          Orden #{justDelivered} entregada
        </div>
      )}

      {/* Orders */}
      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <HandPlatter className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-xl">Sin órdenes listas</p>
            <p className="mt-1 text-sm">Aparecerán aquí cuando cocina termine</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const mins = minutesAgo((order as any).updatedAt || order.createdAt);

            return (
              <div key={order.id} className="rounded-xl border border-accent/30 bg-surface-2 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between bg-accent/10 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-accent">#{order.orderNumber}</span>
                    {order.table && (
                      <span className="flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-sm text-text">
                        <MapPin className="h-3 w-3" />
                        {order.table.floor} — Mesa {order.table.number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {mins < 1 ? "ahora" : `hace ${mins}m`}
                  </div>
                </div>

                {/* Items */}
                <div className="p-4 space-y-1">
                  {order.customerName && (
                    <p className="mb-2 text-sm text-text-muted">Cliente: {order.customerName}</p>
                  )}
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span className="font-medium text-accent">{item.quantity}x</span>
                      <div>
                        <span className="text-text">{item.menuItem?.name || item.combo?.name}</span>
                        {item.notes && <p className="text-xs text-warning">📝 {item.notes}</p>}
                        {item.modifiers && (item.modifiers as Array<{name: string}>).length > 0 && (
                          <p className="text-xs text-text-muted">
                            {(item.modifiers as Array<{name: string}>).map((m) => m.name).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Deliver button */}
                <div className="border-t border-border p-3">
                  <button
                    onClick={() => handleDeliver(order.id, order.orderNumber)}
                    disabled={deliveringId === order.id}
                    className="btn btn-primary w-full gap-2 py-3 text-base"
                  >
                    {deliveringId === order.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                    Entregar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
