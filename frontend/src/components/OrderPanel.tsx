import { useState } from "react";
import type { CartItem, Table, MenuItem, PaymentMethod, RestaurantSettings } from "../types";
import {
  Minus, Plus, Trash2, X, MapPin, User, ChevronDown,
  Banknote, CreditCard, ArrowRightLeft, Loader2, CheckCircle,
  StickyNote, ShoppingBag, UtensilsCrossed, Truck,
} from "lucide-react";

interface Props {
  cart: CartItem[];
  tables: Table[];
  selectedTable: Table | null;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  totals: { subtotal: number; taxAmount: number; serviceAmount: number; total: number };
  settings: RestaurantSettings;
  products: MenuItem[];
  submitting: boolean;
  onSelectTable: (t: Table | null) => void;
  onSetCustomerName: (n: string) => void;
  onSetOrderType: (t: "DINE_IN" | "TAKEAWAY" | "DELIVERY") => void;
  onUpdateQuantity: (tempId: string, delta: number) => void;
  onRemoveItem: (tempId: string) => void;
  onUpdateNotes: (tempId: string, notes: string) => void;
  onToggleModifier: (tempId: string, mod: { modifierId: string; name: string; priceAdjustment: number }) => void;
  onClearCart: () => void;
  onSubmitOrder: (method: PaymentMethod) => Promise<unknown>;
}

const ORDER_TYPES = [
  { value: "DINE_IN" as const, label: "En salón", icon: UtensilsCrossed },
  { value: "TAKEAWAY" as const, label: "Para llevar", icon: ShoppingBag },
  { value: "DELIVERY" as const, label: "Delivery", icon: Truck },
];

