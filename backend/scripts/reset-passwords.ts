/**
 * Reset seed user passwords to "12345678" — idempotent
 * Runs on every deploy; only updates known seed users
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SEED_USERNAMES = [
  "superadmin", "admin", "caja1", "cocina1", "cocina2",
  "mesero1", "mesero2", "delivery1",
];

async function main() {
  console.log("🔑 Resetting seed user passwords...");
  const hash = await bcrypt.hash("12345678", 10);
  let updated = 0;

  for (const username of SEED_USERNAMES) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) continue;

    // Check if password already matches (idempotent)
    const already = await bcrypt.compare("12345678", user.password);
    if (already) {
      console.log(`  ${username}: already "12345678" — skipping`);
      continue;
    }

    await prisma.user.update({
      where: { username },
      data: { password: hash },
    });
    console.log(`  ${username}: updated → 12345678`);
    updated++;
  }

  console.log(`✅ Password reset complete: ${updated} updated`);
}

main()
  .catch((e) => {
    console.error("❌ Reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
