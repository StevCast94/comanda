import { PrismaClient, UserRole, CategoryType, MenuItemType, KitchenStation, ComboType, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Comanda...");

  // Clean existing data (dev only)
  await prisma.$transaction([
    prisma.deliveryOrder.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.comboItem.deleteMany(),
    prisma.modifier.deleteMany(),
    prisma.combo.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.category.deleteMany(),
    prisma.cashRegister.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.deliveryZone.deleteMany(),
    prisma.table.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.user.deleteMany(),
    prisma.restaurant.deleteMany(),
  ]);

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // ─── Restaurant ──────────────────────────────────────────
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "El Sabor Criollo",
      slug: "el-sabor-criollo",
      type: "RESTAURANTE",
      address: "Av. Amazonas N23-45, Quito",
      phone: "+593 2 234 5678",
      timezone: "America/Guayaquil",
      currency: "USD",
      settings: {
        taxRate: 0.15,
        serviceRate: 0.10,
        defaultTip: 0,
        floors: ["Piso 1", "Terraza"],
      },
    },
  });

  // ─── Subscription (PRO for dev) ──────────────────────────
  await prisma.subscription.create({
    data: {
      restaurantId: restaurant.id,
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      price: 59,
      maxUsers: 20,
      maxProducts: 9999,
      maxCombos: 9999,
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
      features: { delivery: true, advancedReports: true, whatsapp: false },
    },
  });

  // ─── Users ───────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "superadmin@comanda.app", username: "superadmin",
        password: hash("12345678"), name: "Super Admin", role: UserRole.SUPERADMIN,
        restaurantId: null,
      },
    }),
    prisma.user.create({
      data: {
        email: "admin@comanda.app", username: "admin",
        password: hash("12345678"), name: "Carlos Menéndez", role: UserRole.ADMIN,
        restaurantId: restaurant.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "caja@comanda.app", username: "caja1",
        password: hash("12345678"), name: "María Salazar", role: UserRole.CASHIER,
        restaurantId: restaurant.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "cocina1@comanda.app", username: "cocina1",
        password: hash("12345678"), name: "Pedro Guamán", role: UserRole.COOK_1,
        restaurantId: restaurant.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "cocina2@comanda.app", username: "cocina2",
        password: hash("12345678"), name: "Rosa Imbaquingo", role: UserRole.COOK_2,
        restaurantId: restaurant.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "mesero1@comanda.app", username: "mesero1",
        password: hash("12345678"), name: "Luis Toapanta", role: UserRole.WAITER,
        restaurantId: restaurant.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "mesero2@comanda.app", username: "mesero2",
        password: hash("12345678"), name: "Andrea Pilco", role: UserRole.WAITER,
        restaurantId: restaurant.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "delivery@comanda.app", username: "delivery1",
        password: hash("12345678"), name: "Jorge Simbaña", role: UserRole.DELIVERY,
        restaurantId: restaurant.id,
      },
    }),
  ]);

  // ─── Tables ──────────────────────────────────────────────
  const tableData = [
    ...Array.from({ length: 8 }, (_, i) => ({ number: i + 1, floor: "Piso 1", capacity: 4 })),
    ...Array.from({ length: 4 }, (_, i) => ({ number: i + 9, floor: "Terraza", capacity: 6 })),
  ];
  for (const t of tableData) {
    await prisma.table.create({ data: { ...t, restaurantId: restaurant.id } });
  }

  // ─── Categories ──────────────────────────────────────────
  const catMap: Record<string, string> = {};
  const categories = [
    { name: "Desayunos", type: CategoryType.BREAKFAST, sortOrder: 1 },
    { name: "Almuerzos", type: CategoryType.LUNCH, sortOrder: 2 },
    { name: "A la Carta", type: CategoryType.A_LA_CARTE, sortOrder: 3 },
    { name: "Asados", type: CategoryType.ASADO, sortOrder: 4 },
    { name: "Bebidas", type: CategoryType.BEVERAGE, sortOrder: 5 },
    { name: "Postres", type: CategoryType.DESSERT, sortOrder: 6 },
    { name: "Snacks", type: CategoryType.SNACK, sortOrder: 7 },
  ];
  for (const c of categories) {
    const cat = await prisma.category.create({
      data: { ...c, restaurantId: restaurant.id },
    });
    catMap[c.name] = cat.id;
  }

  // ─── Menu Items ──────────────────────────────────────────
  const itemMap: Record<string, string> = {};

  const items: Array<{
    name: string; description: string; basePrice: number;
    category: string; type: MenuItemType; kitchen: KitchenStation;
    prepTime: number; modifiers?: Array<{ name: string; priceAdjustment: number }>;
  }> = [
    // ── Proteínas (KITCHEN_1) ──────────────────────────────
    { name: "Pollo a la plancha", description: "Pechuga de pollo a la plancha con especias", basePrice: 4.50, category: "A la Carta", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 12,
      modifiers: [{ name: "Término medio", priceAdjustment: 0 }, { name: "Bien cocido", priceAdjustment: 0 }] },
    { name: "Seco de pollo", description: "Pollo guisado en salsa de cerveza y naranjilla", basePrice: 5.00, category: "A la Carta", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 15 },
    { name: "Seco de carne", description: "Carne de res guisada en salsa criolla", basePrice: 6.00, category: "A la Carta", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 18 },
    { name: "Chuleta frita", description: "Chuleta de cerdo frita dorada", basePrice: 5.50, category: "A la Carta", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 14 },
    { name: "Carne asada", description: "Corte de res a la parrilla", basePrice: 7.00, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 20,
      modifiers: [{ name: "Término 1/4", priceAdjustment: 0 }, { name: "Término 3/4", priceAdjustment: 0 }, { name: "Bien asado", priceAdjustment: 0 }] },
    { name: "Pollo asado", description: "1/4 de pollo a las brasas", basePrice: 5.50, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 18 },
    { name: "Churrasco", description: "Lomo fino a la parrilla", basePrice: 8.50, category: "Asados", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 15,
      modifiers: [{ name: "Término medio", priceAdjustment: 0 }, { name: "Término 3/4", priceAdjustment: 0 }, { name: "Con huevo frito", priceAdjustment: 0.75 }] },
    { name: "Guatita", description: "Estómago de res en salsa de maní", basePrice: 5.50, category: "A la Carta", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },
    { name: "Encebollado", description: "Sopa de albacora con yuca y cebolla encurtida", basePrice: 4.50, category: "A la Carta", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8,
      modifiers: [{ name: "Con chifles", priceAdjustment: 0.50 }, { name: "Extra limón", priceAdjustment: 0 }] },
    { name: "Tilapia frita", description: "Filete de tilapia crujiente", basePrice: 6.00, category: "A la Carta", type: MenuItemType.PROTEIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 12 },

    // ── Acompañantes (KITCHEN_1) ───────────────────────────
    { name: "Arroz blanco", description: "Porción de arroz", basePrice: 1.00, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
    { name: "Menestra de lenteja", description: "Menestra guisada de lentejas", basePrice: 1.50, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Menestra de fréjol", description: "Menestra de fréjol rojo", basePrice: 1.50, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Patacones", description: "Plátano verde frito y aplastado (6 uds)", basePrice: 2.00, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 6 },
    { name: "Papas fritas", description: "Papas fritas crujientes", basePrice: 2.00, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 7 },
    { name: "Ensalada fresca", description: "Lechuga, tomate, cebolla, aguacate", basePrice: 1.50, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
    { name: "Maduro frito", description: "Plátano maduro frito", basePrice: 1.00, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 4 },
    { name: "Yuca frita", description: "Bastones de yuca frita", basePrice: 1.50, category: "A la Carta", type: MenuItemType.SIDE, kitchen: KitchenStation.KITCHEN_1, prepTime: 6 },

    // ── Desayunos (BOTH kitchens) ──────────────────────────
    { name: "Bolón de verde", description: "Bolón de verde con queso o chicharrón", basePrice: 3.50, category: "Desayunos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 8,
      modifiers: [{ name: "Con queso", priceAdjustment: 0 }, { name: "Con chicharrón", priceAdjustment: 0.50 }, { name: "Mixto", priceAdjustment: 0.75 }] },
    { name: "Huevos revueltos", description: "Huevos revueltos con cebolla y tomate", basePrice: 2.00, category: "Desayunos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 5 },
    { name: "Tigrillo", description: "Verde majado con huevo y queso", basePrice: 4.00, category: "Desayunos", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 10 },

    // ── Bebidas (BAR) ──────────────────────────────────────
    { name: "Coca-Cola", description: "Cola personal 400ml", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
    { name: "Sprite", description: "Sprite personal 400ml", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
    { name: "Agua mineral", description: "Agua sin gas 500ml", basePrice: 0.75, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
    { name: "Jugo de naranjilla", description: "Jugo natural de naranjilla", basePrice: 1.50, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 3 },
    { name: "Jugo de mora", description: "Jugo natural de mora", basePrice: 1.50, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 3 },
    { name: "Jugo de tomate de árbol", description: "Jugo natural", basePrice: 1.50, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 3 },
    { name: "Cerveza Pilsener", description: "Cerveza nacional 600ml", basePrice: 2.50, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 1 },
    { name: "Café de chuspa", description: "Café pasado tradicional", basePrice: 1.00, category: "Bebidas", type: MenuItemType.DRINK, kitchen: KitchenStation.NONE, prepTime: 3 },

    // ── Postres (KITCHEN_1) ────────────────────────────────
    { name: "Espumilla", description: "Espumilla de guayaba", basePrice: 1.00, category: "Postres", type: MenuItemType.DESSERT, kitchen: KitchenStation.KITCHEN_1, prepTime: 2 },
    { name: "Tres leches", description: "Porción de torta tres leches", basePrice: 3.00, category: "Postres", type: MenuItemType.DESSERT, kitchen: KitchenStation.KITCHEN_1, prepTime: 2 },
    { name: "Higos con queso", description: "Higos en almíbar con queso fresco", basePrice: 2.50, category: "Postres", type: MenuItemType.DESSERT, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },

    // ── Snacks (KITCHEN_1) ─────────────────────────────────
    { name: "Empanada de verde", description: "Empanada de verde con queso", basePrice: 1.50, category: "Snacks", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 5,
      modifiers: [{ name: "Con queso", priceAdjustment: 0 }, { name: "De carne", priceAdjustment: 0.50 }] },
    { name: "Humita", description: "Humita de choclo tierno", basePrice: 1.50, category: "Snacks", type: MenuItemType.MAIN, kitchen: KitchenStation.KITCHEN_1, prepTime: 3 },
  ];

  for (const item of items) {
    const { modifiers, category, ...data } = item;
    const created = await prisma.menuItem.create({
      data: {
        ...data,
        categoryId: catMap[category],
        restaurantId: restaurant.id,
      },
    });
    itemMap[item.name] = created.id;

    if (modifiers?.length) {
      for (const mod of modifiers) {
        await prisma.modifier.create({
          data: { ...mod, menuItemId: created.id },
        });
      }
    }
  }

  // ─── Combos ──────────────────────────────────────────────

  // 1) Desayuno Criollo
  const desayunoCombo = await prisma.combo.create({
    data: {
      name: "Desayuno Criollo",
      description: "Bolón o tigrillo + huevos + jugo + café",
      basePrice: 5.50,
      categoryId: catMap["Desayunos"],
      restaurantId: restaurant.id,
      type: ComboType.BREAKFAST,
      availableDays: [0, 1, 2, 3, 4, 5, 6],
    },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: desayunoCombo.id, menuItemId: itemMap["Bolón de verde"], quantity: 1, isOptional: false, isDefault: true, groupName: "Principal",
        alternatives: JSON.stringify([itemMap["Tigrillo"]]) },
      { comboId: desayunoCombo.id, menuItemId: itemMap["Huevos revueltos"], quantity: 1, isOptional: false, isDefault: true, groupName: "Huevos" },
      { comboId: desayunoCombo.id, menuItemId: itemMap["Jugo de naranjilla"], quantity: 1, isOptional: false, isDefault: true, groupName: "Bebida",
        alternatives: JSON.stringify([itemMap["Jugo de mora"], itemMap["Jugo de tomate de árbol"]]) },
      { comboId: desayunoCombo.id, menuItemId: itemMap["Café de chuspa"], quantity: 1, isOptional: false, isDefault: true, groupName: "Café" },
    ],
  });

  // 2) Almuerzo Ejecutivo
  const almuerzoCombo = await prisma.combo.create({
    data: {
      name: "Almuerzo Ejecutivo",
      description: "Sopa del día + proteína + arroz + menestra + bebida",
      basePrice: 4.50,
      categoryId: catMap["Almuerzos"],
      restaurantId: restaurant.id,
      type: ComboType.LUNCH,
      availableDays: [1, 2, 3, 4, 5],
    },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: almuerzoCombo.id, menuItemId: itemMap["Seco de pollo"], quantity: 1, isOptional: false, isDefault: true, groupName: "Proteína",
        alternatives: JSON.stringify([itemMap["Seco de carne"], itemMap["Chuleta frita"], itemMap["Guatita"]]) },
      { comboId: almuerzoCombo.id, menuItemId: itemMap["Arroz blanco"], quantity: 1, isOptional: false, isDefault: true, groupName: "Arroz" },
      { comboId: almuerzoCombo.id, menuItemId: itemMap["Menestra de lenteja"], quantity: 1, isOptional: false, isDefault: true, groupName: "Menestra",
        alternatives: JSON.stringify([itemMap["Menestra de fréjol"], itemMap["Ensalada fresca"]]) },
      { comboId: almuerzoCombo.id, menuItemId: itemMap["Maduro frito"], quantity: 1, isOptional: true, isDefault: true, groupName: "Extra" },
      { comboId: almuerzoCombo.id, menuItemId: itemMap["Coca-Cola"], quantity: 1, isOptional: false, isDefault: true, groupName: "Bebida",
        alternatives: JSON.stringify([itemMap["Sprite"], itemMap["Jugo de naranjilla"], itemMap["Jugo de mora"], itemMap["Agua mineral"]]) },
    ],
  });

  // 3) Parrillada Criolla
  const asadoCombo = await prisma.combo.create({
    data: {
      name: "Parrillada Criolla",
      description: "Carne + pollo asado + churrasco + patacones + ensalada + 2 bebidas",
      basePrice: 18.00,
      categoryId: catMap["Asados"],
      restaurantId: restaurant.id,
      type: ComboType.ASADO,
      availableDays: [0, 5, 6],
    },
  });
  await prisma.comboItem.createMany({
    data: [
      { comboId: asadoCombo.id, menuItemId: itemMap["Carne asada"], quantity: 1, isOptional: false, isDefault: true, groupName: "Res" },
      { comboId: asadoCombo.id, menuItemId: itemMap["Pollo asado"], quantity: 1, isOptional: false, isDefault: true, groupName: "Pollo" },
      { comboId: asadoCombo.id, menuItemId: itemMap["Churrasco"], quantity: 1, isOptional: true, isDefault: false, groupName: "Extra parrilla" },
      { comboId: asadoCombo.id, menuItemId: itemMap["Patacones"], quantity: 1, isOptional: false, isDefault: true, groupName: "Acompañante 1" },
      { comboId: asadoCombo.id, menuItemId: itemMap["Ensalada fresca"], quantity: 1, isOptional: false, isDefault: true, groupName: "Acompañante 2",
        alternatives: JSON.stringify([itemMap["Papas fritas"], itemMap["Yuca frita"]]) },
      { comboId: asadoCombo.id, menuItemId: itemMap["Cerveza Pilsener"], quantity: 2, isOptional: false, isDefault: true, groupName: "Bebidas",
        alternatives: JSON.stringify([itemMap["Coca-Cola"], itemMap["Sprite"], itemMap["Agua mineral"]]) },
    ],
  });

  // ─── Delivery Zones ──────────────────────────────────────
  await prisma.deliveryZone.createMany({
    data: [
      { restaurantId: restaurant.id, name: "Centro Norte", fee: 1.50, estimatedMin: 25 },
      { restaurantId: restaurant.id, name: "La Mariscal", fee: 2.00, estimatedMin: 30 },
      { restaurantId: restaurant.id, name: "Valle de los Chillos", fee: 3.50, estimatedMin: 45 },
    ],
  });

  // ─── Sample Customers ────────────────────────────────────
  await prisma.customer.createMany({
    data: [
      { restaurantId: restaurant.id, name: "Juan Pérez", phone: "+593987654321", email: "juan@email.com", visitCount: 12, totalSpent: 156.50, tags: JSON.stringify(["frecuente", "almuerzo"]) },
      { restaurantId: restaurant.id, name: "María García", phone: "+593912345678", visitCount: 5, totalSpent: 89.00, dietaryPreferences: "Sin gluten", tags: JSON.stringify(["delivery"]) },
      { restaurantId: restaurant.id, name: "Roberto Andrade", phone: "+593998765432", visitCount: 28, totalSpent: 420.75, tags: JSON.stringify(["vip", "asados"]), notes: "Siempre pide parrillada los sábados" },
    ],
  });

  // ─── Sample Suppliers ────────────────────────────────────
  await prisma.supplier.createMany({
    data: [
      { restaurantId: restaurant.id, name: "Pronaca", contact: "Vendedor Quito", phone: "+593223456789", email: "ventas@pronaca.com" },
      { restaurantId: restaurant.id, name: "Supermaxi Distribución", contact: "Compras al por mayor", phone: "+593224567890" },
      { restaurantId: restaurant.id, name: "Mercado Mayorista", contact: "Don Segundo", phone: "+593987654000" },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`   Restaurant: ${restaurant.name} (${restaurant.slug})`);
  console.log(`   Users: ${users.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Menu Items: ${items.length}`);
  console.log(`   Combos: 3`);
  console.log(`   Tables: ${tableData.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
