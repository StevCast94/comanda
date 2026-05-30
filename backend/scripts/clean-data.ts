/**
 * Clean test data — wipe orders, cash registers, delivery orders
 * Keeps: users, products, categories, combos, tables, inventory, customers
 * Run with: FORCE_CLEAN=true npx tsx scripts/clean-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.FORCE_CLEAN !== "true") {
    console.log("⏭️  FORCE_CLEAN not set — skipping data cleanup");
    return;
  }

  console.log("🧹 Cleaning test data...");

  const delOrderItems = await prisma.orderItem.deleteMany();
  console.log(`  OrderItems: ${delOrderItems.count} deleted`);

  const delDelivery = await prisma.deliveryOrder.deleteMany();
  console.log(`  DeliveryOrders: ${delDelivery.count} deleted`);

  const delOrders = await prisma.order.deleteMany();
  console.log(`  Orders: ${delOrders.count} deleted`);

  const delCash = await prisma.cashRegister.deleteMany();
  console.log(`  CashRegisters: ${delCash.count} deleted`);

  const delExpenses = await prisma.expense.deleteMany();
  console.log(`  Expenses: ${delExpenses.count} deleted`);

  console.log("✅ Data cleaned. DB ready for fresh testing.");
}

main()
  .catch((e) => {
    console.error("❌ Clean failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
