/**
 * Seed: Willie's — Parrilla & Almuerzos (idempotent)
 */
import { PrismaClient, UserRole, CategoryType, MenuItemType, KitchenStation, ComboType, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: "willie" } });
  if (existing) {
    console.log("⏭️  Willie's already exists — skipping");
    return;
  }

  console.log("🍽️  Seeding Willie's...");
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const r = await prisma.restaurant.create({
    data: {
      name: "Willie's",
      slug: "willie",
      type: "PARRILLADA",
      address: "Calle 10 de Agosto y Rocafuerte, Esmeraldas",
      phone: "+593 6 299 1234",
      timezone: "America/Guayaquil",
      currency: "USD",
      settings: { taxRate: 0.15, serviceRate: 0.10, defaultTip: 0, floors: ["Planta Baja"] },
    },
  });

  await prisma.subscription.create({
    data: {
      restaurantId: r.id, plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE,
      price: 59, maxUsers: 20, maxProducts: 9999, maxCombos: 9999,
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
      features: { delivery: false, advancedReports: true, whatsapp: false },
    },
  });

  // Users
  await Promise.all([
    prisma.user.create({ data: { email: "admin@willie.com", username: "admin-willie", password: hash("12345678"), name: "Willie Rodríguez", role: UserRole.ADMIN, restaurantId: r.id } }),
    prisma.user.create({ data: { email: "caja@willie.com", username: "caja-willie", password: hash("12345678"), name: "Rosa Valencia", role: UserRole.CASHIER, restaurantId: r.id } }),
    prisma.user.create({ data: { email: "cocina@willie.com", username: "cocina-willie", password: hash("12345678"), name: "Carlos Mina", role: UserRole.COOK_1, restaurantId: r.id } }),
    prisma.user.create({ data: { email: "willie@mesero.com", username: "willie", password: hash("12345678"), name: "Willie", role: UserRole.WAITER, restaurantId: r.id } }),
  ]);

  // Tables (8)
  for (let i = 1; i <= 8; i++) {
    await prisma.table.create({ data: { restaurantId: r.id, number: i, floor: "Planta Baja", capacity: 4 } });
  }

  // Categories
  const catMap: Record<string, string> = {};
  const cats = [
    { name: "Almuerzos", type: CategoryType.LUNCH, sortOrder: 1 },
    { name: "Asados", type: CategoryType.ASADO, sortOrder: 2 },
    { name: "Comida Rápida", type: CategoryType.A_LA_CARTE, sortOrder: 3 },
    { name: "Bebidas", type: CategoryType.BEVERAGE, sortOrder: 4 },
    { name: "Acompañantes", type: CategoryType.A_LA_CARTE, sortOrder: 5 },
  ];
  for (const c of cats) {
    const cat = await prisma.category.create({ data: { ...c, restaurantId: r.id } });
    catMap[c.name] = cat.id;
  }

  // Products
  const itemMap: Record<string, string> = {};
  const items: Array<{ name: string; description: string; basePrice: number; category: string; type: MenuItemType; kitchen: KitchenStation; prepTime: number }> = [
    // ── Sopas ──────────────────────────────────
    { name: "Sopa de Pollo", description: "Sopa casera de pollo con fideo y verduras", basePrice: 2.50, category: "Almuerzos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Caldo de Bolas", description: "Caldo de bolas de verde con carne y huevo", basePrice: 3.00, category: "Almuerzos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8 },
    { name: "Chupe de Pescado", description: "Chupe esmeraldeño de pescado con maní y refrito", basePrice: 3.50, category: "Almuerzos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    // ── Platos Fuertes ─────────────────────────
    { name: "Carne Frita con Puré de Papa", description: "Carne de res frita acompañada de puré de papa", basePrice: 4.00, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 12 },
    { name: "Tallarín de Carne", description: "Tallarín salteado con carne de res y salsa criolla", basePrice: 4.00, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    { name: "Pescado Frito con Ensalada", description: "Filete de pescado frito con ensalada fresca", basePrice: 4.50, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 12 },
    { name: "Seco de Pollo", description: "Pollo guisado en salsa de cerveza y naranjilla", basePrice: 4.00, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 15 },
    // ── Proteínas Asado ────────────────────────
    { name: "Carne Asada", description: "Corte de res a la parrilla", basePrice: 6.00, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 18 },
    { name: "Filete de Pollo Asado", description: "Filete de pechuga de pollo a la parrilla", basePrice: 5.00, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 14 },
    { name: "Chuleta Asada", description: "Chuleta de cerdo a la parrilla", basePrice: 5.50, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 15 },
    // ── Arroces ────────────────────────────────
    { name: "Arroz Blanco", description: "Porción de arroz blanco", basePrice: 1.00, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
    { name: "Arroz Moro", description: "Arroz con menestra de lenteja", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    // ── Acompañantes ───────────────────────────
    { name: "Menestra de Frejol", description: "Menestra de fréjol rojo guisado", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Papas Fritas", description: "Papas fritas crujientes", basePrice: 2.00, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 7 },
    { name: "Puré de Papa", description: "Puré de papa cremoso con mantequilla", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Ensalada Fresca", description: "Lechuga, tomate, cebolla, aguacate", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
    // ── Hamburguesas ───────────────────────────
    { name: "Hamburguesa de Carne", description: "Hamburguesa de carne de res 150g", basePrice: 4.00, category: "Comida Rápida", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8 },
    { name: "Hamburguesa de Pollo", description: "Hamburguesa de filete de pollo 150g", basePrice: 4.00, category: "Comida Rápida", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8 },
    { name: "Hamburguesa Doble Carne", description: "Hamburguesa doble carne de res 300g", basePrice: 5.50, category: "Comida Rápida", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    // ── Bebidas ────────────────────────────────
    { name: "Jugo del Día", description: "Jugo natural de fruta de temporada", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
    { name: "Gaseosa 300ml", description: "Gaseosa personal 300ml", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
  ];

  for (const item of items) {
    const { category, ...data } = item;
    const created = await prisma.menuItem.create({
      data: { ...data, categoryId: catMap[category], restaurantId: r.id },
    });
    itemMap[item.name] = created.id;
  }

  // ─── Combos ─────────────────────────────────

  // 1) Almuerzo Ejecutivo
  const almuerzo = await prisma.combo.create({
    data: { name: "Almuerzo Ejecutivo", description: "Sopa + Segundo + Jugo del día", basePrice: 5.00, categoryId: catMap["Almuerzos"], restaurantId: r.id, type: ComboType.LUNCH, availableDays: [1, 2, 3, 4, 5] },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: almuerzo.id, menuItemId: itemMap["Sopa de Pollo"], quantity: 1, isOptional: false, isDefault: true, groupName: "Sopa",
        alternatives: JSON.stringify([itemMap["Caldo de Bolas"], itemMap["Chupe de Pescado"]]) },
      { comboId: almuerzo.id, menuItemId: itemMap["Carne Frita con Puré de Papa"], quantity: 1, isOptional: false, isDefault: true, groupName: "Segundo",
        alternatives: JSON.stringify([itemMap["Tallarín de Carne"], itemMap["Pescado Frito con Ensalada"], itemMap["Seco de Pollo"]]) },
      { comboId: almuerzo.id, menuItemId: itemMap["Jugo del Día"], quantity: 1, isOptional: false, isDefault: true, groupName: "Bebida" },
    ],
  });

  // 2) Asado con Menestra
  const asado = await prisma.combo.create({
    data: { name: "Asado con Menestra", description: "Proteína a la parrilla + arroz + menestra de fréjol", basePrice: 7.00, categoryId: catMap["Asados"], restaurantId: r.id, type: ComboType.ASADO, availableDays: [0, 5, 6] },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: asado.id, menuItemId: itemMap["Carne Asada"], quantity: 1, isOptional: false, isDefault: true, groupName: "Proteína",
        alternatives: JSON.stringify([itemMap["Filete de Pollo Asado"], itemMap["Chuleta Asada"]]) },
      { comboId: asado.id, menuItemId: itemMap["Arroz Blanco"], quantity: 1, isOptional: false, isDefault: true, groupName: "Arroz",
        alternatives: JSON.stringify([itemMap["Arroz Moro"]]) },
      { comboId: asado.id, menuItemId: itemMap["Menestra de Frejol"], quantity: 1, isOptional: false, isDefault: true, groupName: "Menestra" },
    ],
  });

  // 3) Combo Hamburguesa
  const burger = await prisma.combo.create({
    data: { name: "Combo Hamburguesa", description: "Hamburguesa + papas fritas + gaseosa", basePrice: 6.00, categoryId: catMap["Comida Rápida"], restaurantId: r.id, type: ComboType.CUSTOM, availableDays: [0, 1, 2, 3, 4, 5, 6] },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: burger.id, menuItemId: itemMap["Hamburguesa de Carne"], quantity: 1, isOptional: false, isDefault: true, groupName: "Hamburguesa",
        alternatives: JSON.stringify([itemMap["Hamburguesa de Pollo"], itemMap["Hamburguesa Doble Carne"]]) },
      { comboId: burger.id, menuItemId: itemMap["Papas Fritas"], quantity: 1, isOptional: false, isDefault: true, groupName: "Acompañante" },
      { comboId: burger.id, menuItemId: itemMap["Gaseosa 300ml"], quantity: 1, isOptional: false, isDefault: true, groupName: "Bebida" },
    ],
  });

  console.log("✅ Willie's seeded!");
  console.log(`   Products: ${items.length} | Combos: 3 | Tables: 8 | Users: 4`);
}

main().catch((e) => { console.error("❌ Willie's seed failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
