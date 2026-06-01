# Auditoría COMANDA — SaaS Multi-Restaurante

**Fecha:** 2026-06-01
**Repo auditado (local):** `C:\Users\Admin\Desktop\comanda` — commit `b60ee6b`
**Stack confirmado:** React 19 + Vite 6 + Tailwind v4 (frontend/landing) · Express 5 + Prisma 6 + PostgreSQL (backend) · Railway

> Esta auditoría se basa en lectura directa del código, no solo en la descripción. Donde un punto depende de configuración en Railway (que no es visible desde el repo), se marca como **[verificar en Railway]**.

**Leyenda:** 🔴 crítica · 🟡 importante · 🟢 nice-to-have

---

## 1. Seguridad y Datos

### 🔴 No hay backups de la base de datos
No existe ningún script de respaldo en el repo (`pg_dump`, cron, dump a Cloudinary/S3: **cero coincidencias**). El único volume es `postgres-volume` en Railway.

**Qué pasa si Railway pierde el volume:** pérdida **total e irrecuperable** de todos los restaurantes, ventas históricas, inventario y clientes. Railway Pro **no** hace backups automáticos del PostgreSQL self-hosted por defecto; los volumes no son point-in-time. Hoy el negocio está a un incidente de distancia de perderlo todo.

**Estrategia recomendada (implementar esta semana):**
- `pg_dump` diario comprimido → subir a almacenamiento externo (Cloudinary raw, Backblaze B2, o S3). Cloudinary sirve si ya lo usan, pero B2/S3 es más adecuado para dumps.
- Retención: 7 diarios + 4 semanales + 3 mensuales (esquema GFS).
- Cron en Railway (servicio cron separado) o GitHub Action programada que se conecte vía `DATABASE_URL`.
- **Probar la restauración** al menos una vez. Un backup no verificado no es un backup.
- Ver script propuesto en §4.

### 🔴 `JWT_SECRET` con fallback inseguro hardcodeado
`backend/src/middleware/auth.ts`:
```ts
const JWT_SECRET = process.env.JWT_SECRET || "comanda-dev-secret-change-in-prod";
```
Si la variable de entorno no está definida en Railway, **todo el sistema firma tokens con un secreto público conocido** → cualquiera puede forjar un JWT de SUPERADMIN. Aunque esté seteada en prod, el fallback no debe existir.

