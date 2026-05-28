import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import * as api from "../../services/api";
import {
  LogOut, Shield, Building2, Users, TrendingUp,
  RefreshCw, Loader2, CheckCircle, XCircle, Clock,
  CreditCard, AlertTriangle, Plus, Pause, Play, Edit3,
  Store, ChefHat, Coffee, Beer, Flame, Fish, Pizza,
  UtensilsCrossed, GlassWater, HelpCircle, Trash2,
} from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  type: string;
  active: boolean;
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

const RESTAURANT_TYPES: Record<string, { label: string; icon: typeof Store }> = {
  COMIDA_RAPIDA: { label: "Comida Rápida", icon: ChefHat },
  CEVICHERIA: { label: "Cevichería", icon: Fish },
  COCKTELERIA: { label: "Cocktelería", icon: GlassWater },
  BAR: { label: "Bar", icon: Beer },
  PARRILLADA: { label: "Parrillada", icon: Flame },
  RESTAURANTE: { label: "Restaurante", icon: UtensilsCrossed },
  CAFETERIA: { label: "Cafetería", icon: Coffee },
  PIZZERIA: { label: "Pizzería", icon: Pizza },
  MARISQUERIA: { label: "Marisquería", icon: Fish },
  OTRO: { label: "Otro", icon: HelpCircle },
};

const PLANS = ["FREE", "TRIAL", "BASIC", "PRO", "ENTERPRISE"];

const planColors: Record<string, string> = {
  FREE: "bg-gray-500/10 text-gray-400",
  TRIAL: "bg-blue-500/10 text-blue-400",
  BASIC: "bg-cyan-500/10 text-cyan-400",
  PRO: "bg-accent/10 text-accent",
  ENTERPRISE: "bg-purple-500/10 text-purple-400",
};

