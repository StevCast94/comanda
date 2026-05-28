import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import * as api from "../../services/api";
import {
  LogOut, Shield, Building2, Users, TrendingUp,
  RefreshCw, Loader2, CheckCircle, XCircle, Clock,
  CreditCard, AlertTriangle,
} from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  subscription: {
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

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "restaurants">("overview");

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
      <div className="flex border-b border-border bg-surface-2 px-4">
        {(["overview", "restaurants"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === t ? "border-b-2 border-accent text-accent" : "text-text-muted hover:text-text"
            }`}
          >
            {t === "overview" ? "Vista general" : "Restaurantes"}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : tab === "overview" ? (
          <div className="space-y-6">
            {/* KPIs */}
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

            {/* Plans breakdown */}
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

            {/* Recent restaurants */}
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="mb-3 text-sm font-medium text-text-muted">Últimos registros</h3>
              <div className="space-y-2">
                {restaurants.slice(0, 5).map((r) => (
                  <RestaurantRow key={r.id} restaurant={r} planColors={planColors} statusIcons={statusIcons} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Restaurants list */
          <div className="rounded-xl border border-border bg-surface-2 overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium text-text-muted">
                Todos los restaurantes ({restaurants.length})
              </h3>
            </div>
            <div className="divide-y divide-border">
              {restaurants.map((r) => (
                <RestaurantRow key={r.id} restaurant={r} planColors={planColors} statusIcons={statusIcons} expanded />
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

function RestaurantRow({ restaurant: r, planColors, statusIcons, expanded }: {
  restaurant: Restaurant;
  planColors: Record<string, string>;
  statusIcons: Record<string, typeof CheckCircle>;
  expanded?: boolean;
}) {
  const StatusIcon = statusIcons[r.subscription?.status || ""] || Clock;
  const statusColor = r.subscription?.status === "ACTIVE" || r.subscription?.status === "TRIAL"
    ? "text-accent" : "text-danger";

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${r.active ? "bg-accent/10" : "bg-danger/10"}`}>
          <Building2 className={`h-4 w-4 ${r.active ? "text-accent" : "text-danger"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-text">{r.name}</p>
          <p className="text-xs text-text-muted">/{r.slug} · Creado {new Date(r.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {expanded && (
          <div className="hidden text-right text-xs text-text-muted sm:block">
            <p>{r._count.users} usuarios</p>
            <p>{r._count.menuItems} productos · {r._count.orders} órdenes</p>
          </div>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${planColors[r.subscription?.plan || ""] || "bg-surface-3 text-text-muted"}`}>
          {r.subscription?.plan || "SIN PLAN"}
        </span>
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
      </div>
    </div>
  );
}
