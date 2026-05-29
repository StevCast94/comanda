import { useState } from "react";
import * as api from "../services/api";
import type { Order, MenuItem } from "../types";
import { X, Minus, Plus, Trash2, Loader2 } from "lucide-react";

export default function EditOrderModal({ order, products, onClose, onSaved }: {
  order: Order;
  products: MenuItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<Array<{
    tempId: string;
    menuItemId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    notes: string;
    kitchen: string;
    modifiers: Array<{ modifierId: string; name: string; priceAdjustment: number }>;
  }>>(order.items.map((i: any) => ({
    tempId: crypto.randomUUID(),
    menuItemId: i.menuItemId || undefined,
    name: i.menuItem?.name || i.combo?.name || "Ítem",
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    notes: i.notes || "",
    kitchen: i.kitchen || "KITCHEN_1",
    modifiers: i.modifiers || [],
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const cats = [...new Set(products.map(p => p.categoryId))];
  const filteredAdd = catFilter
    ? products.filter(p => p.categoryId === catFilter && !items.some(i => i.menuItemId === p.id))
    : products.filter(p => !items.some(i => i.menuItemId === p.id)).slice(0, 20);

  const addItem = (product: MenuItem) => {
    setItems(p => [...p, { tempId: crypto.randomUUID(), menuItemId: product.id, name: product.name, quantity: 1, unitPrice: product.basePrice, notes: "", kitchen: product.kitchen, modifiers: [] }]);
  };
  const updateQty = (tempId: string, delta: number) => setItems(p => p.map(i => i.tempId === tempId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  const removeItem = (tempId: string) => setItems(p => p.filter(i => i.tempId !== tempId));

  const save = async () => {
    if (items.length === 0) { setError("Debe haber al menos un ítem"); return; }
    setSaving(true); setError(null);
    try {
      await api.orders.updateItems(order.id, items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes || undefined, kitchen: i.kitchen, modifiers: i.modifiers })));
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message || "Error"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-2 border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-text">Editar Orden #{order.orderNumber}</h3>
          <button onClick={onClose} className="btn btn-ghost p-1"><X className="h-5 w-5 text-text-muted" /></button>
        </div>
        {error && <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl px-3 py-2">{error}</div>}
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.tempId} className="rounded-xl bg-surface p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{item.name}</p>
                {item.notes && <p className="text-xs text-warning">📝 {item.notes}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => updateQty(item.tempId, -1)} className="btn btn-ghost p-1 h-7 w-7"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-6 text-center text-sm text-text font-medium">{item.quantity}</span>
                <button onClick={() => updateQty(item.tempId, 1)} className="btn btn-ghost p-1 h-7 w-7"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <p className="text-sm font-bold text-accent shrink-0">${(item.unitPrice * item.quantity).toFixed(2)}</p>
              <button onClick={() => removeItem(item.tempId)} className="btn btn-ghost p-1 text-danger shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div>
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
            <button onClick={() => setCatFilter(null)} className={`btn shrink-0 px-2 py-1 text-xs ${!catFilter ? "bg-accent text-white" : "btn-ghost"}`}>Sugeridos</button>
            {cats.map(c => {
              const cat = products.find(p => p.categoryId === c)?.category;
              return <button key={c} onClick={() => setCatFilter(c)} className={`btn shrink-0 px-2 py-1 text-xs ${catFilter === c ? "bg-accent text-white" : "btn-ghost"}`}>{cat?.name || c}</button>;
            })}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {filteredAdd.slice(0, 8).map(p => (
              <button key={p.id} onClick={() => addItem(p)} className="rounded-lg border border-border bg-surface p-2 text-left hover:border-accent">
                <p className="text-xs font-medium text-text truncate">{p.name}</p>
                <p className="text-xs text-accent">+${p.basePrice.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={saving || items.length === 0} className="btn btn-primary w-full py-3 font-bold">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
