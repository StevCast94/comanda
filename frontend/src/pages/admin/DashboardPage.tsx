import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import * as api from "../../services/api";
import type { DailySummary, Order, CashRegister } from "../../types";
import MenuPage from "./MenuPage";
import UsersPage from "./UsersPage";
import ReportsPage from "./ReportsPage";
import InventoryPage from "./InventoryPage";
import TablesPage from "./TablesPage";
import EditOrderModal from "../../components/EditOrderModal";
import {
  LogOut, LayoutDashboard, DollarSign, ShoppingCart,
  TrendingUp, Clock, CreditCard, Banknote, ArrowRightLeft,
  RefreshCw, ChefHat, HandPlatter, Users, Package,
  Settings, BarChart3, AlertCircle, CheckCircle, MapPin,
  XCircle, Trash2, Pencil, Eye, X, Search, History, Loader2, Filter,
} from "lucide-react";

interface AdminData {
  summary: DailySummary | null;
  activeOrders: Order[];
  cashRegisters: CashRegister[];
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Órdenes", icon: ShoppingCart },
  { id: "menu", label: "Menú", icon: Package },
  { id: "inventory", label: "Inventario", icon: Package },
  { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "tables", label: "Mesas", icon: MapPin },
  { id: "cash", label: "Caja", icon: History },
  { id: "settings", label: "Config.", icon: Settings },
];

// ─── Status helpers ────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  PENDING:    { label: "Pendiente", color: "text-info", bg: "bg-info/5", border: "border-info/30", icon: Clock },
  PAID:       { label: "Pagada",    color: "text-purple", bg: "bg-purple-500/5", border: "border-purple-500/30", icon: DollarSign },
  PREPARING:  { label: "Preparando", color: "text-warning", bg: "bg-warning/5", border: "border-warning/30", icon: ChefHat },
  READY:      { label: "Lista",     color: "text-success", bg: "bg-success/5", border: "border-success/30", icon: CheckCircle },
  DELIVERED:  { label: "Entregada", color: "text-neutral", bg: "bg-neutral/5", border: "border-neutral/30", icon: HandPlatter },
  CANCELLED:  { label: "Cancelada", color: "text-danger", bg: "bg-danger/5", border: "border-danger/30", icon: XCircle },
};

