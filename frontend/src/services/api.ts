const BASE = import.meta.env.VITE_API_URL || "/api";

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("comanda_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Error de conexión" }));
    const err = new ApiError(res.status, body.error || "Error desconocido", body.code);

    // Auto-logout on 401
    if (res.status === 401) {
      localStorage.removeItem("comanda_token");
      localStorage.removeItem("comanda_user");
      window.location.hash = "#/login";
    }
    throw err;
  }

  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────

export const auth = {
  login: (username: string, password: string) =>
    request<{ token: string; user: import("../types").User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ user: import("../types").User }>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// ─── Register ───────────────────────────────────────────────

export const register = {
  create: (data: {
    restaurantName: string; slug: string; address?: string; phone?: string;
    adminName: string; adminEmail: string; adminPassword: string;
  }) => request<{ message: string; restaurant: { id: string; name: string; slug: string } }>("/register", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  plans: () => request<{ plans: Array<{ id: string; name: string; price: number; billing: string }> }>("/plans"),
};

// ─── Categories ─────────────────────────────────────────────

export const categories = {
  list: (all?: boolean) => request<{ categories: import("../types").Category[] }>(`/categories${all ? "?all=true" : ""}`),
  create: (data: { name: string; type: string; sortOrder?: number }) =>
    request<{ category: import("../types").Category }>("/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; type: string; sortOrder: number; active: boolean }>) =>
    request<{ category: import("../types").Category }>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => request<{ message: string }>(`/categories/${id}`, { method: "DELETE" }),
};

// ─── Products ───────────────────────────────────────────────

export const products = {
  list: (params?: { category?: string; kitchen?: string; active?: boolean; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.kitchen) q.set("kitchen", params.kitchen);
    if (params?.active !== undefined) q.set("active", String(params.active));
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return request<{ products: import("../types").MenuItem[] }>(`/products${qs ? `?${qs}` : ""}`);
  },
  create: (data: Record<string, unknown>) =>
    request<{ product: import("../types").MenuItem }>("/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ product: import("../types").MenuItem }>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleActive: (id: string) =>
    request<{ product: import("../types").MenuItem }>(`/products/${id}/toggle-active`, { method: "PATCH" }),
  remove: (id: string) => request<{ message: string }>(`/products/${id}`, { method: "DELETE" }),
  addModifier: (productId: string, data: { name: string; priceAdjustment: number }) =>
    request<{ modifier: import("../types").Modifier }>(`/products/${productId}/modifiers`, { method: "POST", body: JSON.stringify(data) }),
  deleteModifier: (modId: string) =>
    request<{ message: string }>(`/products/modifiers/${modId}`, { method: "DELETE" }),
};

// ─── Combos ─────────────────────────────────────────────────

export const combos = {
  list: (category?: string, all?: boolean) => {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (all) q.set("all", "true");
    const qs = q.toString();
    return request<{ combos: import("../types").Combo[] }>(`/combos${qs ? `?${qs}` : ""}`);
  },
  create: (data: Record<string, unknown>) =>
    request<{ combo: import("../types").Combo }>("/combos", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ combo: import("../types").Combo }>(`/combos/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => request<{ message: string }>(`/combos/${id}`, { method: "DELETE" }),
};

// ─── Users ──────────────────────────────────────────────────

export const users = {
  list: () => request<{ users: Array<{ id: string; email: string; username: string; name: string; role: string; phone: string | null; active: boolean; lastLogin: string | null; createdAt: string }> }>("/users"),
  create: (data: { email: string; username: string; password: string; name: string; role: string; phone?: string }) =>
    request<{ user: Record<string, unknown> }>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ user: Record<string, unknown> }>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleActive: (id: string) =>
    request<{ user: Record<string, unknown> }>(`/users/${id}/toggle-active`, { method: "PATCH" }),
  remove: (id: string) => request<{ message: string }>(`/users/${id}`, { method: "DELETE" }),
};

// ─── Orders ─────────────────────────────────────────────────

export const orders = {
  create: (data: {
    tableId?: string; customerName?: string; orderType: string;
    status?: "PENDING" | "PAID";
    paymentMethod?: string; notes?: string;
    waiterId?: string;
    customerAddress?: string; customerPhone?: string; deliveryZoneId?: string;
    items: Array<{
      menuItemId?: string; comboId?: string; quantity: number; unitPrice: number;
      notes?: string; kitchen: string;
      modifiers?: Array<{ modifierId: string; name: string; priceAdjustment: number }>;
      comboSelections?: Record<string, string>;
    }>;
  }) => request<{ order: import("../types").Order }>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  list: (params?: { status?: string; date?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.date) q.set("date", params.date);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<{ orders: import("../types").Order[]; total: number }>(`/orders${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => request<{ order: import("../types").Order }>(`/orders/${id}`),

  updateStatus: (id: string, status: string, reason?: string) =>
    request<{ order: import("../types").Order }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),

  confirmPayment: (id: string, paymentMethod: string) =>
    request<{ order: import("../types").Order }>(`/orders/${id}/confirm-payment`, {
      method: "PATCH",
      body: JSON.stringify({ paymentMethod }),
    }),

  live: () => request<{ orders: import("../types").Order[] }>("/orders/live"),

  updateItems: (id: string, items: Array<{
    menuItemId?: string;
    comboId?: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    kitchen?: string;
    modifiers?: Array<{ modifierId: string; name: string; priceAdjustment: number }>;
    comboSelections?: Record<string, string>;
  }>) => request<{ order: import("../types").Order }>(`/orders/${id}/items`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  }),

  delete: (id: string) => request<{ message: string }>(`/orders/${id}`, { method: "DELETE" }),
};

// ─── Kitchen ────────────────────────────────────────────────

export const kitchen = {
  orders: (kitchenStation?: string, status?: string) => {
    const q = new URLSearchParams();
    if (kitchenStation) q.set("kitchen", kitchenStation);
    if (status) q.set("status", status);
    const qs = q.toString();
    return request<{ orders: import("../types").KDSOrder[] }>(`/kitchen/orders${qs ? `?${qs}` : ""}`);
  },

  updateItemStatus: (itemId: string, status: string) =>
    request<{ item: import("../types").OrderItem; allReady: boolean }>(`/kitchen/items/${itemId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

// ─── Waiter ─────────────────────────────────────────────────

export const waiter = {
  pending: () => request<{ orders: import("../types").Order[] }>("/waiter/pending"),
  deliver: (orderId: string) =>
    request<{ order: import("../types").Order }>(`/waiter/deliver/${orderId}`, { method: "PATCH" }),
};

// ─── Delivery ───────────────────────────────────────────────

export const delivery = {
  zones: () => request<{ zones: import("../types").DeliveryZone[] }>("/delivery/zones"),
  createZone: (data: { name: string; fee: number; estimatedMin?: number }) =>
    request<{ zone: import("../types").DeliveryZone }>("/delivery/zones", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  drivers: () => request<{ drivers: Array<{ id: string; name: string }> }>("/delivery/drivers"),
  pending: () => request<{ deliveries: import("../types").DeliveryOrder[] }>("/delivery/pending"),
  assign: (id: string, driverId: string) =>
    request<{ delivery: import("../types").DeliveryOrder }>(`/delivery/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ driverId }),
    }),
  advance: (id: string) =>
    request<{ delivery: import("../types").DeliveryOrder }>(`/delivery/${id}/advance`, { method: "PATCH" }),
};

// ─── Tickets de soporte ─────────────────────────────────────

export const tickets = {
  list: (status?: string) =>
    request<{ tickets: import("../types").Ticket[] }>(`/tickets${status ? `?status=${status}` : ""}`),
  get: (id: string) => request<{ ticket: import("../types").Ticket }>(`/tickets/${id}`),
  create: (data: { subject: string; body: string }) =>
    request<{ ticket: import("../types").Ticket }>("/tickets", { method: "POST", body: JSON.stringify(data) }),
  reply: (id: string, body: string) =>
    request<{ ticket: import("../types").Ticket }>(`/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  close: (id: string) =>
    request<{ ticket: import("../types").Ticket }>(`/tickets/${id}/close`, { method: "PATCH" }),
};

// ─── Audit log ──────────────────────────────────────────────

export const auditLog = {
  list: (limit?: number) =>
    request<{ logs: import("../types").AuditLogEntry[] }>(`/superadmin/audit-log${limit ? `?limit=${limit}` : ""}`),
};

// ─── Cash Register ──────────────────────────────────────────

export const cashRegister = {
  open: (openingBalance: number) =>
    request<{ register: import("../types").CashRegister }>("/cash-register/open", {
      method: "POST",
      body: JSON.stringify({ openingBalance }),
    }),
  close: (closingBalance: number, notes?: string) =>
    request<{ register: import("../types").CashRegister }>("/cash-register/close", {
      method: "POST",
      body: JSON.stringify({ closingBalance, notes }),
    }),
  current: () => request<{ register: import("../types").CashRegister | null }>("/cash-register/current"),
  history: () => request<{ registers: import("../types").CashRegister[] }>("/cash-register/history"),
};

// ─── Settings ───────────────────────────────────────────────

export const settings = {
  tables: () => request<{ data: import("../types").Table[] }>("/restaurant/tables"),
  restaurant: () => request<{ restaurant: import("../types").Restaurant & { address?: string | null; phone?: string | null; timezone?: string; currency?: string } }>("/restaurant/settings"),
  updateInfo: (data: { name?: string; address?: string; phone?: string; timezone?: string; currency?: string }) =>
    request<any>("/restaurant/info", { method: "PATCH", body: JSON.stringify(data) }),
  updateSettings: (settings: Record<string, unknown>) =>
    request<any>("/restaurant/settings", { method: "PUT", body: JSON.stringify({ settings }) }),
  addTable: (number: number, floor: string) =>
    request<any>("/restaurant/tables", {
      method: "POST",
      body: JSON.stringify({ number, floor, capacity: 4 }),
    }),
  deleteTable: (id: string) =>
    request<any>(`/restaurant/tables/${id}`, { method: "DELETE" }),
};

// ─── Reports ────────────────────────────────────────────────

export const reports = {
  summary: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<import("../types").DailySummary>(`/reports/summary${qs}`);
  },
  hourly: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<{ date: string; hourly: Array<{ hour: number; label: string; sales: number; orders: number }> }>(`/reports/hourly${qs}`);
  },
  topProducts: (from?: string, to?: string, limit = 10) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("limit", String(limit));
    return request<{ topProducts: Array<{ id: string; name: string; category: string; quantity: number; revenue: number }> }>(`/reports/top-products?${q}`);
  },
  sales: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return request<{ from: string; to: string; daily: Array<{ date: string; sales: number; orders: number }> }>(`/reports/sales?${q}`);
  },
};

// ─── Inventory ──────────────────────────────────────────────

export const inventory = {
  list: (params?: { lowStock?: boolean; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.lowStock) q.set("lowStock", "true");
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return request<{ items: Array<Record<string, unknown>>; lowStockCount: number }>(`/inventory${qs ? `?${qs}` : ""}`);
  },
  create: (data: Record<string, unknown>) =>
    request<{ item: Record<string, unknown> }>("/inventory", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ item: Record<string, unknown> }>(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  restock: (id: string, quantity: number, costPerUnit?: number) =>
    request<{ item: Record<string, unknown> }>(`/inventory/${id}/restock`, { method: "POST", body: JSON.stringify({ quantity, costPerUnit }) }),
  remove: (id: string) => request<{ message: string }>(`/inventory/${id}`, { method: "DELETE" }),
  suppliers: () => request<{ suppliers: Array<Record<string, unknown>> }>("/inventory/suppliers"),
  createSupplier: (data: Record<string, unknown>) =>
    request<{ supplier: Record<string, unknown> }>("/inventory/suppliers", { method: "POST", body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => request<{ message: string }>(`/inventory/suppliers/${id}`, { method: "DELETE" }),
};

// ─── SuperAdmin ─────────────────────────────────────────────

export const superadmin = {
  restaurants: () => request<{ restaurants: unknown[] }>("/superadmin/restaurants"),
  metrics: () => request<Record<string, unknown>>("/superadmin/metrics"),
  createRestaurant: (data: { name: string; slug: string; type: string; address?: string; phone?: string; adminName: string; adminEmail: string; adminPassword: string; plan: string }) =>
    request<{ message: string; restaurant: any; admin: any }>("/superadmin/restaurants", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  suspendRestaurant: (id: string) =>
    request<any>(`/superadmin/restaurants/${id}/suspend`, { method: "PATCH" }),
  reactivateRestaurant: (id: string) =>
    request<any>(`/superadmin/restaurants/${id}/reactivate`, { method: "PATCH" }),
  updateSubscription: (subId: string, plan: string) =>
    request<any>(`/superadmin/subscriptions/${subId}`, {
      method: "PUT",
      body: JSON.stringify({ plan }),
    }),

  updateRestaurant: (id: string, data: { name?: string; slug?: string; type?: string; address?: string; phone?: string }) =>
    request<any>(`/superadmin/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRestaurant: (id: string) =>
    request<any>(`/superadmin/restaurants/${id}`, { method: "DELETE" }),

  updateAdmin: (restaurantId: string, data: { username?: string; password?: string; name?: string }) =>
    request<any>(`/superadmin/restaurants/${restaurantId}/admin`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getRestaurant: (id: string) =>
    request<{ restaurant: any }>(`/superadmin/restaurants/${id}`),
};

export default { auth, register, categories, products, combos, orders, kitchen, waiter, cashRegister, settings, reports, superadmin };