const statusIcons: Record<string, typeof CheckCircle> = {
  ACTIVE: CheckCircle,
  TRIAL: Clock,
  PAST_DUE: AlertTriangle,
  CANCELED: XCircle,
  EXPIRED: XCircle,
};

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "restaurants" | "new">("overview");

  // Form state for new restaurant
  const [form, setForm] = useState({
    name: "", slug: "", type: "RESTAURANTE", address: "", phone: "",
    adminName: "", adminEmail: "", adminPassword: "",
    plan: "TRIAL" as string,
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Action feedback
  const [actionMsg, setActionMsg] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [restRes, metRes] = await Promise.all([
        api.superadmin.restaurants(),
        api.superadmin.metrics(),
      ]);
      setRestaurants(restRes.restaurants as Restaurant[]);
      setMetrics(metRes as unknown as Metrics);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

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
    } finally {
      setCreating(false);
    }
  }

  async function suspendRestaurant(id: string) {
    try {
      await api.superadmin.suspendRestaurant(id);
      setActionMsg("Restaurante suspendido");
      await loadData();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err: any) {
      setActionMsg("Error: " + (err.message || "desconocido"));
    }
  }

  async function reactivateRestaurant(id: string) {
    try {
      await api.superadmin.reactivateRestaurant(id);
      setActionMsg("Restaurante reactivado");
      await loadData();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err: any) {
      setActionMsg("Error: " + (err.message || "desconocido"));
    }
  }

  async function changePlan(subId: string, newPlan: string) {
    try {
      await api.superadmin.updateSubscription(subId, newPlan);
      setActionMsg(`Plan cambiado a ${newPlan}`);
      await loadData();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err: any) {
      setActionMsg("Error: " + (err.message || "desconocido"));
    }
  }

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 50);
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
          { id: "overview", label: "Vista General" },
          { id: "restaurants", label: "Restaurantes" },
          { id: "new", label: "+ Nuevo" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id ? "border-b-2 border-accent text-accent" : "text-text-muted hover:text-text"
            }`}
          >
            {t.id === "new" && <Plus className="h-3.5 w-3.5 mr-1 inline" />}
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
        ) : tab === "new" ? (
          /* ═══════ NEW RESTAURANT FORM ═══════ */
          <div className="mx-auto max-w-lg">
            <div className="rounded-xl border border-border bg-surface-2 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-text">
                <Plus className="h-5 w-5 text-accent" />
                Nuevo Restaurante
              </h2>

              {formError && (
                <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{formError}</div>
              )}
              {formSuccess && (
                <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">{formSuccess}</div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Restaurant info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-text-muted">Datos del restaurante</h3>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">Nombre</label>
                    <input
                      className="input w-full"
                      placeholder="Ej: La Parrilla de Juan"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: generateSlug(e.target.value) }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-text-muted">Slug</label>
                      <input className="input w-full" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
                      <p className="mt-0.5 text-[10px] text-text-muted">URL: comanda.app/{form.slug || "slug"}</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-muted">Tipo</label>
                      <select className="input w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                        {Object.entries(RESTAURANT_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">Dirección</label>
                    <input className="input w-full" placeholder="Dirección del local" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">Teléfono</label>
                    <input className="input w-full" placeholder="+593 9X XXXXXXX" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>

                {/* Admin user */}
                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-medium text-text-muted">Administrador</h3>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">Nombre completo</label>
                    <input className="input w-full" placeholder="Dueño o administrador" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">Email</label>
                    <input className="input w-full" type="email" placeholder="admin@restaurante.com" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">Contraseña</label>
                    <input className="input w-full" type="password" placeholder="Mínimo 6 caracteres" value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} required />
                  </div>
                </div>

                {/* Plan */}
                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-medium text-text-muted">Plan de suscripción</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {PLANS.map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setForm((f) => ({ ...f, plan: p }))}
                        className={`rounded-lg border px-2 py-2 text-center text-xs font-bold transition ${
                          form.plan === p
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-text-muted hover:border-accent/50"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={creating} className="btn btn-primary w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>Crear Restaurante</span>
                </button>
              </form>
            </div>
          </div>
        ) : tab === "overview" ? (
          /* ═══════ OVERVIEW ═══════ */
          <div className="space-y-6">
            {metrics && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SACard icon={Building2} label="Restaurantes" value={metrics.totalRestaurants} color="text-accent" />
                <SACard icon={CheckCircle} label="Activos" value={metrics.activeRestaurants} color="text-accent" />
                <SACard icon={TrendingUp} label="Nuevos este mes" value={metrics.newThisMonth} color="text-info" />
                <SACard
                  icon={CreditCard}
                  label="Ingreso mensual"
                  value={`$${restaurants.reduce((s, r) => s + (r.subscription?.price || 0), 0).toFixed(0)}`}
                  color="text-warning"
                />
              </div>
            )}

            {metrics?.subscriptionsByPlan && (
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <h3 className="mb-3 text-sm font-medium text-text-muted">Distribución por plan</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {metrics.subscriptionsByPlan.map((sp) => (
                    <div key={sp.plan} className="rounded-lg bg-surface px-3 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${planColors[sp.plan] || "bg-surface-3 text-text-muted"}`}>
                        {sp.plan}
                      </span>
                      <p className="mt-1 text-xl font-bold text-text">{sp._count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="mb-3 text-sm font-medium text-text-muted">Últimos registros</h3>
              <div className="space-y-2">
                {restaurants.slice(0, 5).map((r) => (
                  <RestaurantRowMini key={r.id} restaurant={r} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ═══════ RESTAURANTS LIST ═══════ */
          <div className="rounded-xl border border-border bg-surface-2 overflow-hidden">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-muted">
                Todos los restaurantes ({restaurants.length})
              </h3>
            </div>
            <div className="divide-y divide-border">
              {restaurants.map((r) => (
                <RestaurantRowExpanded
                  key={r.id}
                  restaurant={r}
                  onSuspend={() => suspendRestaurant(r.id)}
                  onReactivate={() => reactivateRestaurant(r.id)}
                  onChangePlan={(plan) => r.subscription && changePlan(r.subscription.id, plan)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SACard({ icon: Icon, label, value, color }: {
  icon: typeof Building2; label: string; value: number | string; color: string;
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

function RestaurantRowMini({ restaurant: r }: { restaurant: Restaurant }) {
  const typeInfo = RESTAURANT_TYPES[r.type] || RESTAURANT_TYPES.OTRO;
  const TypeIcon = typeInfo.icon;
  const StatusIcon = statusIcons[r.subscription?.status || ""] || Clock;
  const statusColor = r.subscription?.status === "ACTIVE" || r.subscription?.status === "TRIAL" ? "text-accent" : "text-danger";

  return (
    <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${r.active ? "bg-accent/10" : "bg-danger/10"}`}>
          <TypeIcon className={`h-4 w-4 ${r.active ? "text-accent" : "text-danger"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-text">{r.name}</p>
          <p className="text-xs text-text-muted">{typeInfo.label} · /{r.slug}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${planColors[r.subscription?.plan || ""]}`}>{r.subscription?.plan || "—"}</span>
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
      </div>
    </div>
  );
}

function RestaurantRowExpanded({ restaurant: r, onSuspend, onReactivate, onChangePlan }: {
  restaurant: Restaurant;
  onSuspend: () => void;
  onReactivate: () => void;
  onChangePlan: (plan: string) => void;
}) {
  const typeInfo = RESTAURANT_TYPES[r.type] || RESTAURANT_TYPES.OTRO;
  const TypeIcon = typeInfo.icon;
  const StatusIcon = statusIcons[r.subscription?.status || ""] || Clock;
  const statusColor = r.subscription?.status === "ACTIVE" || r.subscription?.status === "TRIAL" ? "text-accent" : "text-danger";

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${r.active ? "bg-accent/10" : "bg-danger/10"}`}>
            <TypeIcon className={`h-5 w-5 ${r.active ? "text-accent" : "text-danger"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-text">{r.name}</p>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted">{typeInfo.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planColors[r.subscription?.plan || ""]}`}>
                {r.subscription?.plan || "—"}
              </span>
              <StatusIcon className={`h-3.5 w-3.5 ${statusColor}`} />
              {!r.active && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">SUSPENDIDO</span>}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              /{r.slug} · Creado {new Date(r.createdAt).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })}
              {r.subscription?.trialEndsAt && r.subscription.status === "TRIAL" && (
                <span className="ml-2 text-info">· Trial hasta {new Date(r.subscription.trialEndsAt).toLocaleDateString("es-EC")}</span>
              )}
            </p>
            <div className="flex gap-4 mt-1.5 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r._count.users} usuarios</span>
              <span>{r._count.menuItems} productos</span>
              <span>{r._count.orders} órdenes</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Change plan */}
          <select
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
            value={r.subscription?.plan || "FREE"}
            onChange={(e) => onChangePlan(e.target.value)}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Suspend / Reactivate */}
          {r.active ? (
            <button onClick={onSuspend} className="btn btn-ghost p-1.5 text-warning" title="Suspender">
              <Pause className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={onReactivate} className="btn btn-ghost p-1.5 text-accent" title="Reactivar">
              <Play className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
