import { useState, useEffect, useCallback } from "react";
import * as api from "../../services/api";
import {
  Plus, Pencil, Trash2, X, Loader2, Save,
  ToggleLeft, ToggleRight, UserCircle, Shield,
} from "lucide-react";

interface UserRow {
  id: string; email: string; username: string; name: string;
  role: string; phone: string | null; active: boolean;
  lastLogin: string | null; createdAt: string;
}

const ROLES = [
  { value: "CASHIER", label: "Cajero/a", color: "bg-blue-500/10 text-blue-400" },
  { value: "COOK_1", label: "Cocina", color: "bg-orange-500/10 text-orange-400" },
  { value: "COOK_2", label: "Parrilla", color: "bg-orange-500/10 text-orange-400" },
  { value: "WAITER", label: "Mesero/a", color: "bg-green-500/10 text-green-400" },
  { value: "DELIVERY", label: "Delivery", color: "bg-indigo-500/10 text-indigo-400" },
  { value: "ADMIN", label: "Admin", color: "bg-red-500/10 text-red-400" },
];

function roleBadge(role: string) {
  const r = ROLES.find((x) => x.value === role);
  return r || { label: role, color: "bg-surface-3 text-text-muted" };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", username: "", password: "",
    role: "CASHIER", phone: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users: u } = await api.users.list();
      setUsers(u);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ name: "", email: "", username: "", password: "", role: "CASHIER", phone: "" });
    setEditing("new"); setError(null);
  }

  function openEdit(u: UserRow) {
    setForm({ name: u.name, email: u.email, username: u.username, password: "", role: u.role, phone: u.phone || "" });
    setEditing(u); setError(null);
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (editing === "new") {
        await api.users.create({ ...form, phone: form.phone || undefined });
      } else if (editing) {
        const data: Record<string, unknown> = { name: form.name, email: form.email, username: form.username, role: form.role, phone: form.phone || null };
        if (form.password) data.password = form.password;
        await api.users.update(editing.id, data);
      }
      setEditing(null); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    setSaving(false);
  }

  async function handleToggle(id: string) {
    try { await api.users.toggleActive(id); load(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
    try { await api.users.remove(id); load(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  }

  // ─── Form ─────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text">{editing === "new" ? "Nuevo usuario" : `Editar: ${(editing as UserRow).name}`}</h3>
          <button onClick={() => setEditing(null)} className="btn btn-ghost p-1"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Nombre completo *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Username *</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">{editing === "new" ? "Contraseña *" : "Nueva contraseña (dejar vacío para no cambiar)"}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" placeholder={editing !== "new" ? "••••••" : ""} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Rol *</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Teléfono</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent" />
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave}
            disabled={saving || !form.name || !form.email || !form.username || (editing === "new" && !form.password)}
            className="btn btn-primary gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    );
  }

  // ─── List ─────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-muted">{users.length} usuarios</p>
        <button onClick={openNew} className="btn btn-primary gap-1 text-sm"><Plus className="h-4 w-4" /> Nuevo usuario</button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => {
          const rb = roleBadge(u.role);
          return (
            <div key={u.id} className={`rounded-xl border border-border bg-surface-2 p-4 ${!u.active ? "opacity-50" : ""}`}>
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-8 w-8 text-text-muted" />
                  <div>
                    <p className="text-sm font-medium text-text">{u.name}</p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${rb.color}`}>{rb.label}</span>
              </div>
              <div className="mb-3 text-xs text-text-muted">
                <p>@{u.username}{u.phone ? ` · ${u.phone}` : ""}</p>
                <p>Último login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Nunca"}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <button onClick={() => handleToggle(u.id)} className="flex items-center gap-1 text-xs text-text-muted">
                  {u.active ? <ToggleRight className="h-4 w-4 text-accent" /> : <ToggleLeft className="h-4 w-4" />}
                  {u.active ? "Activo" : "Inactivo"}
                </button>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(u)} className="btn btn-ghost p-1.5"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(u.id)} className="btn btn-ghost p-1.5 text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
