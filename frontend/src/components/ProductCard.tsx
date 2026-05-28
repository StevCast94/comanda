import type { MenuItem } from "../types";
import { Plus } from "lucide-react";

interface Props {
  product: MenuItem;
  onAdd: () => void;
}

const KITCHEN_BADGES: Record<string, { label: string; color: string }> = {
  KITCHEN_1: { label: "C1", color: "bg-blue-500/20 text-blue-400" },
  KITCHEN_2: { label: "C2", color: "bg-orange-500/20 text-orange-400" },
  BAR: { label: "BAR", color: "bg-purple-500/20 text-purple-400" },
  BOTH: { label: "C1+C2", color: "bg-yellow-500/20 text-yellow-400" },
};

export default function ProductCard({ product, onAdd }: Props) {
  const badge = KITCHEN_BADGES[product.kitchen];
  const hasMods = product.modifiers && product.modifiers.length > 0;

  return (
    <button
      onClick={onAdd}
      className="group flex flex-col rounded-xl border border-border bg-surface-2 p-3 text-left transition hover:border-accent/50 hover:bg-surface-3 active:scale-[0.97]"
    >
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-medium leading-tight text-text">{product.name}</span>
        {badge && (
          <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-bold ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <span className="mt-0.5 line-clamp-1 text-xs text-text-muted">{product.description}</span>
      )}

      {/* Modifiers hint */}
      {hasMods && (
        <span className="mt-1 text-[10px] text-accent">
          +{product.modifiers.length} opciones
        </span>
      )}

      {/* Bottom: price + add */}
      <div className="mt-auto flex items-end justify-between pt-2">
        <span className="text-base font-bold text-accent">${product.basePrice.toFixed(2)}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent transition group-hover:bg-accent group-hover:text-white">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}
