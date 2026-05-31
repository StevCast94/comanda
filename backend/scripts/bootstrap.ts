/**
 * Bootstrap — unified startup script
 * Runs all migrations, repairs, and seeds before the app starts
 */
import { PrismaClient, UserRole, CategoryType, MenuItemType, KitchenStation, ComboType, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Bootstrap starting...");

  // ─── 1. customType column ─────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "customType" TEXT`);
    console.log("  ✅ customType column ready");
  } catch (e: any) {
    if (e.message?.includes("already exists")) console.log("  customType: already exists");
    else console.error("  customType migration failed:", e.message);
  }

  // ─── 2. Kitchen stations ──────────────────────────────────
  const oiResult = await prisma.$executeRawUnsafe(`UPDATE "OrderItem" SET "kitchen" = 'KITCHEN_1' WHERE "kitchen" NOT IN ('KITCHEN_1', 'NONE')`);
  const miResult = await prisma.$executeRawUnsafe(`UPDATE "MenuItem" SET "kitchen" = 'KITCHEN_1' WHERE "kitchen" NOT IN ('KITCHEN_1', 'NONE')`);
  if (oiResult > 0 || miResult > 0) console.log(`  🍳 Kitchen migration: ${oiResult} OrderItems + ${miResult} MenuItems`);
  else console.log("  🍳 Kitchen stations: OK");

  // ─── 3. Seed users repair ─────────────────────────────────
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const SEED_USERS = [
    { username: "superadmin", name: "Super Admin", role: "SUPERADMIN", email: "superadmin@comanda.app", restaurantId: null as string | null },
    { username: "saboradmin", name: "Admin Sabor", role: "ADMIN", email: "admin@sabor.com", restaurantId: null as string | null },
    { username: "saborcaja", name: "Caja Sabor", role: "CASHIER", email: "caja@sabor.com", restaurantId: null as string | null },
    { username: "sabormesero", name: "Mesero Sabor", role: "WAITER", email: "mesero@sabor.com", restaurantId: null as string | null },
    { username: "saborcocina", name: "Cocina Sabor", role: "COOK_1", email: "cocina@sabor.com", restaurantId: null as string | null },
  ];

  // Resolve restaurantId for Sabor users
  const sabor = await prisma.restaurant.findUnique({ where: { slug: "sabor" }, select: { id: true } });
  const hashed = await bcrypt.hash("12345678", 10);

  for (const su of SEED_USERS) {
    if (su.username === "superadmin") continue; // handled separately
    su.restaurantId = sabor?.id || null;
  }

  const superadmin = await prisma.user.findUnique({ where: { username: "superadmin" } });
  if (!superadmin) {
    await prisma.user.create({ data: { email: "superadmin@comanda.app", username: "superadmin", password: hashed, name: "Super Admin", role: UserRole.SUPERADMIN, restaurantId: null } });
    console.log("  👤 superadmin: created");
  }

  for (const su of SEED_USERS) {
    if (su.username === "superadmin") continue;
    const user = await prisma.user.findUnique({ where: { username: su.username } });
    if (!user) continue;
    const updates: Record<string, unknown> = {};
    if (user.name !== su.name) updates.name = su.name;
    if (!user.active) updates.active = true;
    const pwOk = await bcrypt.compare("12345678", user.password);
    if (!pwOk && Object.keys(updates).length === 0) {} // nothing to update
    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { username: su.username }, data: updates });
    }
  }
  console.log("  👤 Seed users: OK");

  // ─── 4. Seed Sabor restaurant ─────────────────────────────
  const existing = await prisma.restaurant.findUnique({
    where: { slug: "sabor" },
    include: { menuItems: { take: 1 }, combos: { take: 1 } },
  });

  if (existing && existing.menuItems.length > 0 && existing.combos.length > 0) {
    console.log("  🍽️ Sabor: already complete");
  } else {
    if (existing) {
      console.log("  🧹 Sabor incomplete — recreating...");
      await prisma.restaurant.delete({ where: { slug: "sabor" } });
    }
    await seedSabor(prisma, hashed);
  }

  console.log("✅ Bootstrap complete!");
}

