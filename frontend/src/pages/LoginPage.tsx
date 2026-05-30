import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { navigate } from "../App";
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login, loading, error, clearError, redirectPath } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(username, password);
      navigate(redirectPath);
    } catch {
      // error is set in useAuth
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <UtensilsCrossed className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text">Comanda</h1>
          <p className="mt-1 text-sm text-text-muted">Sistema de gestión para restaurantes</p>
        </div>

        {/* Form */}
        <div className="rounded-xl bg-surface-2 p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-text-muted">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-text outline-none transition focus:border-accent"
                placeholder="cocina1"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-muted">Contraseña</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-3 pr-10 text-text outline-none transition focus:border-accent"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn btn-primary w-full text-base disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>
        </div>

        {/* Register link */}
        <p className="mt-4 text-center text-sm text-text-muted">
          ¿No tienes cuenta?{" "}
          <button
            onClick={() => navigate("/registro")}
            className="text-accent hover:underline"
          >
            Registra tu restaurante
          </button>
        </p>

        {/* Dev credentials */}
        {import.meta.env.DEV && (
          <div className="mt-6 rounded-lg border border-border/50 bg-surface-2/50 p-3">
            <p className="mb-2 text-xs font-medium text-text-muted">Credenciales de desarrollo:</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-text-muted">
              {[
                ["Admin", "admin"],
                ["Caja", "caja1"],
                ["Cocina 1", "cocina1"],
                ["Cocina 2", "cocina2"],
                ["Mesero", "mesero1"],
                ["Super", "superadmin"],
              ].map(([label, un]) => (
                <button
                  key={un}
                  onClick={() => { setUsername(un); setPassword("12345678"); }}
                  className="rounded px-2 py-1 text-left hover:bg-surface-3"
                >
                  <span className="font-medium text-accent">{label}</span>
                  <br />{un}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
