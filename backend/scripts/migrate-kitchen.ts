/**
 * Migration: Simplify kitchen stations — idempotent, runs every startup
 * - BAR, KITCHEN_2, BOTH → KITCHEN_1 (visible in unified KDS)
 * - NONE stays NONE (bebidas/postres auto-READY)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Migrating kitchen stations...");

  // 1. Update OrderItems (idempotent: only non-standard stations)
  const oiResult = await prisma.$executeRawUnsafe(`
    UPDATE "OrderItem"
    SET "kitchen" = 'KITCHEN_1'
    WHERE "kitchen" NOT IN ('KITCHEN_1', 'NONE')
  `);
  console.log(`  OrderItem: ${oiResult} rows updated`);

  // 2. Update MenuItems (idempotent: only non-standard stations)
  const miResult = await prisma.$executeRawUnsafe(`
    UPDATE "MenuItem"
    SET "kitchen" = 'KITCHEN_1'
    WHERE "kitchen" NOT IN ('KITCHEN_1', 'NONE')
  `);
  console.log(`  MenuItem: ${miResult} rows updated`);

  // 3. Verify no orphaned values remain
  const remaining = await prisma.$queryRawUnsafe<Array<{ kitchen: string; count: bigint }>>(`
    SELECT "kitchen", COUNT(*) as count
    FROM "MenuItem"
    GROUP BY "kitchen"
    ORDER BY "kitchen"
  `);
  console.log("\n📊 MenuItem kitchens after migration:");
  for (const row of remaining) {
    console.log(`  ${row.kitchen}: ${row.count}`);
  }

  const oiRemaining = await prisma.$queryRawUnsafe<Array<{ kitchen: string; count: bigint }>>(`
    SELECT "kitchen", COUNT(*) as count
    FROM "OrderItem"
    GROUP BY "kitchen"
    ORDER BY "kitchen"
  `);
  console.log("\n📊 OrderItem kitchens after migration:");
  for (const row of oiRemaining) {
    console.log(`  ${row.kitchen}: ${row.count}`);
  }

  console.log("\n✅ Migration complete!");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
