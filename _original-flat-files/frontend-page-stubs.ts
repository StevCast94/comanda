import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { usePOS } from "../../hooks/usePOS";
import ProductCard from "../../components/ProductCard";
import OrderPanel from "../../components/OrderPanel";
import ComboModal from "../../components/ComboModal";
import CashRegisterModal from "../../components/CashRegisterModal";
import {
  LogOut, Search, X, ShoppingCart, Loader2,
  DollarSign, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Combo } from "../../types";

export default function POSPage() {
  const { user, logout } = useAuth();
  const pos = usePOS();
  const [showCashModal, setShowCashModal] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"menu" | "order">("menu");

  if (pos.loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // ─── No cash register open ────────────────────────────────
  if (!pos.cashRegister) {
    return (
      <div className="flex h-screen flex-col bg-surface">
        <POSHeader user={user} logout={logout} register={null} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <DollarSign className="h-16 w-16 text-warning" />
          <h2 className="text-xl font-bold text-text">Caja cerrada</h2>
          <p className="text-text-muted">Necesitas abrir la caja para empezar a cobrar.</p>
          <button onClick={() => setShowCashModal(true)} className="btn btn-primary text-base">
            Abrir caja
          </button>
        </div>
        {showCashModal && (
          <CashRegisterModal
            mode="open"
            onSubmit={async (balance) => { await pos.openCashRegister(balance); setShowCashModal(false); }}
            onClose={() => setShowCashModal(false)}
          />
        )}
      </div>
    );
  }

  const cartCount = pos.cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="flex h-screen flex-col bg-surface">
      <POSHeader
        user={user}
        logout={logout}
        register={pos.cashRegister}
        onCloseCash={() => setShowCashModal(true)}
      />

      {/* Error banner */}
      {pos.error && (
        <div className="flex items-center gap-2 bg-danger/10 px-4 py-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{pos.error}</span>
          <button onClick={() => pos.set("error", null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Mobile tab toggle */}
      <div className="flex border-b border-border lg:hidden">
        <button
          onClick={() => setMobilePanel("menu")}
          className={`flex-1 py-2 text-center text-sm font-medium transition ${mobilePanel === "menu" ? "border-b-2 border-accent text-accent" : "text-text-muted"}`}
        >
          Menú
        </button>
        <button
          onClick={() => setMobilePanel("order")}
          className={`flex-1 py-2 text-center text-sm font-medium transition ${mobilePanel === "order" ? "border-b-2 border-accent text-accent" : "text-text-muted"}`}
        >
          Orden {cartCount > 0 && <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">{cartCount}</span>}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT: Menu Panel ──────────────────────────────── */}
        <div className={`flex flex-1 flex-col overflow-hidden ${mobilePanel === "order" ? "hidden lg:flex" : "flex"}`}>
          {/* Category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface-2 px-3 py-2 scrollbar-none">
            <button
              onClick={() => pos.set("selectedCategory", null)}
              className={`btn shrink-0 px-3 py-1.5 text-sm ${!pos.selectedCategory ? "bg-accent text-white" : "btn-ghost"}`}
            >
              Todos
            </button>
            {pos.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => pos.set("selectedCategory", cat.id)}
                className={`btn shrink-0 px-3 py-1.5 text-sm ${pos.selectedCategory === cat.id ? "bg-accent text-white" : "btn-ghost"}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="border-b border-border bg-surface-2 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={pos.search}
                onChange={(e) => pos.set("search", e.target.value)}
                placeholder="Buscar producto..."
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-text outline-none focus:border-accent"
              />
              {pos.search && (
                <button onClick={() => pos.set("search", "")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Combos section */}
            {pos.filteredCombos.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Combos</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {pos.filteredCombos.map((combo) => (
                    <button
                      key={combo.id}
                      onClick={() => pos.set("showComboModal", combo)}
                      className="flex flex-col rounded-xl border border-accent/30 bg-accent/5 p-3 text-left transition hover:bg-accent/10 active:scale-[0.98]"
                    >
                      <span className="text-sm font-medium text-text">{combo.name}</span>
                      {combo.description && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-text-muted">{combo.description}</span>
                      )}
                      <span className="mt-auto pt-2 text-base font-bold text-accent">${combo.basePrice.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Products */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {pos.filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => pos.addProduct(product)}
                />
              ))}
            </div>

            {pos.filteredProducts.length === 0 && pos.filteredCombos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <Search className="mb-2 h-8 w-8" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Order Panel ────────────────────────────── */}
        <div className={`w-full border-l border-border lg:w-[380px] xl:w-[420px] ${mobilePanel === "menu" ? "hidden lg:flex lg:flex-col" : "flex flex-col"}`}>
          <OrderPanel
            cart={pos.cart}
            tables={pos.tables}
            selectedTable={pos.selectedTable}
            customerName={pos.customerName}
            orderType={pos.orderType}
            totals={pos.totals}
            settings={pos.settings}
            products={pos.products}
            submitting={pos.submitting}
            onSelectTable={(t) => pos.set("selectedTable", t)}
            onSetCustomerName={(n) => pos.set("customerName", n)}
            onSetOrderType={(t) => pos.set("orderType", t)}
            onUpdateQuantity={pos.updateQuantity}
            onRemoveItem={pos.removeItem}
            onUpdateNotes={pos.updateItemNotes}
            onToggleModifier={pos.toggleModifier}
            onClearCart={pos.clearCart}
            onSubmitOrder={pos.submitOrder}
          />
        </div>
      </div>

      {/* ─── Combo Modal ──────────────────────────────────── */}
      {pos.showComboModal && (
        <ComboModal
          combo={pos.showComboModal}
          products={pos.products}
          onConfirm={pos.addComboToCart}
          onClose={() => pos.set("showComboModal", null)}
        />
      )}

      {/* ─── Cash Register Modal ──────────────────────────── */}
      {showCashModal && (
        <CashRegisterModal
          mode="close"
          register={pos.cashRegister}
          onSubmit={async (balance, notes) => {
            await pos.closeCashRegister(balance, notes);
            setShowCashModal(false);
          }}
          onClose={() => setShowCashModal(false)}
        />
      )}

      {/* Mobile FAB: go to order */}
      {mobilePanel === "menu" && cartCount > 0 && (
        <button
          onClick={() => setMobilePanel("order")}
          className="btn btn-primary fixed bottom-6 right-6 z-50 gap-2 rounded-full px-5 py-3 shadow-lg lg:hidden"
        >
          <ShoppingCart className="h-5 w-5" />
          Ver orden ({cartCount})
        </button>
      )}
    </div>
  );
}

// ─── POS Header ─────────────────────────────────────────────

function POSHeader({
  user, logout, register, onCloseCash,
}: {
  user: import("../../types").User | null;
  logout: () => void;
  register: import("../../types").CashRegister | null;
  onCloseCash?: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-5 w-5 text-accent" />
        <h1 className="text-base font-bold text-text">POS</h1>
      </div>
      <div className="flex items-center gap-2">
        {register && (
          <button onClick={onCloseCash} className="btn btn-ghost gap-1 px-2 py-1 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">${register.totalSales.toFixed(2)}</span>
          </button>
        )}
        <span className="text-sm text-text-muted">{user?.name}</span>
        <button onClick={logout} className="btn btn-ghost p-2"><LogOut className="h-4 w-4" /></button>
      </div>
    </header>
  );
}
