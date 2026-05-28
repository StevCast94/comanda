import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Category, MenuItem, Combo, Table, CartItem,
  CashRegister, PaymentMethod, KitchenStation, RestaurantSettings,
} from "../types";
import * as api from "../services/api";

interface POSState {
  categories: Category[];
  products: MenuItem[];
  combos: Combo[];
  tables: Table[];
  cart: CartItem[];
  selectedCategory: string | null;
  selectedTable: Table | null;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  cashRegister: CashRegister | null;
  settings: RestaurantSettings;
  loading: boolean;
  error: string | null;
  search: string;
  showComboModal: Combo | null;
}

const defaultSettings: RestaurantSettings = {
  taxRate: 0.15,
  serviceRate: 0.10,
  defaultTip: 0,
};

export function usePOS() {
  const [state, setState] = useState<POSState>({
    categories: [],
    products: [],
    combos: [],
    tables: [],
    cart: [],
    selectedCategory: null,
    selectedTable: null,
    customerName: "",
    orderType: "DINE_IN",
    cashRegister: null,
    settings: defaultSettings,
    loading: true,
    error: null,
    search: "",
    showComboModal: null,
  });

  const set = useCallback(<K extends keyof POSState>(key: K, val: POSState[K]) => {
    setState((s) => ({ ...s, [key]: val }));
  }, []);

  // ─── Load initial data ────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [catRes, prodRes, comboRes, tableRes, crRes, restRes] = await Promise.all([
          api.categories.list(),
          api.products.list({ active: true }),
          api.combos.list(),
          api.settings.tables(),
          api.cashRegister.current(),
          api.settings.restaurant(),
        ]);
        setState((s) => ({
          ...s,
          categories: catRes.categories,
          products: prodRes.products,
          combos: comboRes.combos,
          tables: tableRes.tables,
          cashRegister: crRes.register,
          settings: (restRes.restaurant.settings as RestaurantSettings) || defaultSettings,
          selectedCategory: catRes.categories[0]?.id || null,
          loading: false,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Error cargando datos",
        }));
      }
    }
    load();
  }, []);

  // ─── Filtered products by category and search ─────────────
  const filteredProducts = useMemo(() => {
    let items = state.products;
    if (state.selectedCategory) {
      items = items.filter((p) => p.categoryId === state.selectedCategory);
    }
    if (state.search.trim()) {
      const q = state.search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    return items;
  }, [state.products, state.selectedCategory, state.search]);

  // ─── Filtered combos by category ─────────────────────────
  const filteredCombos = useMemo(() => {
    if (!state.selectedCategory) return state.combos;
    return state.combos.filter((c) => c.categoryId === state.selectedCategory);
  }, [state.combos, state.selectedCategory]);

  // ─── Cart operations (optimistic) ─────────────────────────

  const addProduct = useCallback((product: MenuItem) => {
    setState((s) => {
      const existing = s.cart.find(
        (c) => c.menuItemId === product.id && !c.comboId && c.modifiers.length === 0 && !c.notes
      );
      if (existing) {
        return {
          ...s,
          cart: s.cart.map((c) =>
            c.tempId === existing.tempId ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      const item: CartItem = {
        tempId: crypto.randomUUID(),
        menuItemId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.basePrice,
        kitchen: product.kitchen,
        notes: "",
        modifiers: [],
      };
      return { ...s, cart: [...s.cart, item] };
    });
  }, []);

  const addComboToCart = useCallback((
    combo: Combo,
    selections: Record<string, string>,
    selectionNames: Record<string, string>
  ) => {
    setState((s) => {
      // Determine kitchen station: if combo has protein items → BOTH, else based on items
      const kitchens = combo.comboItems.map((ci) => ci.menuItem.kitchen);
      const kitchen: KitchenStation = kitchens.includes("KITCHEN_2") ? "BOTH" : "KITCHEN_1";

      const item: CartItem = {
        tempId: crypto.randomUUID(),
        comboId: combo.id,
        name: combo.name,
        quantity: 1,
        unitPrice: combo.basePrice,
        kitchen,
        notes: "",
        modifiers: [],
        comboSelections: selectionNames,
      };
      return { ...s, cart: [...s.cart, item], showComboModal: null };
    });
  }, []);

  const updateQuantity = useCallback((tempId: string, delta: number) => {
    setState((s) => {
      const cart = s.cart
        .map((c) => c.tempId === tempId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
        .filter((c) => c.quantity > 0);
      return { ...s, cart };
    });
  }, []);

  const removeItem = useCallback((tempId: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((c) => c.tempId !== tempId) }));
  }, []);

  const updateItemNotes = useCallback((tempId: string, notes: string) => {
    setState((s) => ({
      ...s,
      cart: s.cart.map((c) => c.tempId === tempId ? { ...c, notes } : c),
    }));
  }, []);

  const toggleModifier = useCallback((tempId: string, mod: { modifierId: string; name: string; priceAdjustment: number }) => {
    setState((s) => ({
      ...s,
      cart: s.cart.map((c) => {
        if (c.tempId !== tempId) return c;
        const exists = c.modifiers.find((m) => m.modifierId === mod.modifierId);
        return {
          ...c,
          modifiers: exists
            ? c.modifiers.filter((m) => m.modifierId !== mod.modifierId)
            : [...c.modifiers, mod],
        };
      }),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState((s) => ({ ...s, cart: [], selectedTable: null, customerName: "" }));
  }, []);

  // ─── Totals ───────────────────────────────────────────────
  const totals = useMemo(() => {
    const subtotal = state.cart.reduce((sum, item) => {
      const modTotal = item.modifiers.reduce((s, m) => s + m.priceAdjustment, 0);
      return sum + (item.unitPrice + modTotal) * item.quantity;
    }, 0);
    const taxAmount = Math.round(subtotal * state.settings.taxRate * 100) / 100;
    const serviceAmount = Math.round(subtotal * state.settings.serviceRate * 100) / 100;
    const total = Math.round((subtotal + taxAmount + serviceAmount) * 100) / 100;
    return { subtotal, taxAmount, serviceAmount, total };
  }, [state.cart, state.settings]);

  // ─── Submit order ─────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  const submitOrder = useCallback(async (paymentMethod: PaymentMethod) => {
    if (state.cart.length === 0) return;
    if (state.orderType === "DINE_IN" && !state.selectedTable) {
      set("error", "Selecciona una mesa");
      return;
    }
    if (!state.cashRegister) {
      set("error", "No hay caja abierta");
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        tableId: state.selectedTable?.id,
        customerName: state.customerName || undefined,
        orderType: state.orderType,
        paymentMethod,
        items: state.cart.map((c) => ({
          menuItemId: c.menuItemId,
          comboId: c.comboId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          notes: c.notes || undefined,
          kitchen: c.kitchen,
          modifiers: c.modifiers,
          comboSelections: c.comboSelections,
        })),
      };
      const { order } = await api.orders.create(orderData);
      clearCart();
      return order;
    } catch (err) {
      set("error", err instanceof Error ? err.message : "Error al crear orden");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [state.cart, state.selectedTable, state.customerName, state.orderType, state.cashRegister, clearCart, set]);

  // ─── Cash register operations ─────────────────────────────
  const openCashRegister = useCallback(async (balance: number) => {
    const { register } = await api.cashRegister.open(balance);
    set("cashRegister", register);
    return register;
  }, [set]);

  const closeCashRegister = useCallback(async (balance: number, notes?: string) => {
    const { register } = await api.cashRegister.close(balance, notes);
    set("cashRegister", null);
    return register;
  }, [set]);

  return {
    ...state,
    set,
    filteredProducts,
    filteredCombos,
    addProduct,
    addComboToCart,
    updateQuantity,
    removeItem,
    updateItemNotes,
    toggleModifier,
    clearCart,
    totals,
    submitOrder,
    submitting,
    openCashRegister,
    closeCashRegister,
  };
}
