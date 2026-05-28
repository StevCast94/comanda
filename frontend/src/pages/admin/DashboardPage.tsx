import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import { navigate } from "../../App";
import * as api from "../../services/api";
import type { DailySummary, Order, CashRegister } from "../../types";
import MenuPage from "./MenuPage";
import UsersPage from "./UsersPage";
import ReportsPage from "./ReportsPage";
import InventoryPage from "./InventoryPage";
import TablesPage from "./TablesPage";
import {
  LogOut, LayoutDashboard, DollarSign, ShoppingCart,
  TrendingUp, Clock, CreditCard, Banknote, ArrowRightLeft,
  RefreshCw, ChefHat, HandPlatter, Users, Package,
  Settings, BarChart3, AlertCircle, CheckCircle, MapPin,
} from "lucide-react";

interface AdminData {
  summary: DailySummary | null;
  activeOrders: Order[];
  cashRegister: CashRegister | null;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Órdenes", icon: ShoppingCart },
  { id: "menu", label: "Menú", icon: Package },
  { id: "inventory", label: "Inventario", icon: Package },
  { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "tables", label: "Mesas", icon: MapPin },
  { id: "settings", label: "Config.", icon: Settings },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState("dashboard");

  const { data, loading, refresh } = usePolling<AdminData>(
    async () => {
      const today = new Date().toISOString().split("T")[0];
      const [summaryRes, ordersRes, crRes] = await Promise.all([
        api.reports.summary(today),
        api.orders.list({ status: "PAID,PREPARING,READY", limit: 20 }),
        api.cashRegister.current(),
      ]);
      return {
        summary: summaryRes,
        activeOrders: ordersRes.orders,
        cashRegister: crRes.register,
      };
    },
    { interval: 15000 }
  );

  const summary = data?.summary;
  const activeOrders = data?.activeOrders || [];
  const cashReg = data?.cashRegister;

  // Group active orders by status
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, Order[]> = { PAID: [], PREPARING: [], READY: [] };
    for (const o of activeOrders) {
      if (groups[o.status]) groups[o.status].push(o);
    }
    return groups;
  }, [activeOrders]);

  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-col border-r border-border bg-surface-2 lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <LayoutDashboard className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-sm font-bold text-text">Admin</h1>
            <p className="text-xs text-text-muted">{user?.restaurant?.name}</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                section === item.id
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-muted hover:bg-surface-3 hover:text-text"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{user?.name}</span>
            <button onClick={logout} className="btn btn-ghost p-1.5"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-accent" />
            <span className="text-sm font-bold text-text">{user?.restaurant?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refresh()} className="btn btn-ghost p-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>

        {/* Mobile nav */}
        <div className="flex overflow-x-auto border-b border-border bg-surface-2 px-2 lg:hidden scrollbar-none">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex shrink-0 items-center gap-1 px-3 py-2 text-xs ${
                section === item.id ? "border-b-2 border-accent text-accent" : "text-text-muted"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {section === "dashboard" && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KPICard
                  icon={DollarSign}
                  label="Ventas hoy"
                  value={`$${summary?.totalSales.toFixed(2) || "0.00"}`}
                  color="text-accent"
                />
                <KPICard
                  icon={ShoppingCart}
                  label="Órdenes"
                  value={String(summary?.totalOrders || 0)}
                  sub={`${summary?.cancelled || 0} canceladas`}
                  color="text-info"
                />
                <KPICard
                  icon={TrendingUp}
                  label="Ticket promedio"
                  value={`$${summary?.avgTicket.toFixed(2) || "0.00"}`}
                  color="text-warning"
                />
                <KPICard
                  icon={DollarSign}
                  label="Caja"
                  value={cashReg ? "Abierta" : "Cerrada"}
                  sub={cashReg ? `$${cashReg.totalSales.toFixed(2)} vendido` : undefined}
                  color={cashReg ? "text-accent" : "text-danger"}
                />
              </div>

              {/* Payment breakdown */}
              {summary && (
                <div className="rounded-xl border border-border bg-surface-2 p-4">
                  <h3 className="mb-3 text-sm font-medium text-text-muted">Desglose por método de pago</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <PaymentCard icon={Banknote} label="Efectivo" amount={summary.byPaymentMethod.cash} />
                    <PaymentCard icon={CreditCard} label="Tarjeta" amount={summary.byPaymentMethod.card} />
                    <PaymentCard icon={ArrowRightLeft} label="Transfer." amount={summary.byPaymentMethod.transfer} />
                  </div>
                </div>
              )}

              {/* Active orders */}
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text-muted">Órdenes activas</h3>
                  <span className="text-xs text-text-muted">{activeOrders.length} activas</span>
                </div>

                {activeOrders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Sin órdenes activas</p>
                ) : (
                  <div className="space-y-4">
                    {/* By status */}
                    {(["PAID", "PREPARING", "READY"] as const).map((status) => {
                      const group = ordersByStatus[status] || [];
                      if (group.length === 0) return null;
                      const config = {
                        PAID: { label: "Pagadas (esperando cocina)", icon: Clock, color: "text-info" },
                        PREPARING: { label: "En preparación", icon: ChefHat, color: "text-warning" },
                        READY: { label: "Listas para entregar", icon: HandPlatter, color: "text-accent" },
                      }[status];

                      return (
                        <div key={status}>
                          <div className="mb-1 flex items-center gap-1">
                            <config.icon className={`h-3.5 w-3.5 ${config.color}`} />
                            <span className={`text-xs font-medium ${config.color}`}>{config.label} ({group.length})</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {group.map((o) => (
                              <div key={o.id} className="rounded-lg bg-surface px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-text">#{o.orderNumber}</span>
                                  {o.table && <span className="text-xs text-text-muted">M{o.table.number}</span>}
                                </div>
                                <p className="text-xs text-text-muted">
                                  {o.items.length} ítem{o.items.length > 1 ? "s" : ""} · ${o.total.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === "menu" && <MenuPage />}
          {section === "users" && <UsersPage />}
          {section === "reports" && <ReportsPage />}
          {section === "inventory" && <InventoryPage />}
          {section === "tables" && <TablesPage />}
          {section === "orders" && (
            <div className="flex h-64 items-center justify-center">
              <p className="text-text-muted">Historial de órdenes — próximamente</p>
            </div>
          )}
          {section === "settings" && (
            <div className="flex h-64 items-center justify-center">
              <p className="text-text-muted">Configuración del restaurante — próximamente</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: typeof DollarSign; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function PaymentCard({ icon: Icon, label, amount }: {
  icon: typeof Banknote; label: string; amount: number;
}) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-center">
      <Icon className="mx-auto mb-1 h-5 w-5 text-text-muted" />
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-bold text-text">${amount.toFixed(2)}</p>
    </div>
  );
}
