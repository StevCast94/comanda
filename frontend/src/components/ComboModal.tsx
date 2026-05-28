import { useState, useMemo } from "react";
import type { Combo, MenuItem } from "../types";
import { X, Check, ShoppingCart } from "lucide-react";

interface Props {
  combo: Combo;
  products: MenuItem[];
  onConfirm: (combo: Combo, selections: Record<string, string>, selectionNames: Record<string, string>) => void;
  onClose: () => void;
}

interface GroupOption {
  groupName: string;
  defaultItemId: string;
  isOptional: boolean;
  options: Array<{ id: string; name: string }>;
}

export default function ComboModal({ combo, products, onConfirm, onClose }: Props) {
  // Build selection groups from combo items
  const groups = useMemo(() => {
    const gMap = new Map<string, GroupOption>();

    for (const ci of combo.comboItems) {
      const group = ci.groupName || ci.menuItem.name;

      if (!gMap.has(group)) {
        gMap.set(group, {
          groupName: group,
          defaultItemId: ci.isDefault ? ci.menuItemId : "",
          isOptional: ci.isOptional,
          options: [],
        });
      }

      const g = gMap.get(group)!;

      // Add the main item
      if (!g.options.find((o) => o.id === ci.menuItemId)) {
        g.options.push({ id: ci.menuItemId, name: ci.menuItem.name });
      }

      // Add alternatives
      try {
        const altIds: string[] = typeof ci.alternatives === "string"
          ? JSON.parse(ci.alternatives)
          : Array.isArray(ci.alternatives) ? ci.alternatives : [];

        for (const altId of altIds) {
          if (!g.options.find((o) => o.id === altId)) {
            const p = products.find((pr) => pr.id === altId);
            if (p) g.options.push({ id: p.id, name: p.name });
          }
        }
      } catch { /* no alternatives */ }

      // Set default
      if (ci.isDefault && !g.defaultItemId) {
        g.defaultItemId = ci.menuItemId;
      }
    }

    return Array.from(gMap.values());
  }, [combo, products]);

  // Initialize selections with defaults
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      if (g.defaultItemId) init[g.groupName] = g.defaultItemId;
      else if (!g.isOptional && g.options.length > 0) init[g.groupName] = g.options[0].id;
    }
    return init;
  });

  const [optionalIncluded, setOptionalIncluded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of groups) {
      if (g.isOptional) init[g.groupName] = g.defaultItemId !== "";
    }
    return init;
  });

  function handleSelect(groupName: string, itemId: string) {
    setSelections((s) => ({ ...s, [groupName]: itemId }));
  }

  function toggleOptional(groupName: string) {
    setOptionalIncluded((s) => ({ ...s, [groupName]: !s[groupName] }));
  }

  function handleConfirm() {
    // Build final selections (exclude unchecked optionals)
    const finalSelections: Record<string, string> = {};
    const finalNames: Record<string, string> = {};

    for (const g of groups) {
      if (g.isOptional && !optionalIncluded[g.groupName]) continue;
      const selectedId = selections[g.groupName];
      if (selectedId) {
        finalSelections[g.groupName] = selectedId;
        const opt = g.options.find((o) => o.id === selectedId);
        finalNames[g.groupName] = opt?.name || "";
      }
    }

    onConfirm(combo, finalSelections, finalNames);
  }

  // Check all required groups have a selection
  const isValid = groups.every((g) => {
    if (g.isOptional) return true;
    return !!selections[g.groupName];
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl bg-surface-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-text">{combo.name}</h2>
            {combo.description && <p className="mt-0.5 text-sm text-text-muted">{combo.description}</p>}
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2"><X className="h-5 w-5" /></button>
        </div>

        {/* Groups */}
        <div className="max-h-[55vh] overflow-y-auto p-5 space-y-5">
          {groups.map((g) => (
            <div key={g.groupName}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-accent">
                  {g.groupName}
                  {!g.isOptional && <span className="ml-1 text-danger">*</span>}
                </h3>
                {g.isOptional && (
                  <button
                    onClick={() => toggleOptional(g.groupName)}
                    className={`rounded px-2 py-0.5 text-xs transition ${
                      optionalIncluded[g.groupName] ? "bg-accent/10 text-accent" : "bg-surface-3 text-text-muted"
                    }`}
                  >
                    {optionalIncluded[g.groupName] ? "Incluido" : "No incluir"}
                  </button>
                )}
              </div>

              {(!g.isOptional || optionalIncluded[g.groupName]) && (
                <div className="space-y-1">
                  {g.options.length === 1 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2.5">
                      <Check className="h-4 w-4 text-accent" />
                      <span className="text-sm text-text">{g.options[0].name}</span>
                    </div>
                  ) : (
                    g.options.map((opt) => {
                      const selected = selections[g.groupName] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelect(g.groupName, opt.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                            selected
                              ? "bg-accent/10 border border-accent/40"
                              : "bg-surface border border-transparent hover:bg-surface-3"
                          }`}
                        >
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            selected ? "border-accent bg-accent" : "border-border"
                          }`}>
                            {selected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className={`text-sm ${selected ? "text-text font-medium" : "text-text-muted"}`}>
                            {opt.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-text-muted">Precio del combo</span>
            <span className="text-xl font-bold text-accent">${combo.basePrice.toFixed(2)}</span>
          </div>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="btn btn-primary w-full gap-2 text-base disabled:opacity-50"
          >
            <ShoppingCart className="h-5 w-5" />
            Agregar a la orden
          </button>
        </div>
      </div>
    </div>
  );
}