export default function OrderPanel({
  cart, tables, selectedTable, customerName, orderType, totals, settings,
  products, submitting,
  onSelectTable, onSetCustomerName, onSetOrderType,
  onUpdateQuantity, onRemoveItem, onUpdateNotes, onToggleModifier,
  onClearCart, onSubmitOrder,
}: Props) {
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [showModifiers, setShowModifiers] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<number | null>(null);

  async function handlePay(method: PaymentMethod) {
    try {
      const order = await onSubmitOrder(method);
      if (order && typeof order === "object" && "orderNumber" in order) {
        setSuccessOrder((order as { orderNumber: number }).orderNumber);
        setTimeout(() => setSuccessOrder(null), 3000);
      }
    } catch { /* error shown via POS error banner */ }
  }

  // Success flash
  if (successOrder) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <CheckCircle className="h-16 w-16 text-accent" />
        <h3 className="text-xl font-bold text-text">¡Orden #{successOrder}</h3>
        <p className="text-text-muted">Enviada a cocina</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-surface-2">
      {/* Order type + table + customer */}
      <div className="space-y-2 border-b border-border p-3">
        {/* Order type tabs */}
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {ORDER_TYPES.map((ot) => (
            <button
              key={ot.value}
              onClick={() => onSetOrderType(ot.value)}
              className={`btn flex-1 gap-1 px-2 py-1.5 text-xs ${
                orderType === ot.value ? "bg-accent text-white" : "btn-ghost text-text-muted"
              }`}
            >
              <ot.icon className="h-3.5 w-3.5" />
              {ot.label}
            </button>
          ))}
        </div>

        {/* Table selector (only for DINE_IN) */}
        {orderType === "DINE_IN" && (
          <div className="relative">
            <button
              onClick={() => setShowTablePicker(!showTablePicker)}
              className="btn btn-ghost w-full justify-between border border-border text-sm"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                {selectedTable
                  ? `${selectedTable.floor} — Mesa ${selectedTable.number}`
                  : "Seleccionar mesa"
                }
              </div>
              <ChevronDown className={`h-4 w-4 transition ${showTablePicker ? "rotate-180" : ""}`} />
            </button>

            {showTablePicker && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                {/* Group by floor */}
                {[...new Set((tables || []).map(t => t.floor))].map((floor) => (
                  <div key={floor}>
                    <div className="sticky top-0 bg-surface-3 px-3 py-1 text-xs font-medium text-text-muted">{floor}</div>
                    <div className="grid grid-cols-4 gap-1 p-2">
                      {tables.filter((t) => t.floor === floor).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { onSelectTable(t); setShowTablePicker(false); }}
                          className={`btn px-2 py-2 text-sm ${
                            selectedTable?.id === t.id ? "bg-accent text-white" : "btn-ghost"
                          }`}
                        >
                          M{t.number}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Customer name */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <User className="h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={customerName}
            onChange={(e) => onSetCustomerName(e.target.value)}
            placeholder="Nombre del cliente (opcional)"
            className="flex-1 bg-transparent text-sm text-text outline-none"
          />
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <ShoppingBag className="mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">Agrega productos a la orden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => {
              const modTotal = item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0);
              const lineTotal = (item.unitPrice + modTotal) * item.quantity;

              return (
                <div key={item.tempId} className="rounded-lg bg-surface p-3">
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text">{item.name}</p>
                      {/* Combo selections */}
                      {item.comboSelections && (
                        <div className="mt-0.5 space-y-0 text-xs text-text-muted">
                          {Object.entries(item.comboSelections).map(([group, name]) => (
                            <p key={group}>• {group}: {name}</p>
                          ))}
                        </div>
                      )}
                      {/* Modifiers */}
                      {item.modifiers.length > 0 && (
                        <div className="mt-0.5 text-xs text-accent">
                          {item.modifiers.map((m) => (
                            <span key={m.modifierId} className="mr-2">
                              +{m.name}{m.priceAdjustment > 0 && ` ($${m.priceAdjustment.toFixed(2)})`}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Notes */}
                      {item.notes && (
                        <p className="mt-0.5 text-xs italic text-warning">📝 {item.notes}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-text">${lineTotal.toFixed(2)}</span>
                  </div>

                  {/* Quantity + actions */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateQuantity(item.tempId, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-text-muted hover:text-text active:scale-95"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-text">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.tempId, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-text-muted hover:text-text active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Notes button */}
                      <button
                        onClick={() => setEditingNotes(editingNotes === item.tempId ? null : item.tempId)}
                        className={`btn btn-ghost p-1.5 ${item.notes ? "text-warning" : "text-text-muted"}`}
                      >
                        <StickyNote className="h-3.5 w-3.5" />
                      </button>
                      {/* Modifiers button (if product has modifiers) */}
                      {item.menuItemId && (() => {
                        const prod = products.find((p) => p.id === item.menuItemId);
                        if (!prod?.modifiers?.length) return null;
                        return (
                          <button
                            onClick={() => setShowModifiers(showModifiers === item.tempId ? null : item.tempId)}
                            className="btn btn-ghost p-1.5 text-text-muted"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        );
                      })()}
                      {/* Remove */}
                      <button
                        onClick={() => onRemoveItem(item.tempId)}
                        className="btn btn-ghost p-1.5 text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline notes editor */}
                  {editingNotes === item.tempId && (
                    <div className="mt-2 flex gap-1">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => onUpdateNotes(item.tempId, e.target.value)}
                        placeholder="Ej: sin cebolla, extra salsa..."
                        className="flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-text outline-none focus:border-accent"
                        autoFocus
                      />
                      <button
                        onClick={() => setEditingNotes(null)}
                        className="btn btn-ghost p-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Inline modifiers selector */}
                  {showModifiers === item.tempId && item.menuItemId && (() => {
                    const prod = products.find((p) => p.id === item.menuItemId);
                    if (!prod?.modifiers?.length) return null;
                    return (
                      <div className="mt-2 space-y-1">
                        {prod.modifiers.map((mod) => {
                          const active = item.modifiers.some((m) => m.modifierId === mod.id);
                          return (
                            <button
                              key={mod.id}
                              onClick={() => onToggleModifier(item.tempId, {
                                modifierId: mod.id,
                                name: mod.name,
                                priceAdjustment: mod.priceAdjustment,
                              })}
                              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                                active ? "bg-accent/10 text-accent" : "bg-surface-3 text-text-muted"
                              }`}
                            >
                              <span>{mod.name}</span>
                              {mod.priceAdjustment > 0 && (
                                <span>+${mod.priceAdjustment.toFixed(2)}</span>
                              )}
                            </button>
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

      {/* Totals + payment */}
      {cart.length > 0 && (
        <div className="border-t border-border p-3">
          {/* Totals */}
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Subtotal</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>IVA {(settings.taxRate * 100).toFixed(0)}%</span>
              <span>${totals.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Servicio {(settings.serviceRate * 100).toFixed(0)}%</span>
              <span>${totals.serviceAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-text">
              <span>TOTAL</span>
              <span className="text-accent">${totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePay("CASH")}
              disabled={submitting}
              className="btn btn-primary flex-col gap-1 py-3 text-xs"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Banknote className="h-5 w-5" />}
              Efectivo
            </button>
            <button
              onClick={() => handlePay("CARD")}
              disabled={submitting}
              className="btn flex-col gap-1 border border-accent bg-transparent py-3 text-xs text-accent hover:bg-accent/10"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
              Tarjeta
            </button>
            <button
              onClick={() => handlePay("TRANSFER")}
              disabled={submitting}
              className="btn flex-col gap-1 border border-accent bg-transparent py-3 text-xs text-accent hover:bg-accent/10"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRightLeft className="h-5 w-5" />}
              Transfer.
            </button>
          </div>

          {/* Clear cart */}
          <button
            onClick={onClearCart}
            className="btn btn-ghost mt-2 w-full text-sm text-danger"
          >
            Cancelar orden
          </button>
        </div>
      )}
    </div>
  );
}
