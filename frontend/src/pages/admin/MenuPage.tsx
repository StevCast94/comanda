import { useState, useEffect, useCallback } from "react";
import type { Category, MenuItem, Combo, Modifier } from "../../types";
import * as api from "../../services/api";
import {
  Plus, Pencil, Trash2, X, Loader2, Search, ChevronDown,
  ToggleLeft, ToggleRight, Package, Tag, Layers, Save,
} from "lucide-react";

type Tab = "products" | "categories" | "combos";

const KITCHEN_OPTIONS = [
  { value: "KITCHEN_1", label: "Cocina 1 (Acompañantes)" },
  { value: "KITCHEN_2", label: "Cocina 2 (Proteína)" },
  { value: "BAR", label: "Bar (Bebidas)" },
  { value: "BOTH", label: "Ambas cocinas" },
  { value: "NONE", label: "Ninguna" },
];

const TYPE_OPTIONS = [
  { value: "MAIN", label: "Principal" },
  { value: "PROTEIN", label: "Proteína" },
  { value: "SIDE", label: "Acompañante" },
  { value: "DRINK", label: "Bebida" },
  { value: "DESSERT", label: "Postre" },
];

const CAT_TYPES = [
  "COMBO", "A_LA_CARTE", "BEVERAGE", "DESSERT",
  "BREAKFAST", "LUNCH", "DINNER", "SNACK", "ASADO",
];

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, cb] = await Promise.all([
        api.categories.list(true),
        api.products.list(),
        api.combos.list(undefined, true),
      ]);
      setCategories(c.categories);
      setProducts(p.products);
      setCombos(cb.combos);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtered lists
  const filteredProducts = products.filter((p) => {
    if (filterCat && p.categoryId !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredCombos = combos.filter((c) => {
    if (filterCat && c.categoryId !== filterCat) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {([
            { id: "products" as Tab, label: "Productos", icon: Package, count: products.length },
            { id: "categories" as Tab, label: "Categorías", icon: Tag, count: categories.length },
            { id: "combos" as Tab, label: "Combos", icon: Layers, count: combos.length },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`btn gap-1.5 px-3 py-1.5 text-sm ${tab === t.id ? "bg-accent text-white" : "btn-ghost"}`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-xs">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search + filter + add */}
      {tab !== "categories" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {tab === "products" && (
            <ProductsTab products={filteredProducts} categories={categories} onRefresh={load} />
          )}
          {tab === "categories" && (
            <CategoriesTab categories={categories} onRefresh={load} />
          )}
          {tab === "combos" && (
            <CombosTab combos={filteredCombos} categories={categories} products={products} onRefresh={load} />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Products Tab
// ═══════════════════════════════════════════════════════════

function ProductsTab({ products, categories, onRefresh }: {
  products: MenuItem[]; categories: Category[]; onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", description: "", basePrice: 0, categoryId: "", type: "MAIN",
    kitchen: "NONE", prepTime: 10, image: "",
  });
  const [modifiers, setModifiers] = useState<Array<{ id?: string; name: string; priceAdjustment: number }>>([]);
  const [newMod, setNewMod] = useState({ name: "", priceAdjustment: 0 });

  function openNew() {
    setForm({ name: "", description: "", basePrice: 0, categoryId: categories[0]?.id || "", type: "MAIN", kitchen: "NONE", prepTime: 10, image: "" });
    setModifiers([]);
    setEditing("new");
    setError(null);
  }

  function openEdit(p: MenuItem) {
    setForm({
      name: p.name, description: p.description || "", basePrice: p.basePrice,
      categoryId: p.categoryId, type: p.type, kitchen: p.kitchen,
      prepTime: p.prepTime, image: p.image || "",
    });
    setModifiers(p.modifiers.map((m) => ({ id: m.id, name: m.name, priceAdjustment: m.priceAdjustment })));
    setEditing(p);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...form,
        basePrice: Number(form.basePrice),
        prepTime: Number(form.prepTime),
        image: form.image || null,
        description: form.description || null,
      };

      if (editing === "new") {
        const { product } = await api.products.create(data);
        // Add modifiers
        for (const m of modifiers) {
          await api.products.addModifier(product.id, { name: m.name, priceAdjustment: m.priceAdjustment });
        }
      } else if (editing) {
        await api.products.update(editing.id, data);
        // Sync modifiers: delete removed, add new
        const oldIds = editing.modifiers.map((m) => m.id);
        const newIds = modifiers.filter((m) => m.id).map((m) => m.id!);
        for (const oldId of oldIds) {
          if (!newIds.includes(oldId)) await api.products.deleteModifier(oldId);
        }
        for (const m of modifiers) {
          if (!m.id) await api.products.addModifier(editing.id, { name: m.name, priceAdjustment: m.priceAdjustment });
        }
      }
      setEditing(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    }
    setSaving(false);
  }

  async function handleToggle(id: string) {
    await api.products.toggleActive(id);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await api.products.remove(id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  function addModifier() {
    if (!newMod.name.trim()) return;
    setModifiers([...modifiers, { name: newMod.name, priceAdjustment: Number(newMod.priceAdjustment) }]);
    setNewMod({ name: "", priceAdjustment: 0 });
  }

  // ─── Modal ────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text">{editing === "new" ? "Nuevo producto" : `Editar: ${(editing as MenuItem).name}`}</h3>
          <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nombre *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="Descripción" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Input label="Precio base ($) *" type="number" value={String(form.basePrice)} onChange={(v) => setForm({ ...form, basePrice: Number(v) })} />
          <Select label="Categoría *" value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Tipo" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPE_OPTIONS} />
          <Select label="Cocina" value={form.kitchen} onChange={(v) => setForm({ ...form, kitchen: v })} options={KITCHEN_OPTIONS} />
          <Input label="Tiempo prep. (min)" type="number" value={String(form.prepTime)} onChange={(v) => setForm({ ...form, prepTime: Number(v) })} />
          <Input label="Imagen URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
        </div>

        {/* Modifiers */}
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-medium text-text-muted">Modificadores</h4>
          <div className="space-y-1 mb-2">
            {modifiers.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
                <span className="flex-1 text-text">{m.name}</span>
                <span className="text-text-muted">{m.priceAdjustment > 0 ? `+$${m.priceAdjustment.toFixed(2)}` : "Sin costo"}</span>
                <button onClick={() => setModifiers(modifiers.filter((_, j) => j !== i))} className="text-danger"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newMod.name} onChange={(e) => setNewMod({ ...newMod, name: e.target.value })} placeholder="Ej: Sin cebolla" className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
            <input type="number" step="0.01" value={newMod.priceAdjustment} onChange={(e) => setNewMod({ ...newMod, priceAdjustment: Number(e.target.value) })} placeholder="$0" className="w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text outline-none focus:border-accent" />
            <button onClick={addModifier} className="btn btn-ghost text-accent"><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        {error && <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.categoryId} className="btn btn-primary gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>
    );
  }

  // ─── List ─────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={openNew} className="btn btn-primary gap-1 text-sm"><Plus className="h-4 w-4" /> Nuevo producto</button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2">Producto</th>
              <th className="hidden px-4 py-2 sm:table-cell">Categoría</th>
              <th className="px-4 py-2">Precio</th>
              <th className="hidden px-4 py-2 md:table-cell">Cocina</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id} className={`${!p.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-text">{p.name}</p>
                  {p.modifiers.length > 0 && <p className="text-xs text-accent">{p.modifiers.length} mod.</p>}
                </td>
                <td className="hidden px-4 py-2.5 text-text-muted sm:table-cell">{p.category?.name}</td>
                <td className="px-4 py-2.5 font-medium text-accent">${p.basePrice.toFixed(2)}</td>
                <td className="hidden px-4 py-2.5 text-text-muted md:table-cell">{p.kitchen}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => handleToggle(p.id)} className="text-text-muted hover:text-text">
                    {p.active ? <ToggleRight className="h-5 w-5 text-accent" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="btn btn-ghost p-1.5"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(p.id)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">No hay productos</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Categories Tab
// ═══════════════════════════════════════════════════════════

function CategoriesTab({ categories, onRefresh }: { categories: Category[]; onRefresh: () => void }) {
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [form, setForm] = useState({ name: "", type: "A_LA_CARTE", sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() { setForm({ name: "", type: "A_LA_CARTE", sortOrder: categories.length }); setEditing("new"); setError(null); }
  function openEdit(c: Category) { setForm({ name: c.name, type: c.type, sortOrder: c.sortOrder }); setEditing(c); setError(null); }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (editing === "new") await api.categories.create(form);
      else if (editing) await api.categories.update(editing.id, form);
      setEditing(null); onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try { await api.categories.remove(id); onRefresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={openNew} className="btn btn-primary gap-1 text-sm"><Plus className="h-4 w-4" /> Nueva categoría</button>
      </div>

      {editing && (
        <div className="mb-4 rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-bold text-text">{editing === "new" ? "Nueva categoría" : "Editar categoría"}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Select label="Tipo" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={CAT_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))} />
            <Input label="Orden" type="number" value={String(form.sortOrder)} onChange={(v) => setForm({ ...form, sortOrder: Number(v) })} />
          </div>
          {error && <div className="mt-2 text-sm text-danger">{error}</div>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="btn btn-ghost text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary gap-1 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text">{c.name}</p>
              <p className="text-xs text-text-muted">{c.type} · {c._count?.menuItems || 0} productos · {c._count?.combos || 0} combos</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="btn btn-ghost p-1.5"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => handleDelete(c.id)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Combos Tab
// ═══════════════════════════════════════════════════════════

function CombosTab({ combos, categories, products, onRefresh }: {
  combos: Combo[]; categories: Category[]; products: MenuItem[]; onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<Combo | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", description: "", basePrice: 0, categoryId: "", type: "LUNCH" as string });
  const [items, setItems] = useState<Array<{ menuItemId: string; groupName: string; isOptional: boolean; isDefault: boolean; alternatives: string[] }>>([]);

  function openNew() {
    setForm({ name: "", description: "", basePrice: 0, categoryId: categories[0]?.id || "", type: "LUNCH" });
    setItems([]);
    setEditing("new"); setError(null);
  }

  function openEdit(c: Combo) {
    setForm({ name: c.name, description: c.description || "", basePrice: c.basePrice, categoryId: c.categoryId, type: c.type });
    setItems(c.comboItems.map((ci) => ({
      menuItemId: ci.menuItemId,
      groupName: ci.groupName || "",
      isOptional: ci.isOptional,
      isDefault: ci.isDefault,
      alternatives: (() => { try { return typeof ci.alternatives === "string" ? JSON.parse(ci.alternatives) : ci.alternatives || []; } catch { return []; } })(),
    })));
    setEditing(c); setError(null);
  }

  function addItem() {
    if (products.length === 0) return;
    setItems([...items, { menuItemId: products[0].id, groupName: "", isOptional: false, isDefault: true, alternatives: [] }]);
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const data = {
        ...form, basePrice: Number(form.basePrice),
        description: form.description || null,
        items: items.map((i) => ({ ...i, quantity: 1 })),
      };
      if (editing === "new") await api.combos.create(data);
      else if (editing && typeof editing !== "string") await api.combos.update(editing.id, data);
      setEditing(null); onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este combo?")) return;
    try { await api.combos.remove(id); onRefresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text">{editing === "new" ? "Nuevo combo" : "Editar combo"}</h3>
          <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Nombre *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="Descripción" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Input label="Precio base ($) *" type="number" value={String(form.basePrice)} onChange={(v) => setForm({ ...form, basePrice: Number(v) })} />
          <Select label="Categoría *" value={form.categoryId} onChange={(v) => setForm({ ...form, categoryId: v })} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        </div>

        {/* Combo items */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-text-muted">Ítems del combo</h4>
            <button onClick={addItem} className="btn btn-ghost gap-1 text-xs text-accent"><Plus className="h-3.5 w-3.5" /> Agregar ítem</button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg bg-surface p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select value={item.menuItemId} onChange={(e) => { const n = [...items]; n[i].menuItemId = e.target.value; setItems(n); }} className="flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none">
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.basePrice})</option>)}
                  </select>
                  <input value={item.groupName} onChange={(e) => { const n = [...items]; n[i].groupName = e.target.value; setItems(n); }} placeholder="Grupo (ej: Proteína)" className="w-32 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none" />
                  <label className="flex items-center gap-1 text-xs text-text-muted">
                    <input type="checkbox" checked={item.isOptional} onChange={(e) => { const n = [...items]; n[i].isOptional = e.target.checked; setItems(n); }} />
                    Opcional
                  </label>
                  <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-danger"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-danger">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name || items.length === 0} className="btn btn-primary gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={openNew} className="btn btn-primary gap-1 text-sm"><Plus className="h-4 w-4" /> Nuevo combo</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {combos.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="font-medium text-text">{c.name}</p>
                {c.description && <p className="text-xs text-text-muted">{c.description}</p>}
              </div>
              <span className="text-lg font-bold text-accent">${c.basePrice.toFixed(2)}</span>
            </div>
            <div className="mb-3 space-y-0.5 text-xs text-text-muted">
              {c.comboItems.map((ci) => (
                <p key={ci.id}>• {ci.groupName || ""}: {ci.menuItem.name}{ci.isOptional ? " (opcional)" : ""}</p>
              ))}
            </div>
            <div className="flex justify-end gap-1 border-t border-border pt-2">
              <button onClick={() => openEdit(c)} className="btn btn-ghost p-1.5 text-sm"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => handleDelete(c.id)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {combos.length === 0 && <p className="col-span-full py-8 text-center text-sm text-text-muted">No hay combos</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Reusable form components
// ═══════════════════════════════════════════════════════════

function Input({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-muted">{label}</label>
      <input type={type} step={type === "number" ? "0.01" : undefined} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