async function seedSabor(prisma: PrismaClient, hashed: string) {
  console.log("  🍽️ Seeding Sabor...");

  const r = await prisma.restaurant.create({
    data: {
      name: "Sabor", slug: "sabor", type: "RESTAURANTE",
      address: "Av. Principal y Calle 2, Santo Domingo",
      phone: "+593 9X XXXXXXX", timezone: "America/Guayaquil", currency: "USD",
      settings: { taxRate: 0.15, serviceRate: 0.10, defaultTip: 0, floors: ["Planta Baja"] },
    },
  });

  await prisma.subscription.create({
    data: { restaurantId: r.id, plan: SubscriptionPlan.PRO, status: SubscriptionStatus.ACTIVE, price: 59,
      maxUsers: 20, maxProducts: 9999, maxCombos: 9999,
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
      features: { delivery: false, advancedReports: true, whatsapp: false } },
  });

  await Promise.all([
    prisma.user.create({ data: { email: "admin@sabor.com", username: "saboradmin", password: hashed, name: "Admin Sabor", role: UserRole.ADMIN, restaurantId: r.id } }),
    prisma.user.create({ data: { email: "caja@sabor.com", username: "saborcaja", password: hashed, name: "Caja Sabor", role: UserRole.CASHIER, restaurantId: r.id } }),
    prisma.user.create({ data: { email: "mesero@sabor.com", username: "sabormesero", password: hashed, name: "Mesero Sabor", role: UserRole.WAITER, restaurantId: r.id } }),
    prisma.user.create({ data: { email: "cocina@sabor.com", username: "saborcocina", password: hashed, name: "Cocina Sabor", role: UserRole.COOK_1, restaurantId: r.id } }),
  ]);

  for (let i = 1; i <= 12; i++) {
    await prisma.table.create({ data: { restaurantId: r.id, number: i, floor: "Planta Baja", capacity: 4 } });
  }

  const catMap: Record<string, string> = {};
  const cats: Array<{ name: string; type: CategoryType; sortOrder: number }> = [
    { name: "Almuerzos", type: CategoryType.LUNCH, sortOrder: 1 },
    { name: "Asados", type: CategoryType.ASADO, sortOrder: 2 },
    { name: "Rápida", type: CategoryType.SNACK, sortOrder: 3 },
    { name: "Bebidas", type: CategoryType.BEVERAGE, sortOrder: 4 },
    { name: "Acompañantes", type: CategoryType.A_LA_CARTE, sortOrder: 5 },
  ];
  for (const c of cats) {
    const cat = await prisma.category.create({ data: { ...c, restaurantId: r.id } });
    catMap[c.name] = cat.id;
  }

  const itemMap: Record<string, string> = {};
  const items: Array<{ name: string; description: string; basePrice: number; category: string; type: MenuItemType; kitchen: KitchenStation; prepTime: number }> = [
    { name: "Sopa de Pollo", description: "Sopa casera de pollo con fideo y verduras", basePrice: 2.50, category: "Almuerzos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Caldo de Bolas", description: "Caldo de bolas de verde con carne y huevo", basePrice: 3.00, category: "Almuerzos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8 },
    { name: "Chupe de Pescado", description: "Chupe de pescado con maní y refrito", basePrice: 3.50, category: "Almuerzos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    { name: "Carne Frita con Puré de Papa", description: "Carne de res frita con puré de papa cremoso", basePrice: 4.00, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 12 },
    { name: "Tallarín de Carne", description: "Tallarín salteado con carne de res y salsa criolla", basePrice: 4.00, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    { name: "Pescado Frito con Ensalada", description: "Filete de pescado frito con ensalada fresca", basePrice: 4.50, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 12 },
    { name: "Seco de Pollo", description: "Pollo guisado en salsa de cerveza y naranjilla", basePrice: 4.00, category: "Almuerzos", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 15 },
    { name: "Carne Asada", description: "Corte de res a la parrilla", basePrice: 6.00, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 18 },
    { name: "Filete de Pollo Asado", description: "Filete de pechuga de pollo a la parrilla", basePrice: 5.00, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 14 },
    { name: "Chuleta Asada", description: "Chuleta de cerdo a la parrilla", basePrice: 5.50, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 15 },
    { name: "Arroz Blanco", description: "Porción de arroz blanco", basePrice: 1.00, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
    { name: "Arroz Moro", description: "Arroz con menestra de lenteja", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Menestra de Frejol", description: "Menestra de fréjol rojo guisado", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Papas Fritas", description: "Papas fritas crujientes", basePrice: 2.00, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 7 },
    { name: "Puré de Papa", description: "Puré de papa cremoso", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Ensalada Fresca", description: "Lechuga, tomate, cebolla, aguacate", basePrice: 1.50, category: "Acompañantes", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
    { name: "Hamburguesa de Carne", description: "Hamburguesa de carne de res 150g", basePrice: 4.00, category: "Rápida", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8 },
    { name: "Hamburguesa de Pollo", description: "Hamburguesa de filete de pollo 150g", basePrice: 4.00, category: "Rápida", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8 },
    { name: "Hamburguesa Doble Carne", description: "Hamburguesa doble carne de res 300g", basePrice: 5.50, category: "Rápida", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    { name: "Jugo del Día", description: "Jugo natural de fruta de temporada", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
    { name: "Gaseosa 300ml", description: "Gaseosa personal 300ml", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
  ];

  for (const it of items) {
    const { category, ...data } = it;
    const created = await prisma.menuItem.create({ data: { ...data, categoryId: catMap[category], restaurantId: r.id } });
    itemMap[it.name] = created.id;
  }

  const almuerzo = await prisma.combo.create({
    data: { name: "Almuerzo Ejecutivo", description: "Sopa + Segundo + Jugo del día", basePrice: 5.00, categoryId: catMap["Almuerzos"], restaurantId: r.id, type: ComboType.LUNCH, availableDays: [1, 2, 3, 4, 5] },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: almuerzo.id, menuItemId: itemMap["Sopa de Pollo"], quantity: 1, isOptional: false, isDefault: true, groupName: "Sopa", alternatives: JSON.stringify([itemMap["Caldo de Bolas"], itemMap["Chupe de Pescado"]]) },
      { comboId: almuerzo.id, menuItemId: itemMap["Carne Frita con Puré de Papa"], quantity: 1, isOptional: false, isDefault: true, groupName: "Segundo", alternatives: JSON.stringify([itemMap["Tallarín de Carne"], itemMap["Pescado Frito con Ensalada"], itemMap["Seco de Pollo"]]) },
      { comboId: almuerzo.id, menuItemId: itemMap["Jugo del Día"], quantity: 1, isOptional: false, isDefault: true, groupName: "Bebida" },
    ],
  });

  const asado = await prisma.combo.create({
    data: { name: "Asado con Menestra", description: "Proteína a la parrilla + arroz + menestra de fréjol", basePrice: 7.00, categoryId: catMap["Asados"], restaurantId: r.id, type: ComboType.ASADO, availableDays: [0, 5, 6] },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: asado.id, menuItemId: itemMap["Carne Asada"], quantity: 1, isOptional: false, isDefault: true, groupName: "Proteína", alternatives: JSON.stringify([itemMap["Filete de Pollo Asado"], itemMap["Chuleta Asada"]]) },
      { comboId: asado.id, menuItemId: itemMap["Arroz Blanco"], quantity: 1, isOptional: false, isDefault: true, groupName: "Arroz", alternatives: JSON.stringify([itemMap["Arroz Moro"]]) },
      { comboId: asado.id, menuItemId: itemMap["Menestra de Frejol"], quantity: 1, isOptional: false, isDefault: true, groupName: "Menestra" },
    ],
  });

  const burger = await prisma.combo.create({
    data: { name: "Combo Hamburguesa", description: "Hamburguesa + papas fritas + gaseosa", basePrice: 6.00, categoryId: catMap["Rápida"], restaurantId: r.id, type: ComboType.SNACK, availableDays: [0, 1, 2, 3, 4, 5, 6] },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: burger.id, menuItemId: itemMap["Hamburguesa de Carne"], quantity: 1, isOptional: false, isDefault: true, groupName: "Hamburguesa", alternatives: JSON.stringify([itemMap["Hamburguesa de Pollo"], itemMap["Hamburguesa Doble Carne"]]) },
      { comboId: burger.id, menuItemId: itemMap["Papas Fritas"], quantity: 1, isOptional: false, isDefault: true, groupName: "Acompañante" },
      { comboId: burger.id, menuItemId: itemMap["Gaseosa 300ml"], quantity: 1, isOptional: false, isDefault: true, groupName: "Bebida" },
    ],
  });

  console.log("  🍽️ Sabor seeded! — 21 products · 3 combos · 12 tables · 4 users");
}

main().catch((e) => { console.error("❌ Bootstrap failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());
