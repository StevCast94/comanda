import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import * as api from "../../services/api";
import type { DeliveryOrder, DeliveryStatus } from "../../types";
import {
  LogOut, Truck, RefreshCw, Wifi, WifiOff, MapPin, Phone,
  Package, Bike, CheckCircle2, Loader2, User,
} from "lucide-react";

function minutesAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  ASSIGNED: "Asignado",
  PICKED_UP: "Recogido",
  IN_TRANSIT: "En camino",
  DELIVERED: "Entregado",
};

const NEXT_ACTION_LABEL: Record<DeliveryStatus, string> = {
  ASSIGNED: "Marcar recogido",
  PICKED_UP: "Marcar en camino",
  IN_TRANSIT: "Marcar entregado",
  DELIVERED: "",
};

const STATUS_ICON: Record<DeliveryStatus, typeof Package> = {
  ASSIGNED: Package,
  PICKED_UP: Bike,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCircle2,
};

export default function DeliveryPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([]);
  const [assigning, setAssigning] = useState<Record<string, string>>({});

  const { data, error, loading, refresh } = usePolling(
    () => api.delivery.pending(),
    { interval: 6000 }
  );
  const deliveries: DeliveryOrder[] = data?.deliveries || [];

  useEffect(() => {
    if (!isAdmin) return;
    api.delivery.drivers().then((r) => setDrivers(r.drivers)).catch(() => {});
  }, [isAdmin]);

  const handleAdvance = useCallback(async (id: string) => {
    setUpdatingId(id);
    try { await api.delivery.advance(id); await refresh(); }
    catch { /* error surfaced via polling error banner on next fetch */ }
    setUpdatingId(null);
  }, [refresh]);

  const handleAssign = useCallback(async (id: string) => {
    const driverId = assigning[id];
    if (!driverId) return;
    setUpdatingId(id);
    try { await api.delivery.assign(id, driverId); await refresh(); }
    catch { /* ignore */ }
    setUpdatingId(null);
  }, [assigning, refresh]);

  const unassigned = deliveries.filter((d) => !d.driverId);
  const assigned = deliveries.filter((d) => d.driverId);

  function DeliveryCard({ d }: { d: DeliveryOrder }) {
    const Icon = STATUS_ICON[d.status];
    const mins = minutesAgo(d.order.createdAt);

    return (
      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-text">Orden #{d.order.orderNumber}</p>
            {d.order.customerName && (
              <p className="flex items-center gap-1 text-xs text-text-muted">
                <User className="h-3 w-3" />{d.order.customerName}
              </p>
            )}
          </div>
          <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            <Icon className="h-3.5 w-3.5" />{STATUS_LABEL[d.status]}
          </span>
        </div>

        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-start gap-2 text-text">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            {d.customerAddress}
          </p>
          <a href={`tel:${d.customerPhone}`} className="flex items-center gap-2 text-accent hover:underline">
            <Phone className="h-4 w-4 shrink-0" />{d.customerPhone}
          </a>
          {d.deliveryZone && (
            <p className="text-xs text-text-muted">Zona: {d.deliveryZone.name} (${d.deliveryZone.fee.toFixed(2)})</p>
          )}
        </div>

        <div className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
          {d.order.items.length} ítem{d.order.items.length !== 1 ? "s" : ""} · ${d.order.total.toFixed(2)} · hace {mins}m
        </div>

        {/* Driver assignment (ADMIN only, unassigned deliveries) */}
        {isAdmin && !d.driverId && (
          <div className="mt-3 flex gap-2">
            <select
              value={assigning[d.id] || ""}
              onChange={(e) => setAssigning((s) => ({ ...s, [d.id]: e.target.value }))}
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text outline-none"
            >
              <option value="">Seleccionar motorista...</option>
              {drivers.map((dr) => (
                <option key={dr.id} value={dr.id}>{dr.name}</option>
              ))}
            </select>
            <button
              onClick={() => handleAssign(d.id)}
              disabled={!assigning[d.id] || updatingId === d.id}
              className="btn btn-primary px-3 text-sm"
            >
              {updatingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar"}
            </button>
          </div>
        )}

        {/* Driver name (if assigned) */}
        {d.driver && (
          <p className="mt-2 text-xs text-text-muted">Motorista: <span className="text-text">{d.driver.name}</span></p>
        )}

        {/* Advance status — driver sees own, admin sees all assigned */}
        {d.driverId && (!isAdmin ? d.driverId === user?.id : true) && (
          <button
            onClick={() => handleAdvance(d.id)}
            disabled={updatingId === d.id}
            className="btn btn-primary mt-3 w-full gap-2"
          >
            {updatingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {NEXT_ACTION_LABEL[d.status]}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-4">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold text-text">{isAdmin ? "Delivery" : "Mis Entregas"}</h1>
          {error ? <WifiOff className="h-5 w-5 text-danger" /> : <Wifi className="h-5 w-5 text-accent" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-accent/10 px-4 py-1.5 text-base font-bold text-accent">
            {deliveries.length} entrega{deliveries.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => refresh()} className="btn btn-ghost p-2">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {deliveries.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <Truck className="mb-4 h-20 w-20 opacity-20" />
            <p className="text-2xl font-bold">Sin entregas pendientes</p>
            <p className="mt-2 text-base">Las nuevas entregas aparecerán aquí automáticamente</p>
          </div>
        )}

        {isAdmin && unassigned.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase text-text-muted">Sin asignar ({unassigned.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {unassigned.map((d) => <DeliveryCard key={d.id} d={d} />)}
            </div>
          </div>
        )}

        {assigned.length > 0 && (
          <div>
            {isAdmin && <h2 className="mb-2 text-sm font-bold uppercase text-text-muted">En curso ({assigned.length})</h2>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {assigned.map((d) => <DeliveryCard key={d.id} d={d} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