const ROLE_BADGES: Record<string, string> = {
  SUPERADMIN: "bg-purple-500/10 text-purple-400",
  ADMIN:      "bg-red-500/10 text-red-400",
  CASHIER:    "bg-blue-500/10 text-blue-400",
  COOK_1:     "bg-orange-500/10 text-orange-400",
  COOK_2:     "bg-orange-500/10 text-orange-400",
  WAITER:     "bg-green-500/10 text-green-400",
  DELIVERY:   "bg-indigo-500/10 text-indigo-400",
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState("dashboard");

  const { data, loading, refresh } = usePolling<AdminData>(
    async () => {
      const today = new Date().toISOString().split("T")[0];
      const [summaryRes, ordersRes, cashRes] = await Promise.all([
        api.reports.summary(today),
        api.orders.list({ status: "PENDING,PAID,PREPARING,READY,DELIVERED,CANCELLED", limit: 50 }),
        api.cashRegister.history(),
      ]);
      return {
        summary: summaryRes,
        activeOrders: ordersRes.orders,
        cashRegisters: cashRes.registers,
      };
    },
    { interval: 20000 }
  );

  const summary = data?.summary;
  const activeOrders = data?.activeOrders || [];
  const cashRegisters = data?.cashRegisters || [];

  // ─── Orders section state ─────────────────────────────────
  const [orderFilter, setOrderFilter] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    let orders = activeOrders;
    if (orderFilter !== "ALL") orders = orders.filter(o => o.status === orderFilter);
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      orders = orders.filter(o =>
        String(o.orderNumber).includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.table && String(o.table.number).includes(q))
      );
    }
    return orders;
  }, [activeOrders, orderFilter, orderSearch]);

  const handleCancel = useCallback(async (orderId: string) => {
    if (!confirm("¿Cancelar esta orden? Se marcará como CANCELLED.")) return;
    try {
      await api.orders.updateStatus(orderId, "CANCELLED", "Cancelada por administrador");
      refresh();
    } catch {}
  }, [refresh]);

  const handleDelete = useCallback(async (orderId: string) => {
    if (!confirm("¿Eliminar esta orden permanentemente? Esta acción no se puede deshacer.")) return;
    setDeletingId(orderId);
    try {
      await api.orders.delete(orderId);
      refresh();
    } catch {}
    setDeletingId(null);
  }, [refresh]);

  // Group active orders by status for dashboard
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, Order[]> = { PENDING: [], PAID: [], PREPARING: [], READY: [] };
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
          {/* ═══════════ DASHBOARD ═══════════ */}
          {section === "dashboard" && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KPICard icon={DollarSign} label="Ventas hoy" value={`$${summary?.totalSales.toFixed(2) || "0.00"}`} color="text-success" />
                <KPICard icon={ShoppingCart} label="Órdenes" value={String(summary?.totalOrders || 0)} sub={`${summary?.cancelled || 0} canceladas`} color="text-info" />
                <KPICard icon={TrendingUp} label="Ticket promedio" value={`$${summary?.avgTicket.toFixed(2) || "0.00"}`} color="text-warning" />
                <KPICard icon={DollarSign} label="Caja" value={cashRegisters.length > 0 ? `${cashRegisters.length} cierres` : "Sin datos"} color="text-purple" />
              </div>

              {/* Payment breakdown */}
              {summary && summary.totalOrders > 0 && (
                <div className="rounded-xl border border-border bg-surface-2 p-4">
                  <h3 className="mb-3 text-sm font-medium text-text-muted">Desglose por método de pago</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <PaymentCard icon={Banknote} label="Efectivo" amount={summary.byPaymentMethod.cash} color="text-success" />
                    <PaymentCard icon={CreditCard} label="Tarjeta" amount={summary.byPaymentMethod.card} color="text-info" />
                    <PaymentCard icon={ArrowRightLeft} label="Transfer." amount={summary.byPaymentMethod.transfer} color="text-purple" />
                  </div>
                </div>
              )}

              {/* Active orders by status */}
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text-muted">Órdenes activas</h3>
                  <span className="text-xs text-text-muted">{activeOrders.filter(o => o.status !== "CANCELLED" && o.status !== "DELIVERED").length} activas</span>
                </div>

                {activeOrders.filter(o => o.status !== "CANCELLED" && o.status !== "DELIVERED").length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Sin órdenes activas</p>
                ) : (
                  <div className="space-y-4">
                    {(["PENDING", "PAID", "PREPARING", "READY"] as const).map((status) => {
                      const group = ordersByStatus[status] || [];
                      if (group.length === 0) return null;
                      const cfg = STATUS_CONFIG[status];
                      return (
                        <div key={status}>
                          <div className="mb-1 flex items-center gap-1">
                            <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label} ({group.length})</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {group.map((o) => (
                              <div key={o.id} className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2`}>
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

          {/* ═══════════ ÓRDENES ═══════════ */}
          {section === "orders" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text" value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                    placeholder="Buscar #orden, cliente, mesa..."
                    className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-text outline-none focus:border-accent"
                  />
                </div>
                <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none">
                  <option value="ALL">Todos los estados</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button onClick={() => refresh()} className="btn btn-ghost p-2">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-text-muted">
                  <ShoppingCart className="mb-2 h-10 w-10 opacity-30" />
                  <p>Sin órdenes que coincidan</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 text-xs text-text-muted">
                      <tr>
                        <th className="px-3 py-2.5 text-left">#</th>
                        <th className="px-3 py-2.5 text-left">Mesa</th>
                        <th className="px-3 py-2.5 text-left">Tipo</th>
                        <th className="px-3 py-2.5 text-left">Items</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-left">Pago</th>
                        <th className="px-3 py-2.5 text-left">Estado</th>
                        <th className="px-3 py-2.5 text-left">Hora</th>
                        <th className="px-3 py-2.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.map(o => {
                        const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.PENDING;
                        return (
                          <tr key={o.id} className="hover:bg-surface-2/50">
                            <td className="px-3 py-2.5 font-bold text-text">#{o.orderNumber}</td>
                            <td className="px-3 py-2.5 text-text-muted">{o.table ? `M${o.table.number}` : "—"}</td>
                            <td className="px-3 py-2.5 text-text-muted text-xs">
                              {o.orderType === "DINE_IN" ? "Salón" : o.orderType === "TAKEAWAY" ? "Para llevar" : "Delivery"}
                            </td>
                            <td className="px-3 py-2.5 text-text-muted">
                              <span title={o.items.map(i => i.menuItem?.name || (i as any).combo?.name).join(", ")}>
                                {o.items.length} ítem{o.items.length > 1 ? "s" : ""}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-text">${o.total.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-text-muted text-xs">
                              {o.paymentMethod === "CASH" ? "💰 Efectivo" : o.paymentMethod === "CARD" ? "💳 Tarjeta" : o.paymentMethod === "TRANSFER" ? "🏦 Transf." : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                <cfg.icon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-text-muted">
                              {new Date(o.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex justify-end gap-1">
                                {(o.status === "PENDING" || o.status === "PAID") && (
                                  <>
                                    <button onClick={() => setEditingOrder(o)} className="btn btn-ghost p-1.5 text-info" title="Editar">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleCancel(o.id)} className="btn btn-ghost p-1.5 text-warning" title="Cancelar">
                                      <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleDelete(o.id)} disabled={deletingId === o.id}
                                  className="btn btn-ghost p-1.5 text-danger" title="Eliminar">
                                  {deletingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ CAJA (Historial) ═══════════ */}
          {section === "cash" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text">Historial de Caja</h2>
                <button onClick={() => refresh()} className="btn btn-ghost p-2">
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {cashRegisters.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-border bg-surface-2 text-text-muted">
                  <History className="mb-2 h-10 w-10 opacity-30" />
                  <p>Sin cierres de caja registrados</p>
                  <p className="text-xs mt-1">Los cierres aparecerán aquí cuando caja cierre el turno</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {cashRegisters.map(reg => {
                    const disc = reg.notes?.includes("⚠️");
                    return (
                      <div key={reg.id} className={`rounded-xl border ${disc ? "border-warning/30 bg-warning/5" : "border-border bg-surface-2"} p-4`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text">
                                {new Date(reg.openedAt).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
                              </span>
                              {disc && <AlertCircle className="h-4 w-4 text-warning" />}
                            </div>
                            <p className="text-xs text-text-muted">
                              Cajero: {reg.cashier?.name || "—"} · {new Date(reg.openedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })} – {reg.closedAt ? new Date(reg.closedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${disc ? "bg-warning/20 text-warning" : "bg-success/10 text-success"}`}>
                            {disc ? "⚠️ Discrepancia" : "✅ Cuadrado"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div><span className="text-text-muted">Apertura:</span> <span className="font-medium text-text">${reg.openingBalance.toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Ventas totales:</span> <span className="font-medium text-success">${reg.totalSales.toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Efectivo:</span> <span className="font-medium text-text">${reg.totalCash.toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Tarjeta:</span> <span className="font-medium text-text">${reg.totalCard.toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Transferencia:</span> <span className="font-medium text-text">${reg.totalTransfer.toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Esperado:</span> <span className="font-medium text-text">${(reg.expectedBalance || 0).toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Cierre:</span> <span className="font-medium text-text">${(reg.closingBalance || 0).toFixed(2)}</span></div>
                          <div><span className="text-text-muted">Gastos:</span> <span className="font-medium text-danger">${(reg.totalExpenses || 0).toFixed(2)}</span></div>
                        </div>

                        {reg.notes && (
                          <p className="mt-2 text-xs text-text-muted border-t border-border pt-2">{reg.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {section === "menu" && <MenuPage />}
          {section === "users" && <UsersPage />}
          {section === "reports" && <ReportsPage />}
          {section === "inventory" && <InventoryPage />}
          {section === "tables" && <TablesPage />}
          {section === "settings" && <ConfigPanel />}
        </main>
      </div>

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          products={[]}
          onClose={() => setEditingOrder(null)}
          onSaved={() => { setEditingOrder(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string;
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

function PaymentCard({ icon: Icon, label, amount, color }: {
  icon: any; label: string; amount: number; color: string;
}) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-center">
      <Icon className={`mx-auto mb-1 h-5 w-5 ${color}`} />
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-sm font-bold ${color}`}>${amount.toFixed(2)}</p>
    </div>
  );
}



// -----------------------------------------------------------
// Config Panel
// -----------------------------------------------------------

function ConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState({
    name: "", address: "", phone: "", timezone: "America/Guayaquil", currency: "USD",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.settings.restaurant();
        const r = (res as any).restaurant || res;
        setInfo({
          name: r.name || "",
          address: r.address || "",
          phone: r.phone || "",
          timezone: r.timezone || "America/Guayaquil",
          currency: r.currency || "USD",
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true); setMsg("");
    try {
      await api.settings.updateInfo(info);
      setMsg("? Configuraci�n guardada");
    } catch (e: any) {
      setMsg("? Error: " + (e.message || "desconocido"));
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-text">
          <Settings className="h-5 w-5 text-accent" /> Datos del Restaurante
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Nombre</label>
            <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
              value={info.name} onChange={e => setInfo({...info, name: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Direcci�n</label>
            <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
              value={info.address} onChange={e => setInfo({...info, address: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Tel�fono</label>
            <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
              value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Zona horaria</label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                value={info.timezone} onChange={e => setInfo({...info, timezone: e.target.value})}>
                {["America/Guayaquil","America/Bogota","America/Lima","America/Mexico_City","America/Santiago","America/Buenos_Aires","America/Caracas"].map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Moneda</label>
              <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                value={info.currency} onChange={e => setInfo({...info, currency: e.target.value})}>
                {["USD","COP","PEN","MXN","CLP","ARS"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.startsWith("?") ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{msg}</div>}

        <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full mt-4 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar Cambios
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
          <DollarSign className="h-4 w-4 text-warning" /> Impuestos y Servicio
        </h3>
        <p className="text-xs text-text-muted">Configurable pr�ximamente � actualmente IVA 15%, Servicio 10%.</p>
      </div>
    </div>
  );
}