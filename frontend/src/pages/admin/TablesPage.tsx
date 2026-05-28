import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import * as api from "../../services/api";
import type { Table } from "../../types";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";

export default function TablesPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState("");
  const [newFloor, setNewFloor] = useState("Piso 1");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const floors = (user?.restaurant?.settings?.floors as string[]) || ["Piso 1"];

  async function load() {
    try {
      const res = await api.settings.tables();
      setTables(res.data || []);
    } catch {
      setError("Error cargando mesas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addTable() {
    if (!newNumber || isNaN(Number(newNumber))) return;
    setAdding(true); setError("");
    try {
      await api.settings.addTable(Number(newNumber), newFloor);
      setNewNumber("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteTable(id: string) {
    try {
      await api.settings.deleteTable(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  const groupedByFloor: Record<string, Table[]> = {};
  for (const t of tables) {
    const f = t.floor || "Sin piso";
    if (!groupedByFloor[f]) groupedByFloor[f] = [];
    groupedByFloor[f].push(t);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Gestión de Mesas</h2>
        <span className="text-sm text-text-muted">{tables.length} mesas</span>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Add table form */}
      <div className="rounded-xl border border-border bg-surface-2 p-4">
        <h3 className="mb-3 text-sm font-medium text-text-muted">Agregar mesa</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-text-muted">Número</label>
            <input
              type="number"
              min="1"
              placeholder="Ej: 13"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              className="input w-24"
              onKeyDown={(e) => e.key === "Enter" && addTable()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-text-muted">Piso</label>
            <select value={newFloor} onChange={(e) => setNewFloor(e.target.value)} className="input">
              {floors.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <button onClick={addTable} disabled={adding} className="btn btn-primary">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Agregar</span>
          </button>
        </div>
      </div>

      {/* Tables by floor */}
      {Object.entries(groupedByFloor).map(([floor, floorTables]) => (
        <div key={floor} className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-medium text-text">{floor}</h3>
            <span className="text-xs text-text-muted">({floorTables.length})</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {floorTables
              .sort((a, b) => a.number - b.number)
              .map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center justify-between rounded-lg bg-surface px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-text">M{t.number}</span>
                  <button
                    onClick={() => deleteTable(t.id)}
                    className="opacity-0 transition group-hover:opacity-100"
                    title="Eliminar mesa"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger/60 hover:text-danger" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
