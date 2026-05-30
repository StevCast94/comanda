// ─── Enums (mirror Prisma) ──────────────────────────────────

export type UserRole = "SUPERADMIN" | "ADMIN" | "CASHIER" | "COOK_1" | "COOK_2" | "WAITER" | "DELIVERY";
export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type OrderStatus = "PENDING" | "PAID" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
export type OrderItemStatus = "PENDING" | "PREPARING" | "READY" | "DELIVERED";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
export type KitchenStation = "KITCHEN_1" | "KITCHEN_2" | "BAR" | "BOTH" | "NONE";
export type CategoryType = "COMBO" | "A_LA_CARTE" | "BEVERAGE" | "DESSERT" | "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "ASADO";

// ─── Models ─────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  settings: RestaurantSettings;
  currency: string;
}

export interface RestaurantSettings {
  taxRate: number;
  serviceRate: number;
  defaultTip: number;
  floors?: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  role: UserRole;
  restaurantId: string | null;
  avatar: string | null;
  phone?: string | null;
  restaurant?: Restaurant | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  sortOrder: number;
  active: boolean;
  _count?: { menuItems: number; combos: number };
}

export interface Modifier {
  id: string;
  menuItemId: string;
  name: string;
  priceAdjustment: number;
  active: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  categoryId: string;
  type: string;
  customType: string | null;
  kitchen: KitchenStation;
  active: boolean;
  image: string | null;
  prepTime: number;
  modifiers: Modifier[];
  category?: { id: string; name: string; type: string };
}

export interface ComboItem {
  id: string;
  comboId: string;
  menuItemId: string;
  quantity: number;
  isOptional: boolean;
  isDefault: boolean;
  groupName: string | null;
  alternatives: string; // JSON stringified array of menuItem IDs
  menuItem: Pick<MenuItem, "id" | "name" | "basePrice" | "kitchen" | "type">;
}

export interface Combo {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  categoryId: string;
  type: string;
  active: boolean;
  image: string | null;
  availableDays: number[];
  comboItems: ComboItem[];
  category?: { id: string; name: string };
}

export interface Table {
  id: string;
  number: number;
  floor: string;
  capacity: number;
  active: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string | null;
  comboId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  kitchen: KitchenStation;
  status: OrderItemStatus;
  modifiers: Array<{ modifierId: string; name: string; priceAdjustment: number }>;
  comboSelections?: Record<string, string>;
  createdAt: string;
  prepStartedAt: string | null;
  readyAt: string | null;
  menuItem?: MenuItem | null;
  combo?: Combo | null;
}

export interface Order {
  id: string;
  orderNumber: number;
  restaurantId: string;
  tableId: string | null;
  customerName: string | null;
  orderType: OrderType;
  status: OrderStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  serviceRate: number;
  serviceAmount: number;
  tip: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  cashierId: string;
  waiterId: string | null;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  table?: Pick<Table, "number" | "floor"> | null;
  cashier?: { name: string };
  waiter?: { name: string } | null;
}

// ─── POS Local State (not from API) ────────────────────────

export interface CartItem {
  tempId: string;
  menuItemId?: string;
  comboId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  kitchen: KitchenStation;
  notes: string;
  modifiers: Array<{ modifierId: string; name: string; priceAdjustment: number }>;
  comboSelections?: Record<string, string>;
}

export interface CashRegister {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  openingBalance: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  cashier?: { name: string };
}

// ─── KDS ────────────────────────────────────────────────────

export interface KDSOrder {
  order: {
    id: string;
    orderNumber: number;
    tableId: string | null;
    orderType: OrderType;
    customerName: string | null;
    createdAt: string;
    table: Pick<Table, "number" | "floor"> | null;
  };
  items: OrderItem[];
}

// ─── Reports ────────────────────────────────────────────────

export interface DailySummary {
  date: string;
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  cancelled: number;
  byPaymentMethod: { cash: number; card: number; transfer: number };
}
