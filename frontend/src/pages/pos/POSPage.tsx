import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePOS } from "../../hooks/usePOS";
import ProductCard from "../../components/ProductCard";
import OrderPanel from "../../components/OrderPanel";
import ComboModal from "../../components/ComboModal";
import CashRegisterModal from "../../components/CashRegisterModal";
import EditOrderModal from "../../components/EditOrderModal";
import * as api from "../../services/api";
import {
  LogOut, Search, X, ShoppingCart, Loader2, Eye, EyeOff, Pencil,
  DollarSign, AlertCircle, Banknote, CreditCard, ArrowRightLeft,
  Clock, MapPin, User, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle, Flame, ChefHat, HandPlatter, Minus, Plus, Trash2,
} from "lucide-react";
import type { Combo, Order, MenuItem, CartItem } from "../../types";

export default function POSPage() {
  const { user, logout } = useAuth();
  const pos = usePOS();
  const [showCashModal, setShowCashModal] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"menu" | "order">("menu");

  // Pending orders from waiters
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Live tracking: all non-cancelled orders today
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [showLive, setShowLive] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const { orders } = await api.orders.list({ status: "PENDING" });
      setPendingOrders(orders || []);
    } catch { /* ignore */ }
  }, []);

  const fetchLive = useCallback(async () => {
    try {
      const { orders } = await api.orders.live();
      setLiveOrders(orders || []);
    } catch {}
  }, []);

  useEffect(() => { fetchPending(); fetchLive(); const t = setInterval(() => { fetchPending(); fetchLive(); }, 8000); return () => clearInterval(t); }, [fetchPending, fetchLive]);

  const confirmPayment = async (orderId: string, method: string) => {
    setPayingOrderId(orderId);
    try {
      await api.orders.confirmPayment(orderId, method);
      setPendingOrders(p => p.filter(o => o.id !== orderId));
    } catch (e: any) {
      pos.set("error", e.message || "Error al confirmar pago");
    }
    setPayingOrderId(null);
  };

  // Edit/Cancel pending orders
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const cancelOrder = async (orderId: string) => {
    try {
      await api.orders.updateStatus(orderId, "CANCELLED", "Cancelado desde caja");
      setPendingOrders(p => p.filter(o => o.id !== orderId));
    } catch (e: any) {
      pos.set("error", e.message || "Error");
    }
  };

  if (pos.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // ─── No cash register open ────────────────────────────────
  if (!pos.cashRegister) {
    return (
      <div className="flex h-screen flex-col bg-surface">
        <POSHeader user={user} logout={logout} register={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <DollarSign className="h-16 w-16 text-warning" />
          <h2 className="text-xl font-bold text-text">Caja cerrada</h2>
          <p className="text-text-muted">Necesitas abrir la caja para empezar a cobrar.</p>
          <button onClick={() => setShowCashModal(true)} className="btn btn-primary text-base">
            Abrir caja
          </button>
        </div>
        {showCashModal && (
          <CashRegisterModal
            mode="open"
            onSubmit={async (balance) => { await pos.openCashRegister(balance); setShowCashModal(false); }}
            onClose={() => setShowCashModal(false)}
          />
        )}
      </div>
    );
  }

  const cartCount = pos.cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="flex h-screen flex-col bg-surface">
      <POSHeader
        user={user}
        logout={logout}
        register={pos.cashRegister}
        onCloseCash={() => setShowCashModal(true)}
      />

      {/* Error banner */}
      {pos.error && (
        <div className="flex items-center gap-2 bg-danger/10 px-4 py-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{pos.error}</span>
          <button onClick={() => pos.set("error", null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Live Tracking toggle — visible siempre */}
      <button
        onClick={() => setShowLive(!showLive)}
        className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors ${showLive ? "bg-accent/10 text-accent border-b border-accent/20" : "bg-surface-2 text-text-muted hover:text-text border-b border-border"}`}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${showLive ? "text-accent" : ""}`} />
        {showLive ? "Ocultar tracking en vivo" : "Ver tracking en vivo"}
        {liveOrders.length > 0 && (
          <span className="ml-1 rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">{liveOrders.length} activas</span>
        )}
      </button>

      {/* Live Tracking panel */}
      {showLive && (
        <div className="border-b border-accent/20 bg-surface-2">
          <div className="grid grid-cols-5 gap-1 px-4 py-3 text-xs">
            <div className="rounded-lg bg-yellow-500/10 p-2 text-center border border-yellow-500/20">
              <Clock className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
              <p className="font-bold text-yellow-400">{liveOrders.filter(o => o.status === "PENDING").length}</p>
              <p className="text-yellow-500/70">Pendiente pago</p>
            </div>
            <div className="rounded-lg bg-info/10 p-2 text-center border border-info/20">
              <ChefHat className="h-4 w-4 text-info mx-auto mb-1" />
              <p className="font-bold text-info">{liveOrders.filter(o => o.status === "PAID" || o.status === "PREPARING").length}</p>
              <p className="text-info/70">En cocina</p>
            </div>
            <div className="rounded-lg bg-accent/10 p-2 text-center border border-accent/20">
              <CheckCircle className="h-4 w-4 text-accent mx-auto mb-1" />
              <p className="font-bold text-accent">{liveOrders.filter(o => o.status === "READY").length}</p>
              <p className="text-accent/70">Listo</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-2 text-center border border-green-500/20">
              <HandPlatter className="h-4 w-4 text-green-400 mx-auto mb-1" />
              <p className="font-bold text-green-400">{liveOrders.filter(o => o.status === "DELIVERED").length}</p>
              <p className="text-green-500/70">Entregado</p>
            </div>
            <div className="rounded-lg bg-surface p-2 text-center border border-border">
              <DollarSign className="h-4 w-4 text-text-muted mx-auto mb-1" />
              <p className="font-bold text-text">${liveOrders.filter(o => o.status !== "PENDING").reduce((s, o) => s + o.total, 0).toFixed(0)}</p>
              <p className="text-text-muted">Total cobrado</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending orders from waiters */}
      {pendingOrders.length > 0 && (
        <div className="border-b border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 px-4 py-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-bold text-warning">
              {pendingOrders.length} pendiente{pendingOrders.length !== 1 ? "s" : ""} de cobro
            </span>
            <span className="text-xs text-text-muted">Tomadas por el mesero</span>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            {pendingOrders.map(order => {
              const isExpanded = expandedOrder === order.id;
              return (
                <div key={order.id} className={`flex-shrink-0 rounded-xl border border-warning/20 bg-surface-2 p-3 transition-all ${isExpanded ? "w-80" : "w-64"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-text">#{order.orderNumber}</span>
                    {order.table && (
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <MapPin className="h-3 w-3" />M{order.table.number}
                      </span>
                    )}
                  </div>
                  {order.customerName && (
                    <p className="flex items-center gap-1 text-xs text-text-muted mb-1"><User className="h-3 w-3" />{order.customerName}</p>
                  )}
                  {order.waiter && (
                    <p className="text-xs text-text-muted mb-1">Mesero: {order.waiter.name}</p>
                  )}
                  <div className="text-xs text-text-muted mb-1 space-y-0.5">
                    {order.items.slice(0, isExpanded ? 99 : 4).map(item => (
                      <div key={item.id} className={`${isExpanded ? "" : "truncate"}`}>
                        <p>
                          {item.quantity}x {item.menuItem?.name || (item as any).combo?.name}
                          {isExpanded && item.notes && <span className="text-warning ml-1">📝 {item.notes}</span>}
                          {isExpanded && item.modifiers && (item.modifiers as Array<{name:string}>).length > 0 && (
                            <span className="text-accent ml-1">+{(item.modifiers as Array<{name:string}>).map(m => m.name).join(", ")}</span>
                          )}
                        </p>
                        {isExpanded && item.comboSelections && Object.keys(item.comboSelections).length > 0 && (
                          <div className="mt-0.5 ml-3 text-[10px] text-text-muted leading-tight">
                            {Object.entries(item.comboSelections).map(([k, v]) => (
                              <span key={k} className="mr-2"><span className="text-accent/70">{k}:</span> {v as string}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {!isExpanded && order.items.length > 4 && (
                      <button onClick={() => setExpandedOrder(order.id)} className="text-accent hover:underline">
                        Ver +{order.items.length - 4} más
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-accent">${order.total.toFixed(2)}</span>
                    {isExpanded && (
                      <button onClick={() => setExpandedOrder(null)} className="btn btn-ghost p-1 text-xs text-text-muted">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: "Efe", method: "CASH", icon: Banknote },
                      { label: "Tarj", method: "CARD", icon: CreditCard },
                      { label: "Trans", method: "TRANSFER", icon: ArrowRightLeft },
                    ].map(({ label, method, icon: Icon }) => (
                      <button
                        key={method}
                        onClick={() => confirmPayment(order.id, method)}
                        disabled={payingOrderId === order.id}
                        className="btn flex-col gap-0.5 py-1.5 text-[10px] bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50">
                        {payingOrderId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Edit + Cancel buttons */}
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    <button onClick={() => setEditingOrder(order)} className="btn btn-ghost py-1 text-xs text-info border border-info/20">
                      <Pencil className="h-3.5 w-3.5 inline mr-1" />Editar
                    </button>
                    <button onClick={() => cancelOrder(order.id)} className="btn btn-ghost py-1 text-xs text-danger border border-danger/20">
                      <Trash2 className="h-3.5 w-3.5 inline mr-1" />Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile tab toggle */}
      <div className="flex border-b border-border lg:hidden">
        <button
          onClick={() => setMobilePanel("menu")}
          className={`flex-1 py-2 text-center text-sm font-medium transition ${mobilePanel === "menu" ? "border-b-2 border-accent text-accent" : "text-text-muted"}`}
        >
          Menú
        </button>
        <button
          onClick={() => setMobilePanel("order")}
          className={`flex-1 py-2 text-center text-sm font-medium transition ${mobilePanel === "order" ? "border-b-2 border-accent text-accent" : "text-text-muted"}`}
        >
          Orden {cartCount > 0 && <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">{cartCount}</span>}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT: Menu Panel ──────────────────────────────── */}
        <div className={`flex flex-1 flex-col overflow-hidden ${mobilePanel === "order" ? "hidden lg:flex" : "flex"}`}>
          {/* Category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface-2 px-3 py-2 scrollbar-none">
            <button
              onClick={() => pos.set("selectedCategory", null)}
              className={`btn shrink-0 px-3 py-1.5 text-sm ${!pos.selectedCategory ? "bg-accent text-white" : "btn-ghost"}`}
            >
              Todos
            </button>
            {pos.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => pos.set("selectedCategory", cat.id)}
                className={`btn shrink-0 px-3 py-1.5 text-sm ${pos.selectedCategory === cat.id ? "bg-accent text-white" : "btn-ghost"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="border-b border-border bg-surface-2 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={pos.search}
                onChange={(e) => pos.set("search", e.target.value)}
                placeholder="Buscar producto..."
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-text outline-none focus:border-accent"
              />
              {pos.search && (
                <button onClick={() => pos.set("search", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Combos section */}
            {pos.filteredCombos.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Combos</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {pos.filteredCombos.map((combo) => (
                    <button
                      key={combo.id}
                      onClick={() => pos.set("showComboModal", combo)}
                      className="flex flex-col rounded-xl border border-accent/30 bg-accent/5 p-3 text-left transition hover:bg-accent/10 active:scale-[0.98]"
                    >
                      <span className="text-sm font-medium text-text">{combo.name}</span>
                      {combo.description && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-text-muted">{combo.description}</span>
                      )}
                      <span className="mt-auto pt-2 text-base font-bold text-accent">${combo.basePrice.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Products */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {pos.filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => pos.addProduct(product)}
                />
              ))}
            </div>

            {pos.filteredProducts.length === 0 && pos.filteredCombos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <Search className="mb-2 h-8 w-8" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Order Panel ────────────────────────────── */}
        <div className={`w-full border-l border-border lg:w-[380px] xl:w-[420px] ${mobilePanel === "menu" ? "hidden lg:flex lg:flex-col" : "flex flex-col"}`}>
          <OrderPanel
            cart={pos.cart}
            tables={pos.tables}
            selectedTable={pos.selectedTable}
            customerName={pos.customerName}
            orderType={pos.orderType}
            totals={pos.totals}
            settings={pos.settings}
            products={pos.products}
            submitting={pos.submitting}
            onSelectTable={(t) => pos.set("selectedTable", t)}
            onSetCustomerName={(n) => pos.set("customerName", n)}
            onSetOrderType={(t) => pos.set("orderType", t)}
            onUpdateQuantity={pos.updateQuantity}
            onRemoveItem={pos.removeItem}
            onUpdateNotes={pos.updateItemNotes}
            onToggleModifier={pos.toggleModifier}
            onClearCart={pos.clearCart}
            onSubmitOrder={pos.submitOrder}
          />
        </div>
      </div>

      {/* ─── Combo Modal ──────────────────────────────────── */}
      {pos.showComboModal && (
        <ComboModal
          combo={pos.showComboModal}
          products={pos.products}
          onConfirm={pos.addComboToCart}
          onClose={() => pos.set("showComboModal", null)}
        />
      )}

      {/* ─── Cash Register Modal ──────────────────────────── */}
      {showCashModal && (
        <CashRegisterModal
          mode="close"
          register={pos.cashRegister}
          onSubmit={async (balance, notes) => {
            const res = await pos.closeCashRegister(balance, notes);
            return res;
          }}
          onClose={() => setShowCashModal(false)}
        />
      )}

      {/* Mobile FAB: go to order */}
      {mobilePanel === "menu" && cartCount > 0 && (
        <button
          onClick={() => setMobilePanel("order")}
          className="btn btn-primary fixed bottom-6 right-6 z-50 gap-2 rounded-full px-5 py-3 shadow-lg lg:hidden"
        >
          <ShoppingCart className="h-5 w-5" />
          Ver orden ({cartCount})
        </button>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          products={pos.products}
          onClose={() => setEditingOrder(null)}
          onSaved={() => { fetchLive(); }}
        />
      )}
    </div>
  );
}

// ─── POS Header ─────────────────────────────────────────────

function POSHeader({
  user, logout, register, onCloseCash,
}: {
  user: import("../../types").User | null;
  logout: () => void;
  register: import("../../types").CashRegister | null;
  onCloseCash?: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-5 w-5 text-accent" />
        <h1 className="text-base font-bold text-text">POS</h1>
      </div>
      <div className="flex items-center gap-2">
        {register && (
          <button onClick={onCloseCash} className="btn btn-ghost gap-1 px-2 py-1 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">${register.totalSales.toFixed(2)}</span>
          </button>
        )}
        <span className="text-sm text-text-muted">{user?.name}</span>
        <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-4 w-4" /></button>
      </div>
    </header>
  );
}
