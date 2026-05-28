import { useState, useEffect, useCallback } from "react";
import * as api from "../../services/api";
import {
  Plus, Pencil, Trash2, X, Loader2, Save, Search,
  AlertTriangle, Package, RefreshCw, Truck,
} from "lucide-react";

interface InventoryItem {
  id: string; name: string; category: string | null; unit: string;
  currentStock: number; minStock: number; costPerUnit: number;
  supplierId: string | null; lastRestockDate: string | null;
  supplier: { id: string; name: string } | null;
}

interface Supplier {
  id: string; name: string; contact: string | null; phone: string | null;
  email: string | null; _count: { inventory: number };
}

export default function InventoryPage() {
  const [tab, setTab] = useState<"items" | "suppliers">("items");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, sup] = await Promise.all([
        api.inventory.list({ lowStock: showLowOnly, search: search || undefined }),
        api.inventory.suppliers(),
      ]);
      setItems(inv.items as unknown as InventoryItem[]);
      setLowStockCount(inv.lowStockCount);
      setSuppliers(sup.suppliers as unknown as Supplier[]);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [showLowOnly, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Tabs + alerts */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          <button onClick={() => setTab("items")} className={`btn gap-1.5 px-3 py-1.5 text-sm ${tab === "items" ? "bg-accent text-white" : "btn-ghost"}`}>
            <Package className="h-4 w-4" /> Insumos
          </button>
          <button onClick={() => setTab("suppliers")} className={`btn gap-1.5 px-3 py-1.5 text-sm ${tab === "suppliers" ? "bg-accent text-white" : "btn-ghost"}`}>
            <Truck className="h-4 w-4" /> Proveedores
          </button>
        </div>
        {lowStockCount > 0 && (
          <button onClick={() => { setShowLowOnly(!showLowOnly); setTab("items"); }}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${showLowOnly ? "bg-danger text-white" : "bg-danger/10 text-danger"}`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {lowStockCount} bajo stock
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>
      ) : tab === "items" ? (
        <ItemsTab items={items} suppliers={suppliers} search={search} onSearch={setSearch} onRefresh={load} />
      ) : (
        <SuppliersTab suppliers={suppliers} onRefresh={load} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Items Tab
// ═══════════════════════════════════════════════════════════

function ItemsTab({ items, suppliers, search, onSearch, onRefresh }: {
  items: InventoryItem[]; suppliers: Supplier[]; search: string;
  onSearch: (s: string) => void; onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [restocking, setRestocking] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({ name: "", category: "", unit: "unidad", currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: "" });
  const [restockQty, setRestockQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setForm({ name: "", category: "", unit: "unidad", currentStock: 0, minStock: 0, costPerUnit: 0, supplierId: "" });
    setEditing("new"); setError(null);
  }
  function openEdit(i: InventoryItem) {
    setForm({ name: i.name, category: i.category || "", unit: i.unit, currentStock: i.currentStock, minStock: i.minStock, costPerUnit: i.costPerUnit, supplierId: i.supplierId || "" });
    setEditing(i); setError(null);
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const data = { ...form, category: form.category || null, supplierId: form.supplierId || null, currentStock: Number(form.currentStock), minStock: Number(form.minStock), costPerUnit: Number(form.costPerUnit) };
      if (editing === "new") await api.inventory.create(data);
      else if (editing) await api.inventory.update((editing as InventoryItem).id, data);
      setEditing(null); onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    setSaving(false);
  }

  async function handleRestock() {
    if (!restocking || !restockQty) return;
    setSaving(true);
    try {
      await api.inventory.restock(restocking.id, Number(restockQty));
      setRestocking(null); setRestockQty(""); onRefresh();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este insumo?")) return;
    try { await api.inventory.remove(id); onRefresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  // Restock modal
  if (restocking) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <h3 className="mb-3 text-base font-bold text-text">Reabastecer: {restocking.name}</h3>
        <p className="mb-3 text-sm text-text-muted">Stock actual: {restocking.currentStock} {restocking.unit}</p>
        <div className="flex gap-2">
          <input type="number" min="0" step="0.1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="Cantidad a agregar"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" autoFocus />
          <span className="flex items-center text-sm text-text-muted">{restocking.unit}</span>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setRestocking(null)} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleRestock} disabled={saving || !restockQty} className="btn btn-primary gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reabastecer
          </button>
        </div>
      </div>
    );
  }

  // Edit form
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text">{editing === "new" ? "Nuevo insumo" : "Editar insumo"}</h3>
          <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FInput label="Nombre *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <FInput label="Categoría" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="Ej: Carnes, Verduras..." />
          <FInput label="Unidad" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="kg, L, unidad" />
          <FInput label="Stock actual" type="number" value={String(form.currentStock)} onChange={(v) => setForm({ ...form, currentStock: Number(v) })} />
          <FInput label="Stock mínimo" type="number" value={String(form.minStock)} onChange={(v) => setForm({ ...form, minStock: Number(v) })} />
          <FInput label="Costo por unidad ($)" type="number" value={String(form.costPerUnit)} onChange={(v) => setForm({ ...form, costPerUnit: Number(v) })} />
          <div>
            <label className="mb-1 block text-xs text-text-muted">Proveedor</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent">
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-danger">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    );
  }

  // List
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar insumo..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-accent" />
        </div>
        <button onClick={openNew} className="btn btn-primary gap-1 text-sm"><Plus className="h-4 w-4" /> Nuevo insumo</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2">Insumo</th>
              <th className="hidden px-4 py-2 sm:table-cell">Categoría</th>
              <th className="px-4 py-2 text-right">Stock</th>
              <th className="hidden px-4 py-2 text-right md:table-cell">Mínimo</th>
              <th className="hidden px-4 py-2 text-right md:table-cell">Costo/u</th>
              <th className="hidden px-4 py-2 lg:table-cell">Proveedor</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((i) => {
              const isLow = i.currentStock <= i.minStock;
              return (
                <tr key={i.id} className={isLow ? "bg-danger/5" : ""}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="h-3.5 w-3.5 text-danger" />}
                      <span className="font-medium text-text">{i.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-text-muted sm:table-cell">{i.category || "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${isLow ? "text-danger" : "text-text"}`}>
                    {i.currentStock} {i.unit}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right text-text-muted md:table-cell">{i.minStock} {i.unit}</td>
                  <td className="hidden px-4 py-2.5 text-right text-text-muted md:table-cell">${i.costPerUnit.toFixed(2)}</td>
                  <td className="hidden px-4 py-2.5 text-text-muted lg:table-cell">{i.supplier?.name || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setRestocking(i); setRestockQty(""); }} className="btn btn-ghost p-1.5 text-accent" title="Reabastecer">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEdit(i)} className="btn btn-ghost p-1.5"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(i.id)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <p className="py-8 text-center text-sm text-text-muted">No hay insumos registrados</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Suppliers Tab
