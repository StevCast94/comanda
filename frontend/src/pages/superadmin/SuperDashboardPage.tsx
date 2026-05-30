import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import * as api from "../../services/api";
import {
  LogOut, Shield, Building2, Users, TrendingUp,
  RefreshCw, Loader2, CheckCircle, XCircle, Clock,
  CreditCard, AlertTriangle, Plus, Pause, Play, Edit3,
  Store, ChefHat, Coffee, Beer, Flame, Fish, Pizza,
  UtensilsCrossed, GlassWater, HelpCircle, Trash2,
  Phone, MapPin, Key, User, X, Save, Mail,
} from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  type: string;
  active: boolean;
  address: string | null;
  phone: string | null;
  createdAt: string;
  subscription: {
    id: string;
    plan: string;
    status: string;
    trialEndsAt: string | null;
    price: number;
  } | null;
  _count: { users: number; orders: number; menuItems: number };
}

interface Metrics {
  totalRestaurants: number;
  activeRestaurants: number;
  newThisMonth: number;
  subscriptionsByPlan: Array<{ plan: string; _count: number }>;
}

const RESTAURANT_TYPES: Record<string, { label: string; icon: any; emoji: string }> = {
  COMIDA_RAPIDA: { label: "Comida Rápida", icon: ChefHat, emoji: "🍔" },
  CEVICHERIA: { label: "Cevichería", icon: Fish, emoji: "🐟" },
  COCKTELERIA: { label: "Cocktelería", icon: GlassWater, emoji: "🍸" },
  BAR: { label: "Bar", icon: Beer, emoji: "🍺" },
  PARRILLADA: { label: "Parrillada", icon: Flame, emoji: "🥩" },
  RESTAURANTE: { label: "Restaurante", icon: UtensilsCrossed, emoji: "🍽️" },
  CAFETERIA: { label: "Cafetería", icon: Coffee, emoji: "☕" },
  PIZZERIA: { label: "Pizzería", icon: Pizza, emoji: "🍕" },
  MARISQUERIA: { label: "Marisquería", icon: Fish, emoji: "🦞" },
  OTRO: { label: "Otro", icon: HelpCircle, emoji: "🏪" },
};

const PLANS = ["FREE", "TRIAL", "BASIC", "PRO", "ENTERPRISE"];

const planColors: Record<string, string> = {
  FREE: "bg-gray-500/10 text-gray-400",
  TRIAL: "bg-info/10 text-info",
  BASIC: "bg-cyan-500/10 text-cyan-400",
  PRO: "bg-accent/10 text-accent",
  ENTERPRISE: "bg-purple-500/10 text-purple-400",
};

const planPrices: Record<string, string> = {
  FREE: "Gratis", TRIAL: "14d gratis", BASIC: "$29/mes", PRO: "$59/mes", ENTERPRISE: "$99/mes",
};

const statusIcons: Record<string, typeof CheckCircle> = {
  ACTIVE: CheckCircle, TRIAL: Clock, PAST_DUE: AlertTriangle, CANCELED: XCircle, EXPIRED: XCircle,
};

