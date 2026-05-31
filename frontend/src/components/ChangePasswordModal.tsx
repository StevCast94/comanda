import { useState } from "react";
import { Key, X, Loader2, Eye, EyeOff } from "lucide-react";
import * as api from "../services/api";

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 6) { setMsg("Mínimo 6 caracteres"); return; }
    if (newPw !== confirm) { setMsg("Las contraseñas no coinciden"); return; }
    setSaving(true); setMsg("");
    try {
      await api.auth.changePassword(current, newPw);
      setOk(true);
    } catch (err: any) {
      setMsg(err.message || "Error");
    }
    setSaving(false);
  }

  if (ok) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="rounded-2xl bg-surface-2 p-6 shadow-2xl border border-success/30 text-center" onClick={e => e.stopPropagation()}>
          <p className="text-2xl mb-2">✅</p>
          <p className="font-bold text-text">Contraseña actualizada</p>
          <button onClick={onClose} className="btn btn-primary mt-4">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface-2 p-6 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text flex items-center gap-2"><Key className="h-5 w-5 text-warning" />Cambiar contraseña</h3>
          <button onClick={onClose} className="btn btn-ghost p-1.5"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Contraseña actual</label>
            <input type={show ? "text" : "password"} value={current} onChange={e => setCurrent(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Nueva contraseña</label>
            <div className="relative">
              <input type={show ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 pr-10 text-sm text-text outline-none focus:border-accent" required minLength={6} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Confirmar nueva contraseña</label>
            <input type={show ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent" required />
          </div>
          {msg && <div className="text-sm text-danger">{msg}</div>}
          <button type="submit" disabled={saving || !current || !newPw}
            className="btn btn-primary w-full gap-2 py-2.5 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            Actualizar contraseña
          </button>
        </form>
      </div>
    </div>
  );
}
