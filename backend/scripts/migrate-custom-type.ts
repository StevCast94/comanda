/**
 * Add customType column to MenuItem — idempotent
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "customType" TEXT`);
    console.log("✅ customType column ready");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("  customType: already exists — skipping");
    } else {
      console.error("❌ customType migration failed:", e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