const statusColors: Record<string, string> = {
  ACTIVE: "text-success", TRIAL: "text-info", PAST_DUE: "text-warning", CANCELED: "text-danger", EXPIRED: "text-danger",
};

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "restaurants" | "new">("overview");
  const [actionMsg, setActionMsg] = useState("");

  // ─── Modal state ──────────────────────────────────────────
  const [editModal, setEditModal] = useState<Restaurant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", type: "", address: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);

  const [credsModal, setCredsModal] = useState<{ id: string; name: string } | null>(null);
  const [credsForm, setCredsForm] = useState({ username: "", password: "", name: "" });
  const [credsSaving, setCredsSaving] = useState(false);

  // ─── New restaurant form ──────────────────────────────────
  const [form, setForm] = useState({
    name: "", slug: "", type: "RESTAURANTE", address: "", phone: "",
    adminName: "", adminEmail: "", adminPassword: "",
    plan: "TRIAL" as string,
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [restRes, metRes] = await Promise.all([
        api.superadmin.restaurants(),
        api.superadmin.metrics(),
      ]);
      setRestaurants(restRes.restaurants as Restaurant[]);
      setMetrics(metRes as unknown as Metrics);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function showMsg(msg: string, isError = false) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), isError ? 5000 : 3000);
  }

  // ─── New Restaurant ───────────────────────────────────────
  function generateSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 50);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setFormError(""); setFormSuccess("");
    try {
      const res = await api.superadmin.createRestaurant(form);
      setFormSuccess(res.message);
      setForm({ name: "", slug: "", type: "RESTAURANTE", address: "", phone: "", adminName: "", adminEmail: "", adminPassword: "", plan: "TRIAL" });
      await loadData();
      setTab("restaurants");
    } catch (err: any) {
      setFormError(err.message || "Error creando restaurante");
    } finally { setCreating(false); }
  }

  // ─── Actions ──────────────────────────────────────────────
  async function suspendRestaurant(id: string) {
    try { await api.superadmin.suspendRestaurant(id); showMsg("Restaurante suspendido"); await loadData(); }
    catch (err: any) { showMsg("Error: " + (err.message || "desconocido"), true); }
  }
  async function reactivateRestaurant(id: string) {
    try { await api.superadmin.reactivateRestaurant(id); showMsg("Restaurante reactivado"); await loadData(); }
    catch (err: any) { showMsg("Error: " + (err.message || "desconocido"), true); }
  }
  async function changePlan(subId: string, newPlan: string) {
    try { await api.superadmin.updateSubscription(subId, newPlan); showMsg(`Plan → ${newPlan}`); await loadData(); }
    catch (err: any) { showMsg("Error: " + (err.message || "desconocido"), true); }
  }

  async function handleDeleteRestaurant(id: string, name: string) {
    if (!confirm(`¿Eliminar PERMANENTEMENTE "${name}"? Todos sus datos (usuarios, órdenes, productos) se perderán.`)) return;
    try {
      await api.superadmin.deleteRestaurant(id);
      showMsg(`"${name}" eliminado`);
      await loadData();
    } catch (err: any) { showMsg("Error: " + (err.message || "desconocido"), true); }
  }

  // ─── Edit Modal ───────────────────────────────────────────
  function openEdit(r: Restaurant) {
    setEditModal(r);
    setEditForm({ name: r.name, slug: r.slug, type: r.type, address: r.address || "", phone: r.phone || "" });
  }
  async function handleSaveEdit() {
    if (!editModal) return;
    setEditSaving(true);
    try {
      await api.superadmin.updateRestaurant(editModal.id, editForm);
      showMsg("Restaurante actualizado");
      setEditModal(null);
      await loadData();
    } catch (err: any) { showMsg("Error: " + (err.message || "desconocido"), true); }
    finally { setEditSaving(false); }
  }

  // ─── Credentials Modal ────────────────────────────────────
  function openCreds(r: Restaurant) {
    setCredsModal({ id: r.id, name: r.name });
    setCredsForm({ username: "", password: "", name: "" });
  }
  async function handleSaveCreds() {
    if (!credsModal) return;
    setCredsSaving(true);
    try {
      const data: Record<string, string> = {};
      if (credsForm.username) data.username = credsForm.username;
      if (credsForm.password) data.password = credsForm.password;
      if (credsForm.name) data.name = credsForm.name;
      await api.superadmin.updateAdmin(credsModal.id, data);
      showMsg("Credenciales actualizadas");
      setCredsModal(null);
    } catch (err: any) { showMsg("Error: " + (err.message || "desconocido"), true); }
    finally { setCredsSaving(false); }
  }

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold text-text">SuperAdmin — Comanda</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn btn-ghost p-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-sm text-text-muted">{user?.name}</span>
          <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface-2 px-4 gap-1">
        {([
          { id: "overview" as const, label: "Vista General", icon: TrendingUp },
          { id: "restaurants" as const, label: "Restaurantes", icon: Building2 },
          { id: "new" as const, label: "Nuevo", icon: Plus },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id ? "border-b-2 border-accent text-accent" : "text-text-muted hover:text-text"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {actionMsg && (
        <div className={`mx-4 mt-3 rounded-lg px-4 py-2 text-sm ${actionMsg.includes("Error") ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>
          {actionMsg}
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* ═══════ OVERVIEW ═══════ */}
            {tab === "overview" && <OverviewPanel metrics={metrics} restaurants={restaurants} />}

            {/* ═══════ RESTAURANTS ═══════ */}
            {tab === "restaurants" && (
              <div className="rounded-xl border border-border bg-surface-2 overflow-hidden">
                <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text-muted">
                    Todos los restaurantes ({restaurants.length})
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {restaurants.map((r) => (
                    <RestaurantRow
                      key={r.id}
                      restaurant={r}
                      onSuspend={() => suspendRestaurant(r.id)}
                      onReactivate={() => reactivateRestaurant(r.id)}
                      onChangePlan={(plan) => r.subscription && changePlan(r.subscription.id, plan)}
                      onEdit={() => openEdit(r)}
                      onDelete={() => handleDeleteRestaurant(r.id, r.name)}
                      onCreds={() => openCreds(r)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ═══════ NEW RESTAURANT ═══════ */}
            {tab === "new" && (
              <div className="mx-auto max-w-2xl">
                <form onSubmit={handleCreate} className="space-y-6">
                  {/* Cards in a grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* ─── Restaurant Card ─── */}
                    <div className="rounded-2xl border border-border bg-surface-2 p-5 sm:col-span-2">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
                        <Store className="h-4 w-4 text-accent" /> Datos del Restaurante
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="mb-1 block text-xs text-text-muted">Nombre *</label>
                            <input
                              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                              placeholder="La Parrilla de Juan"
                              value={form.name}
                              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: generateSlug(e.target.value) }))}
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-text-muted">Slug *</label>
                            <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent font-mono"
                              value={form.slug}
                              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
                            <p className="mt-0.5 text-[10px] text-text-muted">comanda.app/{form.slug || "..."}</p>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-text-muted">Tipo</label>
                            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                              value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                              {Object.entries(RESTAURANT_TYPES).map(([k, v]) => (
                                <option key={k} value={k}>{v.emoji} {v.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-text-muted">Dirección</label>
                            <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                              placeholder="Av. Principal 123" value={form.address}
                              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-text-muted">Teléfono</label>
                            <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                              placeholder="+593 9X XXXXXXX" value={form.phone}
                              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ─── Admin Card ─── */}
                    <div className="rounded-2xl border border-border bg-surface-2 p-5">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
                        <User className="h-4 w-4 text-info" /> Administrador
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs text-text-muted">Nombre completo *</label>
                          <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                            placeholder="Dueño o admin" value={form.adminName}
                            onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} required />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-text-muted">Email *</label>
                          <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                            type="email" placeholder="admin@restaurante.com" value={form.adminEmail}
                            onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} required />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-text-muted">Contraseña *</label>
                          <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                            type="password" placeholder="Mínimo 6 caracteres" value={form.adminPassword}
                            onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} required />
                        </div>
                      </div>
                    </div>

                    {/* ─── Plan Card ─── */}
                    <div className="rounded-2xl border border-border bg-surface-2 p-5">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
                        <CreditCard className="h-4 w-4 text-purple-400" /> Plan
                      </h3>
                      <div className="space-y-2">
                        {PLANS.map((p) => (
                          <button
                            type="button" key={p}
                            onClick={() => setForm((f) => ({ ...f, plan: p }))}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition ${
                              form.plan === p
                                ? "border-accent bg-accent/5 text-accent font-bold"
                                : "border-border text-text-muted hover:border-accent/30"
                            }`}
                          >
                            <span>{p}</span>
                            <span className="text-xs opacity-70">{planPrices[p]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  {formError && <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{formError}</div>}
                  {formSuccess && <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{formSuccess}</div>}

                  {/* Submit */}
                  <button type="submit" disabled={creating}
                    className="btn btn-primary w-full gap-2 py-3.5 text-base font-bold shadow-lg shadow-accent/20">
                    {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    Crear Restaurante
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* ══════════ EDIT MODAL ══════════ */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-surface-2 p-6 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text">Editar {editModal.name}</h3>
              <button onClick={() => setEditModal(null)} className="btn btn-ghost p-1.5"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">Nombre</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                  value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Slug</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text font-mono outline-none focus:border-accent"
                  value={editForm.slug} onChange={e => setEditForm({...editForm, slug: e.target.value})} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Tipo</label>
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                  value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                  {Object.entries(RESTAURANT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Dirección</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                  value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Teléfono</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                  value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="btn btn-primary w-full gap-2 py-2.5">
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CREDENTIALS MODAL ══════════ */}
      {credsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCredsModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface-2 p-6 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text">
                <Key className="h-4 w-4 inline mr-1.5 text-warning" />
                Credenciales Admin
              </h3>
              <button onClick={() => setCredsModal(null)} className="btn btn-ghost p-1.5"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-4 text-sm text-text-muted">Restaurante: {credsModal.name}</p>
            <p className="mb-3 text-xs text-text-muted">Deja vacío para no cambiar ese campo.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">Nombre</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                  placeholder="Nuevo nombre" value={credsForm.name}
                  onChange={e => setCredsForm({...credsForm, name: e.target.value})} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Usuario</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text font-mono outline-none focus:border-accent"
                  placeholder="admin-nuevo" value={credsForm.username}
                  onChange={e => setCredsForm({...credsForm, username: e.target.value})} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Nueva contraseña</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                  type="password" placeholder="••••••" value={credsForm.password}
                  onChange={e => setCredsForm({...credsForm, password: e.target.value})} />
              </div>
              <button onClick={handleSaveCreds} disabled={credsSaving}
                className="btn btn-primary w-full gap-2 py-2.5">
                {credsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Actualizar Credenciales
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Panel ─────────────────────────────────────────

function OverviewPanel({ metrics, restaurants }: { metrics: Metrics | null; restaurants: Restaurant[] }) {
  const revenue = restaurants.reduce((s, r) => s + (r.subscription?.price || 0), 0);
  return (
    <div className="space-y-6">
      {metrics && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SACard icon={Building2} label="Restaurantes" value={metrics.totalRestaurants} color="text-info" />
          <SACard icon={CheckCircle} label="Activos" value={metrics.activeRestaurants} color="text-success" />
          <SACard icon={TrendingUp} label="Nuevos (mes)" value={metrics.newThisMonth} color="text-purple" />
          <SACard icon={CreditCard} label="Ingreso mensual" value={`$${revenue.toFixed(0)}`} color="text-warning" />
        </div>
      )}

      {metrics?.subscriptionsByPlan && (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-muted">Por plan</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {metrics.subscriptionsByPlan.map((sp) => (
              <div key={sp.plan} className="rounded-xl bg-surface px-3 py-3 text-center border border-border">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${planColors[sp.plan] || "bg-surface-3"}`}>
                  {sp.plan}
                </span>
                <p className="mt-1.5 text-2xl font-bold text-text">{sp._count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <h3 className="mb-3 text-sm font-medium text-text-muted">Últimos registros</h3>
        <div className="space-y-2">
          {restaurants.slice(0, 5).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
              <span className="text-lg">{RESTAURANT_TYPES[r.type]?.emoji || "🏪"}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-text">{r.name}</p>
                <p className="text-xs text-text-muted">/{r.slug} · {r._count.users} usuarios</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planColors[r.subscription?.plan || ""]}`}>
                {r.subscription?.plan || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SACard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number | string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Restaurant Row ─────────────────────────────────────────

function RestaurantRow({ restaurant: r, onSuspend, onReactivate, onChangePlan, onEdit, onDelete, onCreds }: {
  restaurant: Restaurant;
  onSuspend: () => void;
  onReactivate: () => void;
  onChangePlan: (plan: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreds: () => void;
}) {
  const typeInfo = RESTAURANT_TYPES[r.type] || RESTAURANT_TYPES.OTRO;
  const StatusIcon = statusIcons[r.subscription?.status || ""] || Clock;
  const sc = statusColors[r.subscription?.status || ""] || "text-text-muted";

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${r.active ? "bg-accent/10" : "bg-danger/10"}`}>
            <span className="text-xl">{typeInfo.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-text truncate">{r.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planColors[r.subscription?.plan || ""]}`}>
                {r.subscription?.plan || "—"}
              </span>
              <StatusIcon className={`h-3.5 w-3.5 ${sc}`} />
              {!r.active && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">SUSPENDIDO</span>}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              /{r.slug} · {typeInfo.label} · Creado {new Date(r.createdAt).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            {r.address && <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{r.address}</p>}
            {r.phone && <p className="text-xs text-text-muted flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</p>}
            <div className="flex gap-4 mt-1.5 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r._count.users} usuarios</span>
              <span>{r._count.menuItems} prod.</span>
              <span>{r._count.orders} órdenes</span>
              {r.subscription?.trialEndsAt && r.subscription.status === "TRIAL" && (
                <span className="text-info">Trial → {new Date(r.subscription.trialEndsAt).toLocaleDateString("es-EC")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 pt-1">
          <select
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
            value={r.subscription?.plan || "FREE"}
            onChange={(e) => onChangePlan(e.target.value)}
          >
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={onCreds} className="btn btn-ghost p-1.5 text-info" title="Credenciales">
            <Key className="h-4 w-4" />
          </button>
          <button onClick={onEdit} className="btn btn-ghost p-1.5 text-info" title="Editar">
            <Edit3 className="h-4 w-4" />
          </button>
          {r.active ? (
            <button onClick={onSuspend} className="btn btn-ghost p-1.5 text-warning" title="Suspender">
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={onReactivate} className="btn btn-ghost p-1.5 text-success" title="Reactivar">
              <Play className="h-4 w-4" />
            </button>
          )}
          <button onClick={onDelete} className="btn btn-ghost p-1.5 text-danger" title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
