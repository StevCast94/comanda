# Auditoría de Seguridad — Comanda (Hardening pre-producción)

**Fecha:** 2026-06-01 · **Commit base:** `48b60c7` · **Modo:** diagnóstico + plan. **No se implementó nada.**

Cada punto fue verificado leyendo el código real, no asumido. Donde el prompt original contenía una suposición incorrecta, se corrige explícitamente.

**Leyenda:** 🔴 crítico (antes de producción) · 🟡 importante (esta fase) · 🟢 roadmap · ✅ ya está bien

---

## RESUMEN EJECUTIVO

| # | Hallazgo | Sev |
|---|---|---|
| 1 | Backups en Cloudinary `type: upload` → **dump de la BD descargable públicamente por URL** | 🔴 |
| 2 | Sin Helmet → faltan todos los headers de seguridad (HSTS, nosniff, X-Frame-Options) | 🔴 |
| 3 | Sin rate-limit específico en `/login` (fuerza bruta) | 🔴 |
| 4 | CORS `origin: true` (refleja cualquier origen) | 🟡 |
| 5 | Tokens no se revocan al cambiar contraseña | 🟡 |
| 6 | Sin CSP | 🟡 |
| 7 | Sin log/alerta de logins fallidos | 🟡 |
| 8 | `/register` y `/leads` públicos sin captcha/límite estricto | 🟡 |
| 9 | Política de contraseñas débil (mín. 6, sin blacklist) | 🟡 |
| 10 | JWT en `localStorage` (expuesto a XSS) | 🟡 |
| 11 | Sin refresh token / sin 2FA | 🟢 |
| — | Source maps, SQL injection, secrets en frontend, route protection | ✅ |

> **Corrección al prompt:** la suposición de que "el código TypeScript original está expuesto en F12" es **incorrecta** para este proyecto. Ver punto ✅-A.

---

## A. BACKEND SECURITY

### 🔴 1 — Backups públicamente descargables (NUEVO, no estaba en el checklist)
**Diagnóstico:** el script de backup (`backend/scripts/backup.ts`) sube el dump con `resource_type: "raw"` y *delivery type* por defecto (`upload`), que en Cloudinary es **acceso público**. Cualquiera con la URL `https://res.cloudinary.com/<cloud>/raw/upload/comanda-backups/comanda-<fecha>.sql.gz` obtiene **la base de datos completa** (hashes de contraseñas, clientes, ventas).
**Riesgo:** filtración total de datos sin necesidad de vulnerar la app. Las URLs de Cloudinary son adivinables/enumerables.
**Fix propuesto:**
- Subir con `type: "private"` o `type: "authenticated"` (no entregable sin firma).
- **Y/o** cifrar el dump antes de subir: `pg_dump | gzip | gpg --symmetric --cipher-algo AES256` (clave en env, fuera de Cloudinary).
- Idealmente mover backups a un bucket privado (B2/S3) en lugar de Cloudinary, que está pensado para media pública.
**Prioridad:** 🔴 — esto convierte la mejora de backup en un riesgo si queda como está.

### 🔴 2 — Sin Helmet / security headers
**Diagnóstico:** `index.ts` no usa `helmet`. Faltan `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`.
**Riesgo:** clickjacking (la app embebible en iframe), MIME sniffing, downgrade a HTTP.
**Fix propuesto:**
```ts
import helmet from "helmet";
app.use(helmet({
  contentSecurityPolicy: false, // se define aparte (ver punto 6)
  hsts: { maxAge: 15552000, includeSubDomains: true },
}));
```
**Prioridad:** 🔴

### 🔴 3 — Login sin rate-limit dedicado
**Diagnóstico:** solo existe el límite global de 300 req/min/IP en `index.ts`; `/api/auth/login` lo comparte. 300 intentos/min permiten fuerza bruta cómoda.
**Riesgo:** credential stuffing / fuerza bruta de contraseñas (agravado por política débil, punto 9).
**Fix propuesto:** limiter específico montado antes de la ruta:
```ts
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10,
  keyGenerator: (req) => `${req.ip}:${req.body?.username ?? ""}`,
  message: { error: "Demasiados intentos. Espera 15 minutos." } });
app.use("/api/auth/login", loginLimiter);
```
**Prioridad:** 🔴

### 🟡 4 — CORS abierto
**Diagnóstico:** `cors({ origin: true, credentials: true })` refleja cualquier Origin. Riesgo real **moderado** porque la auth va por header `Authorization` (no cookies), así que no hay robo de sesión cross-site clásico. Aun así no debe quedar abierto en prod.
**Fix propuesto:** whitelist por env:
```ts
const allowed = (process.env.CORS_ORIGINS ?? "https://comanda.one").split(",");
app.use(cors({ origin: (o, cb) => (!o || allowed.includes(o)) ? cb(null, true) : cb(new Error("CORS")), credentials: true }));
```
**Prioridad:** 🟡

