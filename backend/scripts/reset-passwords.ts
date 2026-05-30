/**
 * Reset seed users — passwords + names (idempotent)
 * Runs on every deploy
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SEED_USERS = [
  { username: "superadmin", name: "Super Admin", role: "SUPERADMIN" },
  { username: "admin",      name: "Carlos Menéndez", role: "ADMIN" },
  { username: "caja1",      name: "María Salazar", role: "CASHIER" },
  { username: "cocina1",    name: "Pedro Guamán", role: "COOK_1" },
  { username: "cocina2",    name: "Rosa Imbaquingo", role: "COOK_2" },
  { username: "mesero1",    name: "Luis Toapanta", role: "WAITER" },
  { username: "mesero2",    name: "Andrea Pilco", role: "WAITER" },
  { username: "delivery1",  name: "Jorge Simbaña", role: "DELIVERY" },
];

async function main() {
  console.log("🔑 Resetting seed users...");
  const hash = await bcrypt.hash("12345678", 10);
  let pwUpdated = 0, nameFixed = 0;

  for (const su of SEED_USERS) {
    const user = await prisma.user.findUnique({ where: { username: su.username } });
    if (!user) {
      console.log(`  ${su.username}: not found — skipping`);
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (user.name !== su.name) {
      updates.name = su.name;
      nameFixed++;
    }

    const already = await bcrypt.compare("12345678", user.password);
    if (!already) {
      updates.password = hash;
      pwUpdated++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { username: su.username }, data: updates });
      console.log(`  ${su.username}: fixed → name="${su.name}"${updates.password ? ", pw=12345678" : ""}`);
    } else {
      console.log(`  ${su.username}: OK`);
    }
  }

  console.log(`✅ Seed repair complete: ${pwUpdated} passwords, ${nameFixed} names`);
}

main()
  .catch((e) => {
    console.error("❌ Reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
