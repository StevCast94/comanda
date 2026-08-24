import { useState, useEffect, useCallback } from "react";
import * as api from "../services/api";
import type { Ticket, TicketStatus } from "../types";
import {
  LifeBuoy, Plus, X, Send, Loader2, CheckCircle2, Clock, MessageCircle, Building2,
} from "lucide-react";

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En progreso",
  CLOSED: "Cerrado",
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  OPEN: "bg-warning/10 text-warning",
  IN_PROGRESS: "bg-info/10 text-info",
  CLOSED: "bg-surface-3 text-text-muted",
};

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

interface Props {
  scope: "admin" | "superadmin";
}

export default function TicketsPanel({ scope }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { tickets: list } = await api.tickets.list();
      setTickets(list);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openTicket(t: Ticket) {
    try {
      const { ticket } = await api.tickets.get(t.id);
      setSelected(ticket);
    } catch { /* ignore */ }
  }

  async function handleCreate() {
    if (!newSubject.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      await api.tickets.create({ subject: newSubject, body: newBody });
      setShowNew(false);
      setNewSubject("");
      setNewBody("");
      await load();
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function handleReply() {
    if (!selected || !replyBody.trim()) return;
    setSubmitting(true);
    try {
      const { ticket } = await api.tickets.reply(selected.id, replyBody);
      setSelected(ticket);
      setReplyBody("");
      await load();
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function handleClose() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const { ticket } = await api.tickets.close(selected.id);
      setSelected(ticket);
      await load();
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  // ─── Detail view ────────────────────────────────────────
  if (selected) {
    return (
      <div className="mx-auto max-w-2xl">
        <button onClick={() => setSelected(null)} className="btn btn-ghost mb-3 text-sm text-text-muted">
          ← Volver a tickets
        </button>
        <div className="rounded-xl border border-border bg-surface-2">
          <div className="flex items-start justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="font-bold text-text">{selected.subject}</h3>
              {scope === "superadmin" && (
                <p className="flex items-center gap-1 text-xs text-text-muted">
                  <Building2 className="h-3 w-3" />{selected.restaurant.name}
                </p>
              )}
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[selected.status]}`}>
              {STATUS_LABEL[selected.status]}
            </span>
          </div>

          <div className="max-h-96 space-y-3 overflow-y-auto p-4">
            {(selected.messages || []).map((m) => (
              <div key={m.id} className={`rounded-lg p-3 text-sm ${m.user.role === "SUPERADMIN" ? "bg-accent/10" : "bg-surface"}`}>
                <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                  <span className="font-medium text-text">{m.user.name}</span>
                  <span>{timeAgo(m.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-text">{m.body}</p>
              </div>
            ))}
          </div>

          {selected.status !== "CLOSED" ? (
            <div className="border-t border-border p-3">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Escribe una respuesta..."
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
              <div className="mt-2 flex justify-between gap-2">
                <button onClick={handleClose} disabled={submitting} className="btn btn-ghost text-sm text-danger">
                  Cerrar ticket
                </button>
                <button onClick={handleReply} disabled={submitting || !replyBody.trim()} className="btn btn-primary gap-2 text-sm">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Responder
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-border p-3 text-center text-sm text-text-muted">
              <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-accent" />
              Ticket cerrado
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── New ticket form ────────────────────────────────────
  if (showNew) {
    return (
      <div className="mx-auto max-w-lg">
        <button onClick={() => setShowNew(false)} className="btn btn-ghost mb-3 text-sm text-text-muted">← Cancelar</button>
        <div className="rounded-xl border border-border bg-surface-2 p-5">
          <h3 className="mb-4 font-bold text-text">Nuevo ticket de soporte</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Asunto</label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                placeholder="Ej: No puedo imprimir comandas"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Descripción</label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
                placeholder="Describe el problema con el mayor detalle posible..."
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={submitting || !newSubject.trim() || !newBody.trim()}
              className="btn btn-primary w-full gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── List view ──────────────────────────────────────────
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
        </h3>
        {scope === "admin" && (
          <button onClick={() => setShowNew(true)} className="btn btn-primary gap-2 text-sm">
            <Plus className="h-4 w-4" />Nuevo ticket
          </button>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <LifeBuoy className="mb-3 h-14 w-14 opacity-20" />
          <p className="text-lg font-medium">Sin tickets</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{t.subject}</p>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {scope === "superadmin" && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{t.restaurant.name}</span>}
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{t._count?.messages ?? 0}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(t.updatedAt)}</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[t.status]}`}>
                {STATUS_LABEL[t.status]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
