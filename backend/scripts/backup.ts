/**
 * Comanda — Backup diario de PostgreSQL → Cloudinary
 * ---------------------------------------------------
 * 1. Ejecuta `pg_dump` sobre DATABASE_URL y lo comprime con gzip.
 * 2. Sube el dump como recurso `raw` a Cloudinary (carpeta comanda-backups/).
 * 3. Aplica retención GFS: borra los backups más antiguos que excedan el límite.
 *
 * Uso:   npx tsx scripts/backup.ts
 * Cron:  programar 1×/día (ver AUDITORIA_COMANDA.md §4).
 *
 * Variables de entorno requeridas:
 *   DATABASE_URL              — connection string de Postgres (la de Railway).
 *   CLOUDINARY_URL            — formato cloudinary://<key>:<secret>@<cloud_name>
 *     (o, alternativamente: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)
 * Opcionales:
 *   BACKUP_RETENTION          — nº de backups a conservar (default 14).
 *   BACKUP_FOLDER             — carpeta en Cloudinary (default "comanda-backups").
 *
 * Requisito del entorno: el binario `pg_dump` debe estar disponible en el PATH.
 * En Railway/Nixpacks añade `postgresql` a los paquetes de sistema (nixpacks.toml:
 *   [phases.setup]  nixPkgs = ["...", "postgresql"]).
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { v2 as cloudinary } from "cloudinary";

const execAsync = promisify(exec);

const FOLDER = process.env.BACKUP_FOLDER || "comanda-backups";
const RETENTION = parseInt(process.env.BACKUP_RETENTION || "14", 10);

function configureCloudinary(): void {
  if (process.env.CLOUDINARY_URL) {
    // El SDK lee CLOUDINARY_URL automáticamente, pero lo hacemos explícito.
    cloudinary.config({ secure: true });
    return;
  }
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Faltan credenciales de Cloudinary. Define CLOUDINARY_URL o las tres CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET."
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

async function dumpDatabase(): Promise<Buffer> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL no está configurado.");

  // pg_dump → gzip. maxBuffer alto para BDs medianas (256 MB).
  const { stdout } = await execAsync(
    `pg_dump "${dbUrl}" --no-owner --no-privileges | gzip -9`,
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024, shell: "/bin/sh" }
  );
  const buf = stdout as unknown as Buffer;
  if (!buf || buf.length === 0) throw new Error("pg_dump devolvió un dump vacío.");
  return buf;
}

function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<{ bytes: number; secure_url: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", folder: FOLDER, public_id: publicId, overwrite: false },
      (err, result) => {
        if (err || !result) return reject(err || new Error("Upload sin resultado"));
        resolve({ bytes: result.bytes, secure_url: result.secure_url });
      }
    );
    stream.end(buffer);
  });
}

/** Borra los backups que excedan RETENTION (los más antiguos primero). */
async function applyRetention(): Promise<number> {
  const res = await cloudinary.api.resources({
    resource_type: "raw",
    type: "upload",
    prefix: `${FOLDER}/`,
    max_results: 500,
  });
  const resources: { public_id: string; created_at: string }[] = res.resources || [];
  if (resources.length <= RETENTION) return 0;

  // Más recientes primero; eliminar el sobrante del final.
  resources.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const toDelete = resources.slice(RETENTION).map((r) => r.public_id);
  if (toDelete.length > 0) {
    await cloudinary.api.delete_resources(toDelete, { resource_type: "raw", type: "upload" });
  }
  return toDelete.length;
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); // 2026-06-01T14-30-00
  const publicId = `comanda-${stamp}.sql.gz`;

  console.log(`🗄️  Generando dump de la base de datos...`);
  const dump = await dumpDatabase();
  console.log(`   dump: ${(dump.length / 1024 / 1024).toFixed(2)} MB comprimido`);

  configureCloudinary();
  console.log(`☁️  Subiendo a Cloudinary (${FOLDER}/${publicId})...`);
  const up = await uploadToCloudinary(dump, publicId);
  console.log(`   ✅ ${up.secure_url} (${(up.bytes / 1024 / 1024).toFixed(2)} MB)`);

  const deleted = await applyRetention();
  console.log(`🧹 Retención: conservando ${RETENTION}, eliminados ${deleted} antiguos.`);
  console.log(`✅ Backup completado.`);
}

main().catch((err) => {
  console.error("❌ Backup falló:", err?.message || err);
  process.exit(1);
});