### 🟡 5 — Tokens no se revocan al cambiar contraseña
**Diagnóstico:** `auth.ts /change-password` actualiza el hash pero **no invalida los JWT ya emitidos**. No hay versión de token ni blacklist; un token robado sigue válido hasta su expiración (12–24h) aunque la víctima cambie la contraseña.
**Riesgo:** tras un compromiso, la víctima no puede "cerrar sesión en todos los dispositivos".
**Fix propuesto:** añadir `tokenVersion: Int` al modelo `User`, incluirlo en el JWT, incrementarlo al cambiar contraseña, y compararlo en `authenticate`. (Requiere migración Prisma.)
**Prioridad:** 🟡

### 🟡 6 — Sin CSP
**Diagnóstico:** no hay `Content-Security-Policy`. Ante un XSS, no hay contención.
**Fix propuesto** (para React + Tailwind + Cloudinary + Google Fonts):
```ts
app.use(helmet.contentSecurityPolicy({ directives: {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Tailwind/inline
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
}}));
```
Nota: `'unsafe-inline'` en styles es difícil de evitar con Tailwind; aceptable. Probar en staging porque CSP mal puesta rompe la SPA.
**Prioridad:** 🟡

### 🟡 7 — Sin registro/alerta de logins fallidos
**Diagnóstico:** `auth.ts` solo actualiza `lastLogin` en éxito. No hay tabla de auditoría ni conteo de fallos.
**Riesgo:** ataques de fuerza bruta invisibles; sin trazabilidad post-incidente.
**Fix propuesto:** tabla `AuthLog` (userId?, ip, success, createdAt) + alerta al SUPERADMIN ante N fallos. Combinable con el limiter del punto 3.
**Prioridad:** 🟡

### 🟡 8 — Endpoints públicos sin anti-bot
**Diagnóstico:** `/api/register` (crea Restaurant+User+Subscription) y `/api/leads` solo tienen el límite global. Un bot puede crear restaurantes basura masivamente.
**Fix propuesto:** captcha (Cloudflare Turnstile/hCaptcha) + honeypot + limiter dedicado en ambos.
**Prioridad:** 🟡

### 🟡 9 — Política de contraseñas
**Diagnóstico:** `bcrypt` con **10 rounds** (login, register, change-password — verificado). Mínimo **6** caracteres. Sin chequeo de contraseñas comunes.
**Riesgo:** "123456" es válida; rounds 10 es el mínimo aceptable, no el recomendado.
**Fix propuesto:** subir a 12 rounds, mínimo 8–10 caracteres, validar contra lista de comunes (p.ej. `zxcvbn` o blocklist top-10k).
**Prioridad:** 🟡

### ✅ SQL Injection — bien
No hay `$queryRaw` ni `$executeRaw` en todo el backend (verificado). Prisma parametriza todo. No hay vector NoSQL/SQL injection. **No tocar.**

### ✅ Input validation — bien (con matiz)
Todas las rutas usan **Zod** con tipos y longitudes (`.max(100)`, `.email()`, regex en slug). Cobertura buena. Matiz 🟢: `express.json({ limit: "10mb" })` es generoso; si no se aceptan imágenes base64, bajar a `1mb`.

### ✅ Error handling — bien
`errorHandler.ts` devuelve mensajes genéricos, **no filtra stack traces** al cliente; los detalles van a `console.error` (servidor). Único matiz 🟢: el `default` de Prisma devuelve `err.code` (p.ej. "P2034") — inocuo pero se puede ocultar.

### ✅ File upload — N/A
No hay `multer` ni manejo de `multipart` en el backend (verificado). Las imágenes (`logo`, `image`) son campos `String` (URLs). No hay superficie de subida de archivos en el servidor. (Si en el futuro se sube a Cloudinary desde el cliente, validar tipo/tamaño y usar *signed uploads*.)

### ✅ JWT secret — corregido
Ya sin fallback hardcodeado; el arranque aborta si falta (commit `c5e197f`). Secreto rotado a valor aleatorio de 48 bytes. Expiración 12h/24h por rol. **Bien.** Lo pendiente es revocación (punto 5) y refresh token (punto 11).

---

## B. FRONTEND SECURITY

