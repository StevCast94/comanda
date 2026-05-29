import { useState } from "react";
import type { CashRegister } from "../types";
import { X, DollarSign, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  mode: "open" | "close";
  register?: CashRegister | null;
  onSubmit: (balance: number, notes?: string) => Promise<any>;
  onClose: () => void;
}

export default function CashRegisterModal({ mode, register, onSubmit, onClose }: Props) {
  const [balance, setBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ verification: { realSales: number; expectedBalance: number; closingBalance: number; discrepancy: number; closingDiscrepancy: number; breakdown: { cash: number; card: number; transfer: number } } } | null>(null);

  async function handleSubmit() {
    const val = parseFloat(balance);
    if (isNaN(val) || val < 0) { setError("Ingresa un monto válido"); return; }
    setLoading(true); setError(null);
    try {
      const res = await onSubmit(val, notes || undefined);
      if (res?.verification) setResult(res);
      else onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); } finally { setLoading(false); }
  }

  async function handleSubmit() {
    const val = parseFloat(balance);
    if (isNaN(val) || val < 0) {
      setError("Ingresa un monto válido");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(val, notes || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const isClose = mode === "close";
  const expectedBalance = isClose && register
    ? register.openingBalance + register.totalSales
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold text-text">
              {isClose ? "Cerrar caja" : "Abrir caja"}
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {/* Close mode: show summary */}
          {isClose && register && (
            <div className="rounded-lg bg-surface p-3 text-sm space-y-1">
              <div className="flex justify-between text-text-muted">
                <span>Balance inicial</span>
                <span>${register.openingBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Ventas totales</span>
                <span className="text-accent">${register.totalSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>  Efectivo</span>
                <span>${register.totalCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>  Tarjeta</span>
                <span>${register.totalCard.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>  Transferencia</span>
                <span>${register.totalTransfer.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold text-text">
                <span>Balance esperado</span>
                <span className="text-accent">${expectedBalance.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-text-muted">
              {isClose ? "Balance real en caja ($)" : "Balance inicial ($)"}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-text outline-none focus:border-accent"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {isClose && (
            <div>
              <label className="mb-1 block text-sm text-text-muted">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
                rows={2}
                placeholder="Observaciones del cierre..."
              />
            </div>
          )}

          {/* Difference warning for close */}
          {isClose && balance && !isNaN(parseFloat(balance)) && (
            (() => {
              const diff = parseFloat(balance) - expectedBalance;
              if (Math.abs(diff) < 0.01) return null;
              return (
                <div className={`rounded-lg px-3 py-2 text-sm ${diff > 0 ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"}`}>
                  {diff > 0 ? `Sobrante: +$${diff.toFixed(2)}` : `Faltante: -$${Math.abs(diff).toFixed(2)}`}
                </div>
              );
            })()
          )}

          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
          )}

          {result ? (
            <div className="space-y-2 rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm">
              <div className="flex items-center gap-2">
                {result.verification.closingDiscrepancy !== 0
                  ? <AlertTriangle className="h-5 w-5 text-warning" />
                  : <CheckCircle className="h-5 w-5 text-accent" />}
                <span className="font-bold text-text">
                  {result.verification.closingDiscrepancy !== 0 ? "⚠️ Discrepancia" : "✅ Cierre verificado"}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-text-muted"><span>Ventas reales (órdenes)</span><span className="text-accent">${result.verification.realSales.toFixed(2)}</span></div>
                <div className="flex justify-between text-text-muted"><span>Efectivo</span><span>${result.verification.breakdown.cash.toFixed(2)}</span></div>
                <div className="flex justify-between text-text-muted"><span>Tarjeta</span><span>${result.verification.breakdown.card.toFixed(2)}</span></div>
                <div className="flex justify-between text-text-muted"><span>Transferencia</span><span>${result.verification.breakdown.transfer.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-text border-t border-border pt-1 mt-1"><span>Balance esperado</span><span>$${result.verification.expectedBalance.toFixed(2)}</span></div>
                <div className="flex justify-between text-text-muted"><span>Balance declarado</span><span>$${result.verification.closingBalance.toFixed(2)}</span></div>
                {result.verification.closingDiscrepancy !== 0 && (
                  <div className="flex justify-between text-danger font-bold"><span>Diferencia</span><span>{result.verification.closingDiscrepancy > 0 ? "+" : ""}${result.verification.closingDiscrepancy.toFixed(2)}</span></div>
                )}
              </div>
              <button onClick={onClose} className="btn btn-primary w-full mt-2">Cerrar</button>
            </div>
          ) : (
            <button onClick={handleSubmit} disabled={loading || !balance}
              className="btn btn-primary w-full text-base disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isClose ? "Cerrar caja" : "Abrir caja"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