// ═══════════════════════════════════════════════════════════

function SuppliersTab({ suppliers, onRefresh }: { suppliers: Supplier[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.inventory.createSupplier({ ...form, contact: form.contact || null, phone: form.phone || null, email: form.email || null });
      setAdding(false); setForm({ name: "", contact: "", phone: "", email: "" }); onRefresh();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    try { await api.inventory.deleteSupplier(id); onRefresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setAdding(true)} className="btn btn-primary gap-1 text-sm"><Plus className="h-4 w-4" /> Nuevo proveedor</button>
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border border-border bg-surface-2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FInput label="Nombre *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <FInput label="Contacto" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} />
            <FInput label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <FInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="btn btn-ghost">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary gap-1 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-text">{s.name}</p>
                <p className="text-xs text-text-muted">{s._count.inventory} insumos</p>
              </div>
              <button onClick={() => handleDelete(s.id)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-0.5 text-xs text-text-muted">
              {s.contact && <p>Contacto: {s.contact}</p>}
              {s.phone && <p>Tel: {s.phone}</p>}
              {s.email && <p>Email: {s.email}</p>}
            </div>
          </div>
        ))}
        {suppliers.length === 0 && <p className="col-span-full py-8 text-center text-sm text-text-muted">No hay proveedores</p>}
      </div>
    </div>
  );
}

function FInput({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-muted">{label}</label>
      <input type={type} step={type === "number" ? "0.01" : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
    </div>
  );
}
