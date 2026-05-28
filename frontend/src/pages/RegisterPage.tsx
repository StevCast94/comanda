import { useState, type FormEvent } from "react";
import { navigate } from "../App";
import { register } from "../services/api";
import { UtensilsCrossed, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({
    restaurantName: "", slug: "", address: "", phone: "",
    adminName: "", adminEmail: "", adminPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === "restaurantName") {
      setForm((f) => ({
        ...f,
        [key]: val,
        slug: val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register.create(form);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle className="h-8 w-8 text-accent" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-text">¡Restaurante registrado!</h2>
          <p className="mb-6 text-text-muted">
            Tu prueba gratuita de 14 días ha comenzado. Inicia sesión con tu email para configurar tu restaurante.
          </p>
          <button onClick={() => navigate("/login")} className="btn btn-primary w-full">
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <button onClick={() => navigate("/login")} className="btn btn-ghost mb-4 gap-2 px-0 text-sm">
          <ArrowLeft className="h-4 w-4" /> Volver al login
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <UtensilsCrossed className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">Registra tu restaurante</h1>
            <p className="text-sm text-text-muted">14 días gratis, sin tarjeta</p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-2 p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-accent">Restaurante</legend>
              <input
                placeholder="Nombre del restaurante"
                value={form.restaurantName}
                onChange={(e) => set("restaurantName", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
                required
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">comanda.app/</span>
                <input
                  placeholder="mi-restaurante"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
                  required
                />
              </div>
              <input
                placeholder="Dirección (opcional)"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
              />
              <input
                placeholder="Teléfono (opcional)"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
              />
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium text-accent">Administrador</legend>
              <input
                placeholder="Tu nombre completo"
                value={form.adminName}
                onChange={(e) => set("adminName", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
                required
              />
              <input
                type="email"
                placeholder="tu@email.com"
                value={form.adminEmail}
                onChange={(e) => set("adminEmail", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
                required
              />
              <input
                type="password"
                placeholder="Contraseña (mín. 6 caracteres)"
                value={form.adminPassword}
                onChange={(e) => set("adminPassword", e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none focus:border-accent"
                required
                minLength={6}
              />
            </fieldset>

            {error && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !form.restaurantName || !form.slug || !form.adminName || !form.adminEmail || !form.adminPassword}
              className="btn btn-primary w-full text-base disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Crear restaurante"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