### ✅ A — Source maps / "código expuesto en F12": el prompt estaba equivocado
**Diagnóstico:** Vite **NO genera source maps en producción por defecto** (`build.sourcemap` default = `false`), y minifica con esbuild por defecto. Verificado: `frontend/vite.config.ts` no activa `sourcemap`, por lo tanto **no se generan `.js.map` ni se expone el TypeScript original**. Lo que se ve en F12 es JS minificado e ilegible.
**Conclusión:** el riesgo descrito como "CRÍTICO — cualquiera ve el código TS original" **no aplica**.
**Recomendación 🟢:** aun así, añadir `build: { sourcemap: false }` explícito como defensa-en-profundidad (evita que un cambio futuro lo active por accidente). La "ofuscación adicional"/`terserOptions` **no aporta seguridad real** — el código de negocio sensible debe vivir en el backend, no ocultarse en el cliente. (El backend ya hace cumplir auth y tenancy; el frontend solo guía la UX.)

### 🟡 10 — JWT en localStorage
**Diagnóstico:** `frontend/src/hooks/useAuth.ts` guarda `comanda_token` en `localStorage`. Accesible a cualquier script → si hay XSS, el token se roba.
**Trade-off:** mover a cookie `httpOnly` + `Secure` + `SameSite=Strict` elimina el robo por XSS, pero reintroduce CSRF (mitigable) y complica el flujo SPA/PWA. Dado que hoy no hay XSS conocido y la mitigación principal es CSP (punto 6), es 🟡 no 🔴.
**Fix propuesto:** a futuro, access token en cookie httpOnly + refresh token; mientras tanto, priorizar CSP. **Prioridad:** 🟡

### ✅ Env vars en frontend — bien
Solo se usa `VITE_API_URL` (no secreto) y `import.meta.env.DEV`. **No hay claves/keys expuestas** en el bundle (verificado).

### ✅ Route protection — correcto (con matiz esperado)
`App.tsx` tiene `<Protected roles={[...]}>` en todas las rutas (POS, KDS, Waiter, Admin, SuperAdmin, Delivery) con chequeo de rol. Es gating **client-side** (UX); la seguridad real la aplica el backend (`authenticate` + `authorize` + `tenantIsolation`), que está correcto. **No tocar** — solo recordar que el gating del front nunca es la frontera de seguridad.

---

## C. INFRAESTRUCTURA

### 🟡 HTTPS / HSTS
**Diagnóstico:** Railway termina TLS en el edge y `trust proxy` está bien configurado, pero no hay HSTS ni redirect explícito HTTP→HTTPS en la app.
**Fix:** HSTS vía Helmet (punto 2). El redirect lo cubre Railway/Cloudflare; verificar que `http://comanda.one` redirija a `https://`.
**Prioridad:** 🟡

### 🟡 DATABASE_URL SSL **[verificar en Railway]**
La conexión interna de Railway viaja por red privada; la **pública** (la que usará la GitHub Action de backup) debe forzar `?sslmode=require`. Verificar el connection string.
**Prioridad:** 🟡

### 🔴/🟡 Backups encriptados y probados
Encriptación: ver punto 1 (🔴). **Probados:** aún no se ha hecho una restauración de prueba — pendiente y obligatorio antes de confiar en ellos.

### 🟢 Logging / alertas
Sin agregación de logs (Sentry) ni alertas. Recomendado para el roadmap junto al punto 7.

### 🟢 2FA
Sin 2FA. Recomendado para SUPERADMIN y ADMIN a futuro (TOTP).

---

## D. PROTECCIÓN F12 (respuesta directa)
- **20–21:** No hace falta ofuscación/`terserOptions` adicional. Vite ya minifica y no expone source maps (ver ✅-A). Ofuscar no es una medida de seguridad: lo sensible se protege en el backend, no escondiéndolo en el cliente.
- **22:** ✅ Correcto — `index.ts` sirve estáticamente **solo** `backend/public/app` (frontend compilado) y la landing. El código fuente del backend (`src/`, `dist/`) **no** se sirve. Bien.

---

## PLAN DE ACCIÓN PRIORIZADO

**🔴 Antes de abrir a producción:**
1. Backups privados/cifrados (punto 1) — o el backup es un agujero.
2. Helmet + HSTS (punto 2).
3. Rate-limit en `/login` (punto 3).
4. Probar una restauración de backup.

**🟡 Esta fase:**
5. CORS whitelist · 6. CSP · 7. Log de logins fallidos · 8. Captcha en register/leads · 9. Política de contraseñas (12 rounds, mín. 8) · 5. Revocación de token al cambiar contraseña · HSTS/SSL infra.

**🟢 Roadmap:**
Refresh tokens · 2FA (SUPERADMIN/ADMIN) · Sentry + alertas · JWT a cookie httpOnly · `sourcemap: false` explícito.

**Esfuerzo estimado de los 🔴 + 🟡 backend:** ~1 día de trabajo (Helmet, limiters, CORS, CSP y backup privado son cambios pequeños y localizados). Migraciones Prisma (tokenVersion, AuthLog) suman algo más.

---

*Auditoría de diagnóstico. Nada implementado. A validar por Stevens y Timmy antes de ejecutar.*
