import { useState, useEffect, useCallback } from "react";
import * as api from "../../services/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  Calendar, TrendingUp, Award, Clock, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type { DailySummary } from "../../types";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function shortDate(s: string): string {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("es", { weekday: "short", day: "numeric" });
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"daily" | "weekly" | "top">("daily");
  const [date, setDate] = useState(formatDate(new Date()));
  const [loading, setLoading] = useState(true);

  // Daily
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [hourly, setHourly] = useState<Array<{ label: string; sales: number; orders: number }>>([]);

  // Weekly
  const [dailySales, setDailySales] = useState<Array<{ date: string; sales: number; orders: number }>>([]);

  // Top
  const [topProducts, setTopProducts] = useState<Array<{ name: string; quantity: number; revenue: number; category: string }>>([]);

  const loadDaily = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        api.reports.summary(d),
        api.reports.hourly(d),
      ]);
      setSummary(s);
      setHourly(h.hourly);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadWeekly = useCallback(async () => {
    setLoading(true);
    try {
      const to = formatDate(new Date());
      const from = formatDate(addDays(new Date(), -6));
      const res = await api.reports.sales(from, to);
      setDailySales(res.daily);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadTop = useCallback(async () => {
    setLoading(true);
    try {
      const to = formatDate(new Date());
      const from = formatDate(addDays(new Date(), -30));
      const res = await api.reports.topProducts(from, to, 10);
      setTopProducts(res.topProducts);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "daily") loadDaily(date);
    else if (tab === "weekly") loadWeekly();
    else if (tab === "top") loadTop();
  }, [tab, date, loadDaily, loadWeekly, loadTop]);

  function moveDate(delta: number) {
    const d = addDays(new Date(date + "T12:00:00"), delta);
    setDate(formatDate(d));
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface p-1">
        {([
          { id: "daily" as const, label: "Día", icon: Calendar },
          { id: "weekly" as const, label: "Semana", icon: TrendingUp },
          { id: "top" as const, label: "Top productos", icon: Award },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`btn gap-1.5 px-3 py-1.5 text-sm ${tab === t.id ? "bg-accent text-white" : "btn-ghost"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      )}

      {/* ─── DAILY ─────────────────────────────────────────── */}
      {!loading && tab === "daily" && (
        <div className="space-y-4">
          {/* Date picker */}
          <div className="flex items-center gap-2">
            <button onClick={() => moveDate(-1)} className="btn btn-ghost p-2"><ChevronLeft className="h-4 w-4" /></button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none" />
            <button onClick={() => moveDate(1)} className="btn btn-ghost p-2"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {/* KPIs */}
          {summary && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KPI label="Ventas" value={`$${summary.totalSales.toFixed(2)}`} color="text-accent" />
              <KPI label="Órdenes" value={String(summary.totalOrders)} color="text-info" />
              <KPI label="Ticket prom." value={`$${summary.avgTicket.toFixed(2)}`} color="text-warning" />
              <KPI label="Canceladas" value={String(summary.cancelled)} color="text-danger" />
            </div>
          )}

          {/* Hourly chart */}
          {hourly.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-text-muted">
                <Clock className="h-4 w-4" /> Ventas por hora
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                    labelStyle={{ color: "#f1f5f9" }}
                    formatter={(val: number) => [`$${val.toFixed(2)}`, "Ventas"]}
                  />
                  <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Payment pie */}
          {summary && summary.totalOrders > 0 && (
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <h3 className="mb-3 text-sm font-medium text-text-muted">Métodos de pago</h3>
              <div className="flex items-center justify-center gap-8">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Efectivo", value: summary.byPaymentMethod.cash },
                        { name: "Tarjeta", value: summary.byPaymentMethod.card },
                        { name: "Transferencia", value: summary.byPaymentMethod.transfer },
                      ].filter((d) => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value"
                    >
                      {[0, 1, 2].map((i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-sm">
                  <LegendItem color={COLORS[0]} label="Efectivo" value={summary.byPaymentMethod.cash} />
                  <LegendItem color={COLORS[1]} label="Tarjeta" value={summary.byPaymentMethod.card} />
                  <LegendItem color={COLORS[2]} label="Transfer." value={summary.byPaymentMethod.transfer} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── WEEKLY ────────────────────────────────────────── */}
      {!loading && tab === "weekly" && (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-muted">Ventas últimos 7 días</h3>
          {dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySales.map((d) => ({ ...d, label: shortDate(d.date) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} name="Ventas ($)" />
                <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} name="Órdenes" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-text-muted">Sin datos para el período</p>
          )}
        </div>
      )}

      {/* ─── TOP PRODUCTS ──────────────────────────────────── */}
      {!loading && tab === "top" && (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-muted">Top 10 productos (últimos 30 días)</h3>
          {topProducts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                    labelStyle={{ color: "#f1f5f9" }}
                  />
                  <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>

              {/* Table */}
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-xs text-text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-left">Categoría</th>
                      <th className="px-3 py-2 text-right">Cant.</th>
                      <th className="px-3 py-2 text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProducts.map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-bold text-accent">{i + 1}</td>
                        <td className="px-3 py-2 text-text">{p.name}</td>
                        <td className="px-3 py-2 text-text-muted">{p.category}</td>
                        <td className="px-3 py-2 text-right text-text">{p.quantity}</td>
                        <td className="px-3 py-2 text-right font-medium text-accent">${p.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-text-muted">Sin datos de ventas en el período</p>
          )}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text">${value.toFixed(2)}</span>
    </div>
  );
}