**Fix:** eliminar el fallback y abortar el arranque si falta:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET no configurado");
```
**[verificar en Railway]** que `JWT_SECRET` exista y sea aleatorio (≥32 bytes). Si alguna vez se desplegó sin esa var, **rotar el secreto ya** (invalida sesiones, aceptable).

### 🔴 IDOR en modificadores — fuga entre restaurantes
`backend/src/routes/products.ts` (PUT/DELETE `/modifiers/:id`): a diferencia del resto de endpoints, **no verifican propiedad del tenant**:
```ts
router.delete("/modifiers/:id", authorize("ADMIN"), async (req, res) => {
  await prisma.modifier.delete({ where: { id: req.params.id } }); // ← sin chequeo de restaurantId
});
```
Un ADMIN del Restaurante A puede editar/borrar modificadores del Restaurante B conociendo (o adivinando) el ID. Es una fuga real de aislamiento multi-tenant.

**Fix:** cargar el modifier con su `menuItem`, verificar `menuItem.restaurantId === req.restaurantId` antes de mutar. El resto de rutas (`products`, `categories`, `inventory`) ya hacen este patrón correctamente — copiarlo aquí.

### 🟡 Login sin protección contra fuerza bruta
`auth.ts /login` solo está cubierto por el rate-limit global (300 req/min/IP). No hay límite por cuenta ni lockout. Permite credential stuffing distribuido.

**Fix:** rate-limit específico y estricto en `/api/auth/login` (p.ej. 10 intentos / 15 min por IP+username) y considerar bloqueo temporal de cuenta tras N fallos.

### 🟡 Endpoints públicos sin captcha (spam)
`/api/leads` y `/api/register` son públicos y sin captcha/honeypot. `/register` además **crea restaurante + usuario + suscripción TRIAL** en cada llamada → un bot puede inflar la BD con restaurantes basura.

**Fix:** honeypot + hCaptcha/Turnstile en ambos formularios, y rate-limit dedicado más estricto en `/register`.

### 🟡 CORS reflejado con credenciales
`index.ts`: `cors({ origin: true, credentials: true })` refleja cualquier Origin. Como la auth va por header `Authorization` (no cookies), el riesgo real es bajo, pero conviene restringir a `comanda.one` y dominios propios.

### 🟢 Resto del aislamiento multi-tenant: correcto
El patrón general es sólido: `authenticate` → `tenantIsolation` inyecta `req.restaurantId`, y las rutas filtran por él. Los `findUnique({where:{id}})` en `products/categories/inventory/users` **sí** validan `existing.restaurantId === req.restaurantId` antes de mutar. SUPERADMIN se maneja con `restaurantId = null` y scope opcional por query. Bien diseñado salvo la excepción de modifiers (arriba).

### 🟢 Buenas prácticas ya presentes
bcrypt (10 rounds), validación con Zod en todos los endpoints, `trust proxy` correcto para Railway, `.env` y `node_modules` en `.gitignore`, JWT con expiración por rol (24h admin / 12h resto).

---

## 2. Infraestructura

### 🟡 ¿Railway Pro alcanza para producción?
Para el estado actual (pocos restaurantes activos): **sí**. Railway Pro corre Express + Postgres sin problema a esta escala. Las limitaciones aparecen al crecer:

- **Single point of failure:** app y BD en el mismo proveedor, BD en un volume sin réplica. Si el volume falla, no hay failover.
- **Sin backups gestionados:** (ver §1) — el mayor riesgo, no el cómputo.
- **`bootstrap.ts` en cada `startCommand`:** `railway.json` corre `migrate deploy && tsx scripts/bootstrap.ts && node ...` en cada arranque. Revisar que `bootstrap` sea idempotente y no bloquee el boot.

### 🟡 Qué falta para escalar
- **Postgres gestionado con PITR** (point-in-time recovery): migrar a Neon, Supabase o Railway con backups gestionados cuando haya facturación real. Es el siguiente paso natural.
- **Backups externos** (§1) — prerequisito antes de captar clientes de pago.
- **Monitoreo/alertas:** no se ve Sentry ni logging estructurado. Hoy los errores van a `console.error` y se pierden. Añadir Sentry (gratis para este volumen) + healthcheck endpoint.
- **Connection pooling:** Prisma abre conexiones directas; con varios restaurantes concurrentes conviene PgBouncer / pooler (Neon/Supabase lo traen).

### Dominio comanda.one **[verificar]**
No es determinable desde el repo. Verificar en el registrador: si se compró vía Railway, conviene tener acceso directo al DNS (idealmente Cloudflare como capa DNS/CDN/WAF gratuita por delante). Recomendación: DNS en Cloudflare apuntando a Railway → ganas CDN, protección DDoS básica y caché de assets gratis.

---

## 3. Código y Deuda Técnica

### 🟡 Frontend: bundle único de ~846 KB
`frontend/vite.config.ts` **no define `manualChunks`** → todo va en un solo chunk. Con `recharts` (pesado) y `lucide-react`, el bundle se infla. En conexiones móviles (caso de uso real: meseros/cajeros con datos) esto es carga lenta.

**Fix de bajo esfuerzo, alto impacto:**
```ts
build: {
  outDir: "../backend/public/app",
  emptyOutDir: true,
  rollupOptions: {
    output: { manualChunks: { react: ["react","react-dom"], charts: ["recharts"] } }
  }
}
```
Además: `lazy()` + `Suspense` en las vistas de reportes (que es donde vive recharts) para que no cargue en el flujo de cajero/cocina. Importar iconos de `lucide-react` de forma individual. Objetivo realista: chunk inicial <300 KB.

### 🟢 Índices de BD: bien cubiertos
El `schema.prisma` tiene índices compuestos correctos para los patrones multi-tenant: `@@index([restaurantId, status])`, `@@index([restaurantId, createdAt])`, `@@unique([restaurantId, orderNumber])`, `@@index([kitchen, status])`, etc. No detecté queries calientes sin índice de soporte. Bien hecho.

### 🟡 Errores se tragan en `console.error`
Todos los `catch` hacen `console.error` + 500 genérico. Sin agregación (Sentry), en producción no hay forma de saber qué falla. Añadir captura centralizada en `errorHandler.ts`.

### 🟢 Generación de `orderNumber`
`@@unique([restaurantId, orderNumber])` está bien, pero verificar que la asignación del número correlativo se haga dentro de la transacción/atómicamente para evitar colisiones bajo concurrencia (dos cajeros simultáneos). Revisar `orders.ts`. (No bloqueante a esta escala, sí al crecer.)

### Errores conocidos no corregidos
El historial git reciente son fixes de UI (KDS combos, login→demo). No hay TODO/FIXME críticos visibles, pero el IDOR de modifiers (§1) es un bug de seguridad latente no corregido.

---

## 4. Acciones Inmediatas (esta semana)

Orden de prioridad:

1. **🔴 Backups automáticos** — lo más urgente. Servicio/cron diario:
   ```bash
   #!/bin/sh
   STAMP=$(date +%Y%m%d-%H%M)
   pg_dump "$DATABASE_URL" | gzip > /tmp/comanda-$STAMP.sql.gz
   # subir a B2/S3/Cloudinary y borrar locales > retención
   ```
   Programar diario, retención GFS, y **hacer una restauración de prueba**.

2. **🔴 Quitar el fallback de `JWT_SECRET`** y confirmar/rotar el secreto en Railway.

3. **🔴 Arreglar el IDOR de `/modifiers/:id`** (PUT y DELETE) con chequeo de tenant.

4. **🟡 Rate-limit estricto en `/login` y `/register`** + captcha en formularios públicos.

5. **🟡 Sentry + healthcheck** para tener visibilidad de errores en prod.

6. **🟡 `manualChunks` + lazy-load de reportes** en Vite.

**Mínimo para considerarlo "producción real":** backups verificados (1) + secreto seguro (2) + IDOR cerrado (3) + monitoreo de errores (5). Sin los puntos 1–3 el sistema **no** debería facturar clientes.

---

## 5. Visión a Futuro

| Iniciativa | Prioridad | Nota |
|---|---|---|
| **Pasarela de pagos EC (Payphone / Datafast)** | 🟡 | Payphone es el camino más simple para arrancar cobros en Ecuador (API/botón). Datafast para tarjeta tradicional con bancos locales. Esto desbloquea cobrar las suscripciones automáticamente en vez de manual. |
| **Stripe Connect (multi-local/delivery)** | 🟢 | Útil cuando haya repartidores o cadenas que necesiten split de pagos. Stripe no opera retail directo en EC, sirve para clientes internacionales; para EC priorizar Payphone/Datafast. |
| **Facturación electrónica SRI** | 🟡 | Obligatorio legalmente en EC para facturar. Integrar vía un proveedor autorizado (Datil, Contífico API, Facturero) en lugar de implementar el XML/firma desde cero. Necesario antes de vender a restaurantes formales. |
| **Notificaciones push / WhatsApp** | 🟢 | Push ya es viable (la app es PWA). WhatsApp vía API de Cloud (Meta) o Twilio para confirmaciones de pedido/delivery. |
| **App móvil React Native** | 🟢 | La PWA actual cubre el caso a corto plazo. RN solo si se necesita hardware nativo (impresora Bluetooth, escáner) o presencia en stores. No es prioridad mientras la PWA funcione. |

**Recomendación de secuencia de negocio:** primero blindar datos (§4), luego **Payphone + facturación SRI** (lo que permite cobrar y operar legalmente en Ecuador), y dejar Stripe Connect / RN para cuando haya tracción multi-local.

---

### Resumen ejecutivo
El código está **mejor de lo esperado**: multi-tenancy bien diseñado, índices correctos, validación con Zod en todo. Los riesgos reales son **operativos, no arquitectónicos**: cero backups (riesgo de pérdida total), un fallback de secreto peligroso, un IDOR puntual en modificadores, y falta de monitoreo. Los cuatro son arreglables esta semana y son el umbral entre "demo" y "producción real".
