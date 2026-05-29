import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePolling } from "../../hooks/usePolling";
import * as api from "../../services/api";
import type { Order, CartItem, Table, MenuItem, Combo, RestaurantSettings, KitchenStation } from "../../types";
import ProductCard from "../../components/ProductCard";
import EditOrderModal from "../../components/EditOrderModal";
import {
  LogOut, HandPlatter, RefreshCw, CheckCircle, Clock,
  MapPin, Loader2, Wifi, WifiOff, Volume2, VolumeX, Pencil,
  Search, X, ShoppingCart, Minus, Plus, Trash2, StickyNote,
  UtensilsCrossed, ChevronDown, User,
} from "lucide-react";

function minutesAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

type TabMode = "entregar" | "tomar";

export default function WaiterPage() {
  const { user, logout } = useAuth();
  const [tab, setTabt] = useState<TabMode>("tomar");
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [justDelivered, setJustDelivered] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCountRef = useRef(0);

  // ─── Poll pending deliveries ──────────────────────────────
  const { data, error, loading, refresh } = usePolling(
    () => api.waiter.pending(),
    { interval: 5000 }
  );
  const readyOrders: Order[] = data?.orders || [];

  // ─── My pending orders (for editing) ───────────────────────
  const [myPending, setMyPending] = useState<Order[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  useEffect(() => {
    const fetch = async () => {
      try {
        const { orders } = await api.orders.list({ status: "PENDING", limit: 50 });
        if (user) setMyPending((orders || []).filter((o: any) => o.waiterId === user.id || o.waiter?.id === user.id));
      } catch {}
    };
    fetch();
    const t = setInterval(fetch, 10000);
    return () => clearInterval(t);
  }, [user]);

  // ─── Take Order state ─────────────────────────────────────
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [search, setSearch] = useState("");
  const [orderLoading, setOrderLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [showModifiers, setShowModifiers] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, prodRes, comboRes, tableRes] = await Promise.all([
          api.categories.list(),
          api.products.list({ active: true }),
          api.combos.list(),
          api.settings.tables(),
        ]);
        setCategories(catRes.categories);
        setProducts(prodRes.products);
        setCombos(comboRes.combos);
        setTables(tableRes.data || []);
        setSelectedCategory(catRes.categories[0]?.id || null);
      } catch { /* ignore */ }
      setOrderLoading(false);
    })();
  }, []);

  const filteredProducts = (() => {
    let items = products;
    if (selectedCategory) items = items.filter(p => p.categoryId === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q));
    }
    return items;
  })();

  const addProduct = (product: MenuItem) => {
    const existing = cart.find(c => c.menuItemId === product.id && !c.comboId && c.modifiers.length === 0 && !c.notes);
    if (existing) {
      setCart(cart.map(c => c.tempId === existing.tempId ? { ...c, quantity: c.quantity + 1 } : c));
      return;
    }
    setCart([...cart, {
      tempId: crypto.randomUUID(),
      menuItemId: product.id,
      name: product.name,
      quantity: 1,
      unitPrice: product.basePrice,
      kitchen: product.kitchen,
      notes: "",
      modifiers: [],
    }]);
  };

  const updateQty = (tempId: string, delta: number) => {
    setCart(cart.map(c => c.tempId === tempId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const removeItem = (tempId: string) => setCart(cart.filter(c => c.tempId !== tempId));

  const toggleMod = (tempId: string, mod: { modifierId: string; name: string; priceAdjustment: number }) => {
    setCart(cart.map(c => {
      if (c.tempId !== tempId) return c;
      const exists = c.modifiers.find(m => m.modifierId === mod.modifierId);
      return { ...c, modifiers: exists ? c.modifiers.filter(m => m.modifierId !== mod.modifierId) : [...c.modifiers, mod] };
    }));
  };

  const updNotes = (tempId: string, notes: string) => {
    setCart(cart.map(c => c.tempId === tempId ? { ...c, notes } : c));
  };

  const clearAll = () => { setCart([]); setSelectedTable(null); setCustomerName(""); };

  const totals = (() => {
    const subtotal = cart.reduce((s, i) => { const m = i.modifiers.reduce((sm, mm) => sm + mm.priceAdjustment, 0); return s + (i.unitPrice + m) * i.quantity; }, 0);
    const tax = Math.round(subtotal * 0.15 * 100) / 100;
    const svc = Math.round(subtotal * 0.10 * 100) / 100;
    return { subtotal, tax, svc, total: Math.round((subtotal + tax + svc) * 100) / 100 };
  })();

  const submitWaiterOrder = async () => {
    if (cart.length === 0) return;
    if (!selectedTable) return;
    setSubmitting(true);
    try {
      const { order } = await api.orders.create({
        tableId: selectedTable.id,
        customerName: customerName || undefined,
        orderType: "DINE_IN",
        status: "PENDING",
        items: cart.map(c => ({
          menuItemId: c.menuItemId,
          comboId: c.comboId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          notes: c.notes || undefined,
          kitchen: c.kitchen,
          modifiers: c.modifiers,
          comboSelections: c.comboSelections,
        })),
      });
      setSuccessOrder(order.orderNumber);
      setTimeout(() => setSuccessOrder(null), 3000);
      clearAll();
    } catch { /* error handled by user */ }
    setSubmitting(false);
  };

  // Sound notification on new ready orders
  useEffect(() => {
    if (readyOrders.length > prevCountRef.current && soundEnabled && prevCountRef.current > 0) {
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
    prevCountRef.current = readyOrders.length;
  }, [readyOrders.length, soundEnabled]);

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
          {tab === "entregar" && (
            <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
              {readyOrders.length} lista{readyOrders.length !== 1 ? "s" : ""}
            </span>
          )}
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

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTabt("tomar")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "tomar" ? "text-accent border-b-2 border-accent" : "text-text-muted hover:text-text"}`}
        >
          <UtensilsCrossed className="inline h-4 w-4 mr-1" /> Tomar Orden
        </button>
        <button
          onClick={() => setTabt("entregar")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "entregar" ? "text-accent border-b-2 border-accent" : "text-text-muted hover:text-text"}`}
        >
          <HandPlatter className="inline h-4 w-4 mr-1" /> Entregar
          {readyOrders.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">{readyOrders.length}</span>
          )}
        </button>
      </div>

      {/* Success toast */}
      {justDelivered && (
        <div className="flex items-center justify-center gap-2 bg-accent/10 py-2 text-sm text-accent">
          <CheckCircle className="h-4 w-4" />
          Orden #{justDelivered} entregada
        </div>
      )}

      {/* Mis órdenes pendientes (barra plegable) */}
      {myPending.length > 0 && (
        <details className="border-b border-border bg-surface-2" open>
          <summary className="flex items-center gap-2 px-4 py-2 cursor-pointer text-sm font-medium text-warning hover:text-warning/80">
            <Clock className="h-4 w-4" />
            Mis {myPending.length} orden{myPending.length !== 1 ? "es" : ""} en caja (pendiente de pago)
          </summary>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
            {myPending.map(order => (
              <div key={order.id} className="flex-shrink-0 w-60 rounded-xl border border-warning/20 bg-surface-2 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-text">#{order.orderNumber}</span>
                  {order.table && <span className="text-xs text-text-muted">M{order.table.number}</span>}
                </div>
                <div className="text-xs text-text-muted mb-2 space-y-0.5">
                  {order.items.slice(0, 3).map((item: any) => (
                    <p key={item.id} className="truncate">{item.quantity}x {item.menuItem?.name || item.combo?.name}</p>
                  ))}
                  {order.items.length > 3 && <p>+{order.items.length - 3} más</p>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-accent">${order.total.toFixed(2)}</span>
                  <button onClick={() => setEditingOrder(order)} className="btn btn-ghost px-2 py-1 text-xs text-info border border-info/20">
                    <Pencil className="h-3.5 w-3.5 inline mr-1" />Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ─── TAB: ENTREGAR ──────────────────────────────────── */}
      {tab === "entregar" && (
        <div className="flex-1 overflow-y-auto p-4">
          {readyOrders.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center text-text-muted">
              <HandPlatter className="mb-4 h-16 w-16 opacity-20" />
              <p className="text-xl">Sin órdenes listas</p>
              <p className="mt-1 text-sm">Aparecerán aquí cuando cocina termine</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readyOrders.map((order) => {
              const mins = minutesAgo((order as any).updatedAt || order.createdAt);
              return (
                <div key={order.id} className="rounded-xl border border-accent/30 bg-surface-2 overflow-hidden">
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
                  <div className="p-4 space-y-1">
                    {order.customerName && (
                      <p className="mb-2 text-sm text-text-muted">Cliente: {order.customerName}</p>
                    )}
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 text-sm">
                        <span className="font-medium text-accent">{item.quantity}x</span>
                        <div>
                          <span className="text-text">{item.menuItem?.name || (item as any).combo?.name}</span>
                          {item.notes && <p className="text-xs text-warning">📝 {item.notes}</p>}
                          {(item.modifiers as Array<{name: string}>).length > 0 && (
                            <p className="text-xs text-text-muted">
                              {(item.modifiers as Array<{name: string}>).map((m) => m.name).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border p-3">
                    <button
                      onClick={() => handleDeliver(order.id, order.orderNumber)}
                      disabled={deliveringId === order.id}
                      className="btn btn-primary w-full gap-2 py-3 text-base"
                    >
                      {deliveringId === order.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                      Entregar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB: TOMAR ORDEN ───────────────────────────────── */}
      {tab === "tomar" && (
        <>
          {successOrder && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-2 p-10 shadow-xl border border-accent/30">
                <CheckCircle className="h-16 w-16 text-accent" />
                <h3 className="text-2xl font-bold text-text">¡Orden #{successOrder}</h3>
                <p className="text-text-muted">Enviada a caja para cobro</p>
              </div>
            </div>
          )}

          {/* MOBILE: full-width menu, cart as bottom sheet */}
          <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
            {/* Category + Search bar */}
            <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface-2 px-2 py-2 scrollbar-none">
              <button onClick={() => setSelectedCategory(null)} className={`btn shrink-0 px-2.5 py-1.5 text-xs ${!selectedCategory ? "bg-accent text-white" : "btn-ghost"}`}>Todos</button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`btn shrink-0 px-2.5 py-1.5 text-xs ${selectedCategory === cat.id ? "bg-accent text-white" : "btn-ghost"}`}>{cat.name}</button>
              ))}
            </div>
            <div className="border-b border-border bg-surface-2 px-2 py-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-8 text-sm text-text outline-none focus:border-accent" />
                {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"><X className="h-4 w-4" /></button>}
              </div>
            </div>
            {/* Products grid — responsive columns */}
            <div className="flex-1 overflow-y-auto p-2">
              {orderLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {filteredProducts.map(p => (
                    <ProductCard key={p.id} product={p} onAdd={() => addProduct(p)} />
                  ))}
                </div>
              )}
              {!orderLoading && filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-text-muted"><Search className="mb-2 h-8 w-8" /><p>Sin productos</p></div>
              )}
            </div>

            {/* Bottom bar: table + cart summary + send */}
            <div className="border-t border-border bg-surface-2 px-2 py-2 space-y-1.5">
              <div className="flex gap-1.5 items-center">
                <User className="h-4 w-4 text-text-muted shrink-0" />
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Cliente" className="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-text outline-none focus:border-accent" />
                <span className="text-xs text-text-muted shrink-0">{cart.length} items</span>
              </div>
              <div className="flex gap-1.5">
                <select
                  value={selectedTable?.id || ""}
                  onChange={e => { const t = tables.find(tt => tt.id === e.target.value); if (t) setSelectedTable(t); }}
                  className="flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text outline-none focus:border-accent"
                >
                  <option value="">Seleccionar mesa</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id}>Mesa {t.number} ({t.floor})</option>
                  ))}
                </select>
                <button onClick={submitWaiterOrder} disabled={submitting || !selectedTable || cart.length === 0}
                  className="btn btn-primary px-4 py-2 text-sm font-bold disabled:opacity-40 shrink-0">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>${totals.total.toFixed(0)} — Enviar</>}
                </button>
              </div>
            </div>
          </div>

          {/* DESKTOP: side-by-side (existing layout) */}
          <div className="hidden lg:flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface-2 px-3 py-2 scrollbar-none">
                <button onClick={() => setSelectedCategory(null)} className={`btn shrink-0 px-3 py-1.5 text-xs ${!selectedCategory ? "bg-accent text-white" : "btn-ghost"}`}>Todos</button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`btn shrink-0 px-3 py-1.5 text-xs ${selectedCategory === cat.id ? "bg-accent text-white" : "btn-ghost"}`}>{cat.name}</button>
                ))}
              </div>
              <div className="border-b border-border bg-surface-2 px-3 py-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-text outline-none focus:border-accent" />
                  {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"><X className="h-4 w-4" /></button>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {orderLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {filteredProducts.map(p => (
                      <ProductCard key={p.id} product={p} onAdd={() => addProduct(p)} />
                    ))}
                  </div>
                )}
                {!orderLoading && filteredProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-text-muted"><Search className="mb-2 h-8 w-8" /><p>Sin productos</p></div>
                )}
              </div>
            </div>
            <div className="w-[350px] border-l border-border bg-surface-2 flex flex-col">
              <div className="space-y-2 border-b border-border p-3">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Mesa</p>
                <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                  {tables.map(t => (
                    <button key={t.id} onClick={() => setSelectedTable(t)}
                      className={`btn px-2 py-2 text-xs ${selectedTable?.id === t.id ? "bg-accent text-white" : "btn-ghost"}`}
                    >M{t.number}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                  <User className="h-4 w-4 text-text-muted" />
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nombre cliente" className="flex-1 bg-transparent text-sm text-text outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                    <ShoppingCart className="mb-2 h-10 w-10 opacity-30" />
                    <p className="text-sm">Agrega productos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => {
                      const modTotal = item.modifiers.reduce((s: number, m: any) => s + m.priceAdjustment, 0);
                      const lineTotal = (item.unitPrice + modTotal) * item.quantity;
                      return (
                        <div key={item.tempId} className="rounded-lg bg-surface p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-text">{item.name}</p>
                              {item.modifiers.length > 0 && (
                                <div className="mt-0.5 text-xs text-accent">{item.modifiers.map((m: any) => <span key={m.modifierId} className="mr-2">+{m.name}{m.priceAdjustment > 0 && ` ($${m.priceAdjustment.toFixed(2)})`}</span>)}</div>
                              )}
                              {item.notes && <p className="mt-0.5 text-xs italic text-warning">📝 {item.notes}</p>}
                            </div>
                            <span className="text-sm font-bold text-text">${lineTotal.toFixed(2)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateQty(item.tempId, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-text-muted"><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-8 text-center text-sm font-medium text-text">{item.quantity}</span>
                              <button onClick={() => updateQty(item.tempId, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-text-muted"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setEditingNotes(editingNotes === item.tempId ? null : item.tempId)} className={`btn btn-ghost p-1.5 ${item.notes ? "text-warning" : "text-text-muted"}`}><StickyNote className="h-3.5 w-3.5" /></button>
                              {item.menuItemId && products.find(p => p.id === item.menuItemId)?.modifiers?.length ? (
                                <button onClick={() => setShowModifiers(showModifiers === item.tempId ? null : item.tempId)} className="btn btn-ghost p-1.5 text-text-muted"><ChevronDown className="h-3.5 w-3.5" /></button>
                              ) : null}
                              <button onClick={() => removeItem(item.tempId)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          {editingNotes === item.tempId && (
                            <div className="mt-2 flex gap-1">
                              <input type="text" value={item.notes} onChange={e => updNotes(item.tempId, e.target.value)} placeholder="Ej: sin cebolla..." className="flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-text outline-none focus:border-accent" autoFocus />
                              <button onClick={() => setEditingNotes(null)} className="btn btn-ghost p-1.5"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          )}
                          {showModifiers === item.tempId && item.menuItemId && (() => {
                            const prod = products.find(p => p.id === item.menuItemId);
                            if (!prod?.modifiers?.length) return null;
                            return (
                              <div className="mt-2 space-y-1">
                                {prod.modifiers.map((mod: any) => {
                                  const active = item.modifiers.some((m: any) => m.modifierId === mod.id);
                                  return (
                                    <button key={mod.id} onClick={() => toggleMod(item.tempId, { modifierId: mod.id, name: mod.name, priceAdjustment: mod.priceAdjustment })}
                                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${active ? "bg-accent/10 text-accent" : "bg-surface-3 text-text-muted"}`}
                                    ><span>{mod.name}</span>{mod.priceAdjustment > 0 && <span>+${mod.priceAdjustment.toFixed(2)}</span>}</button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {cart.length > 0 && (
                <div className="border-t border-border p-3">
                  <div className="mb-3 space-y-1 text-sm">
                    <div className="flex justify-between text-text-muted"><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between text-text-muted"><span>IVA 15%</span><span>${totals.tax.toFixed(2)}</span></div>
                    <div className="flex justify-between text-text-muted"><span>Servicio 10%</span><span>${totals.svc.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-text"><span>TOTAL</span><span className="text-accent">${totals.total.toFixed(2)}</span></div>
                  </div>
                  <button onClick={submitWaiterOrder} disabled={submitting || !selectedTable}
                    className="btn btn-primary w-full gap-2 py-3 text-base">
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UtensilsCrossed className="h-5 w-5" />}
                    Enviar orden a caja
                  </button>
                  <button onClick={clearAll} className="btn btn-ghost mt-2 w-full text-sm text-danger">Cancelar</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Order Modal — for pending orders */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          products={products}
          onClose={() => setEditingOrder(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
