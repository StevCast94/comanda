# PROMPT PARA CLAUDE — Proyecto Comanda 🍽️

> **Objetivo:** Crear el MVP completo de Comanda — sistema de gestión para restaurante que compita con restaurant.pe pero mejor diseñado, más rápido y con UX superior.
> **Importante:** Leer TODO este prompt antes de empezar a codificar. No asumir nada que no esté explícito.

---

## 1. EL NEGOCIO

Comanda es un sistema integral para gestión de restaurantes. El MVP cubre: toma de pedidos en caja, cocina KDS (Kitchen Display System), entrega por meseros, y un CRM administrativo completo.

### Flujo operativo principal
1. **Cliente pide y paga en CAJA** — el cajero toma la orden y cobra
2. **COCINA 1 (acompañantes)** — recibe ticket digital en tablet, prepara acompañantes (arroz, papas, ensalada, etc.), sirve y marca como listo
3. **COCINA 2 (proteína)** — recibe ticket digital en tablet, prepara proteína, marca como listo
4. **MESERO** — ve en su teléfono que ambas cocinas terminaron, junta los ítems, entrega a la mesa correspondiente

### Canales adicionales
- **Delivery** — Motorista recibe pedido empacado, lo entrega a domicilio
- **Para llevar** — Cliente recoge en caja cuando está listo

---

## 2. STACK TECNOLÓGICO (Obligatorio)

```
Frontend:   React 19 + Vite 6 + TypeScript + Tailwind v4
Backend:    Express + Prisma ORM
Database:   PostgreSQL (Railway)
Auth:       JWT custom (admin separado de usuarios operativos)
Hosting:    Railway Pro ($20/mes)
Imágenes:   Cloudinary (opcional por ahora, para logos/fotos de menú)
PWA:        Sí, para tablets y teléfonos
```

**Reglas del stack (aprendidas de proyectos anteriores):**
- NO usar React Router v6.30+ con BrowserRouter anidado — usar un solo RouterProvider o HashRouter custom en App.tsx
- Tailwind v4 necesita `@tailwindcss/vite` plugin en `vite.config.ts` — sin eso no genera CSS
- Build local + commit dist: Railway NO reconstruye, sirve lo commiteado
- CSP configurado correctamente para Cloudinary
- index.html no-cache, assets inmutables

---

## 3. MODELO DE DATOS (Prisma Schema)

### Tablas principales:

```
Restaurant
  id, name, slug, logo, address, phone, timezone, currency (default USD)
  settings: JSON (impuestos, propina sugerida, horarios, etc.)

User
  id, email, username, password (bcrypt), name, role, restaurantId
  roles: SUPERADMIN | ADMIN | CASHIER | COOK_1 | COOK_2 | WAITER | DELIVERY
  phone, avatar, active, lastLogin

Category
  id, name, type: COMBO | A_LA_CARTE | BEVERAGE | DESSERT | BREAKFAST | LUNCH | DINNER | SNACK | ASADO
  restaurantId, active, sortOrder

MenuItem
  id, name, description, basePrice, categoryId, restaurantId
  type: MAIN | PROTEIN | SIDE | DRINK | DESSERT
  kitchen: KITCHEN_1 (acompañantes) | KITCHEN_2 (proteína) | BAR (bebidas) | BOTH | NONE
  active, image (Cloudinary URL), prepTime (minutos estimados)
  modifiers: Modifier[]  ← relación a tabla de modificadores

Modifier (personalizaciones por ítem)
  id, menuItemId, name (ej: "Sin cebolla", "Término medio", "Queso extra")
  priceAdjustment (puede ser 0 o costo adicional)
  active

Combo
  id, name, description, basePrice, categoryId, restaurantId
  type: BREAKFAST | LUNCH | DINNER | SNACK | ASADO | CUSTOM
  active, image, availableDays: Int[] (bitmask o array de días)
  comboItems: ComboItem[]

ComboItem (ítems dentro de un combo)
  id, comboId, menuItemId, quantity, isOptional, alternatives: JSON
  Ej: Combo Almuerzo → { proteína: "pollo/res/cerdo", acompañante1: "arroz", acompañante2: "papas/ensalada", bebida: "gaseosa/jugo" }

Order
  id, restaurantId, tableNumber, customerName?, orderType: DINE_IN | TAKEAWAY | DELIVERY
  status: PENDING | PAID | PREPARING | READY | DELIVERED | CANCELLED
  subtotal, tax, tip, total, paymentMethod: CASH | CARD | TRANSFER
  cashierId (User que cobró), waiterId (User que entregó)
  createdAt, updatedAt, paidAt, deliveredAt

OrderItem
  id, orderId, menuItemId, comboId?, quantity, unitPrice, totalPrice
  notes, kitchen: KITCHEN_1 | KITCHEN_2 | BAR | BOTH
  status: PENDING | PREPARING | READY | DELIVERED
  modifiers: JSON [{modifierId, name, priceAdjustment}]

Inventory (insumos)
  id, name, category, unit (kg, L, unidad), currentStock, minStock, costPerUnit
  restaurantId, supplierId?
  lastRestockDate

Supplier
  id, name, contact, phone, email, restaurantId

Expense
  id, restaurantId, category (FOOD, BEVERAGE, CLEANING, RENT, UTILITIES, PAYROLL, OTHER)
  amount, description, date, supplierId?, receiptUrl?

CashRegister (flujo de caja)
  id, restaurantId, openedAt, closedAt, openingBalance, closingBalance
  cashierId, totalSales, totalCash, totalCard, totalTransfer
  status: OPEN | CLOSED

DeliveryOrder (aparte de Order para tracking)
  id, orderId, driverId (User role=DELIVERY), customerAddress, customerPhone
  status: ASSIGNED | PICKED_UP | IN_TRANSIT | DELIVERED
  estimatedTime, actualDeliveryTime, deliveryFee

Customer (CRM básico)
  id, name, phone, email, restaurantId
  visitCount, lastVisit, totalSpent, tags: JSON
  dietaryPreferences, allergies, notes

Subscription (suscripción del restaurante)
  id, restaurantId (único), plan: FREE | BASIC | PRO | ENTERPRISE
  status: ACTIVE | TRIAL | PAST_DUE | CANCELED | EXPIRED
  trialEndsAt, currentPeriodStart, currentPeriodEnd
  price, billingCycle: MONTHLY | ANNUAL
  paymentMethod, lastPaymentDate, nextPaymentDate
  maxUsers, maxProducts, maxCombos (según plan)
  features: JSON (feature flags: delivery, reports_advanced, whatsapp, etc.)
  createdAt, updatedAt
```

---

## 3.5 ARQUITECTURA MULTI-TENANT (⚠️ CRÍTICO)

Comanda es una plataforma SaaS multi-restaurante:

- **SUPERADMIN** (nosotros) — gestiona TODOS los restaurantes, suscripciones, planes, facturación
- **Cada restaurante** se registra y obtiene su ADMIN, que gestiona su propio menú, cajeros, cocinas, meseros
- **Aislamiento total:** Los datos de cada restaurante son invisibles para otros restaurantes

### Flujo de registro de un nuevo restaurante:
1. El restaurante potencial visita `comanda.app/registro`
2. Completa formulario: nombre, dirección, teléfono, slug (ej: `el-rancho`)
3. Elige plan (FREE/TRIAL de 14 días por defecto)
4. Se crea: Restaurant + User (ADMIN) + Subscription (TRIAL)
5. El ADMIN recibe credenciales y accede a `comanda.app/admin`
6. Desde su panel, crea sus usuarios (cajeros, cocinas, meseros)
7. Configura mesas, menú, impuestos, etc.

### Panel SUPERADMIN (vista global de la plataforma)
- Dashboard con métricas consolidadas de todos los restaurantes
- Lista de restaurantes con: nombre, plan, estado suscripción, usuarios activos, facturación
- CRUD de restaurantes (crear nuevo, suspender, reactivar)
- Gestión de suscripciones (cambiar plan, ver historial de pagos)
- Registro de actividad global
- Solo accesible por usuarios con rol SUPERADMIN

### Middleware de aislamiento por restaurante:
- Todo endpoint de ADMIN/CASHIER/COOK/WAITER/DELIVERY filtra automáticamente por `restaurantId` del JWT
- El SUPERADMIN (restaurantId = null) puede ver todos los restaurantes
- Si un ADMIN intenta acceder a datos de otro restaurante → 403 Forbidden
```

---

## 4. PANTALLAS Y FLUJOS

### 4.1 Login / Autenticación
- Pantalla de login unificada
- Al autenticar, redirige según rol:
  - CASHIER → POS / Caja (filtrado por su restaurantId)
  - COOK_1 / COOK_2 → KDS Cocina (filtrado por su restaurantId)
  - WAITER → Panel Mesero (filtrado por su restaurantId)
  - DELIVERY → Panel Delivery (filtrado por su restaurantId)
  - ADMIN → Dashboard Admin de su restaurante
  - SUPERADMIN → Panel SUPERADMIN (vista global, todos los restaurantes)
- JWT con expiración configurable
- "Recordarme" opcional
- El JWT incluye restaurantId (null para SUPERADMIN) para filtrar datos automáticamente

### 4.1.1 Registro de nuevo restaurante (público)
- Página pública: `comanda.app/registro`
- Formulario: nombre del restaurante, slug, dirección, teléfono, email del admin, contraseña
- Al registrarse: automáticamente se crea Restaurant + User ADMIN + Subscription TRIAL 14 días
- Redirige al login con mensaje de éxito

### 4.1.2 Panel SUPERADMIN
**Solo accesible por usuarios con rol SUPERADMIN (restaurantId = null).** Esta es la vista global del negocio.

Dashboard SUPERADMIN:
- Total restaurantes registrados
- Restaurantes activos vs inactivos
- Ingresos mensuales proyectados (suma de suscripciones)
- Nuevos registros este mes
- Tasa de conversión de trial → pago

Secciones:
├── Restaurantes
│   ├── Lista con filtros (plan, estado, antigüedad)
│   ├── Crear nuevo restaurante (manual)
│   ├── Ver detalle: datos, usuarios, métricas
│   ├── Suspender / Reactivar restaurante
│   └── Métricas por restaurante (ventas, órdenes, usuarios activos)
├── Suscripciones
│   ├── Lista de suscripciones con estado
│   ├── Cambiar plan (FREE → BASIC → PRO → ENTERPRISE)
│   ├── Ver historial de pagos
│   ├── Planes y precios configurables
│   └── Alertas de suscripciones por vencer o vencidas
└── Actividad Global
    ├── Log de eventos importantes (nuevos registros, upgrades, cancelaciones)
    └── Exportar reportes consolidados

### 4.2 POS — Punto de Venta (CAJA)
**Esta es la pantalla más crítica del MVP.** Diseño tipo panel dividido:

```
┌─────────────────────────┬──────────────────────┐
│  MENÚ DE PRODUCTOS      │  ORDEN ACTUAL         │
│                          │                        │
│  [Categorías como tabs] │  Mesa: [Piso 1 - M4]  │
│  [Desayunos] [Almuerzos]│  Cliente: Juan         │
│  [A la Carta] [Bebidas] │                        │
│  [Postres] [Asados]     │  1x Almuerzo Ejecutivo │
│                          │    - Proteína: Pollo   │
│  ┌──────┐ ┌──────┐      │    - Acomp: Arroz      │
│  │ Item │ │ Item │      │    - Acomp: Ensalada    │
│  │ $12  │ │ $15  │      │    - Bebida: Coca-Cola │
│  └──────┘ └──────┘      │    - Nota: sin cebolla  │
│  ┌──────┐ ┌──────┐      │                     $8 │
│  │ Item │ │ Item │      │  2x Gaseosa         $5 │
│  └──────┘ └──────┘      │                        │
│                          │  Subtotal:     $13.00  │
│  [Buscar producto...]    │  IVA 12%:       $1.56  │
│                          │  Servicio 10%:  $1.30  │
│                          │  ─────────────────────  │
│                          │  TOTAL:        $15.86  │
│                          │                        │
│                          │  [Efectivo] [Tarjeta]  │
│                          │  [Transferencia]       │
│                          │  [CANCELAR] [COBRAR]   │
└─────────────────────────┴──────────────────────┘
```

**Funcionalidades del POS:**
- Seleccionar mesa antes de empezar orden
- Tabs de categorías con scroll horizontal (mobile-friendly)
- Grid de productos con foto, nombre y precio
- Click en producto = agregar a orden
- Click en combo = desplegar modal para seleccionar opciones (proteína, acompañantes, bebida)
- Cada ítem puede tener modificadores (checkboxes con precio adicional)
- Campo de notas por ítem
- Contador ± para cantidades
- Resumen de orden en tiempo real con subtotal, impuestos, servicio, total
- Botones de método de pago
- Al cobrar: se imprime ticket digital (se envía a cocina KDS) + se registra en caja
- Teclado rápido para cantidades (numpad en pantalla)
- Búsqueda de productos por nombre
- Vista de órdenes activas (pendientes de cocina, listas para entregar)
- Capacidad de anular ítem o cancelar orden completa (con motivo)

### 4.3 KDS — Kitchen Display System (COCINA)
**Tablet en pared, orientación landscape, modo siempre encendido.**

Pantalla dividida:
```
┌──────────────────────┬──────────────────────┐
│  COCINA 1 - ACOMP.  │  COCINA 2 - PROTEÍNA │
│                      │                      │
│  [NUEVOS] [EN PREP] │  [NUEVOS] [EN PREP]  │
│                      │                      │
│  ┌────────────────┐  │  ┌────────────────┐  │
│  │ Mesa 4 - #0012 │  │  │ Mesa 4 - #0012 │  │
│  │ Arroz          │  │  │ Pollo a la plan│  │
│  │ Ensalada       │  │  │   Término medio│  │
│  │   hace 2 min   │  │  │   hace 2 min   │  │
│  │ [PREPARANDO]   │  │  │ [PREPARANDO]   │  │
│  └────────────────┘  │  └────────────────┘  │
│  ┌────────────────┐  │  ┌────────────────┐  │
│  │ Mesa 2 - #0011 │  │  │ Mesa 2 - #0011 │  │
│  │ Papas fritas   │  │  │ Carne asada    │  │
│  │ Maduros        │  │  │   3/4           │  │
│  │   hace 5 min   │  │  │   hace 5 min   │  │
│  │ [LISTO ✓]      │  │  │ [PREPARANDO]   │  │
│  └────────────────┘  │  └────────────────┘  │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

**Funcionalidades KDS:**
- Vista en tiempo real (polling cada 5s o WebSocket)
- Tarjetas de orden grandes, legibles a distancia
- Código de colores por tiempo: verde (<3 min), amarillo (3-6 min), rojo (>6 min)
- Sonido de alerta al recibir nueva orden (opcional, configurable)
- Botón "PREPARANDO" → cambia estado y color
- Botón "LISTO ✓" → notifica al mesero
- Solo muestra ítems de su cocina (COOK_1 ve KITCHEN_1, COOK_2 ve KITCHEN_2)
- Contador de tiempo desde que se recibió la orden
- Opción de marcar ítem individual o toda la orden de una mesa
- Modo noche (brillo reducido)

### 4.4 Panel MESERO (Teléfono)
- Vista de órdenes listas para entregar
- Muestra: mesa, items, tiempo que lleva listo
- Al entregar: marca como ENTREGADO → la orden se completa
- Notificación push/audio cuando ambas cocinas terminan una orden
- Historial de entregas del día

### 4.5 Dashboard ADMIN (PC/Tablet)

```
Dashboard principal:
- Ventas del día (total, promedio por mesa, cantidad órdenes)
- Gráfico de ventas por hora
- Órdenes activas en tiempo real
- Estado de caja (abierta/cerrada, balance)
- Alertas (ítems agotados, stock bajo)

Secciones del admin:
├── Menú
│   ├── Categorías (CRUD + orden)
│   ├── Productos (CRUD + modificadores + imagen)
│   └── Combos (configurar combos con opciones)
├── Órdenes
│   ├── Historial con filtros (fecha, mesa, tipo, estado)
│   ├── Detalle de orden
│   └── Exportar a Excel/PDF
├── Inventario
│   ├── Insumos (CRUD + stock)
│   ├── Alertas de stock bajo
│   ├── Registro de entradas/salidas
│   └── Proveedores (CRUD)
├── Reportes
│   ├── Ventas (diarias, semanales, mensuales)
│   ├── Productos más vendidos
│   ├── Combos más vendidos
│   ├── Horas pico
│   ├── Mesas más rentables
│   └── Margen por producto
├── Caja
│   ├── Apertura de caja (balance inicial)
│   ├── Cierre de caja (balance final, desglose)
│   ├── Historial de cierres
│   └── Gastos del día
├── Usuarios
│   ├── CRUD con asignación de roles
│   ├── Permisos granulares por rol
│   └── Historial de actividad
├── Delivery
│   ├── Motoristas (CRUD)
│   ├── Zonas de entrega
│   ├── Tarifas por zona
│   └── Tracking de órdenes delivery
├── CRM / Clientes
│   ├── Lista de clientes frecuentes
│   ├── Historial de consumo
│   ├── Preferencias y alergias
│   └── Notas internas
└── Configuración
    ├── Datos del restaurante
    ├── Impuestos y servicio (%)
    ├── Horarios de operación
    ├── Mesas (CRUD, pisos, numeración)
    └── Integraciones (WhatsApp, impresora, etc.)
```

---

## 5. REGLAS DE NEGOCIO IMPORTANTES

1. **Un combo puede personalizarse** — Ej: "Almuerzo Ejecutivo" permite elegir entre pollo/res/cerdo + 2 acompañantes + bebida. Cada opción tiene costo base incluido, extras cuestan adicional.

2. **Modificadores con y sin costo** — "Sin cebolla" no cuesta, "Queso extra +$1.50" sí. Deben reflejarse en el ticket de cocina.

3. **División automática a cocinas** — Al crear orden, el backend separa cada OrderItem según su campo `kitchen` y lo envía solo a la tablet correspondiente.

4. **Tiempo máximo de preparación** — Si un ítem excede su `prepTime`, se marca en rojo en KDS. Alertas configurables.

5. **Mesa es requerida** — Toda orden DINE_IN debe tener mesa asignada (validación en backend)

6. **Caja debe estar abierta** — No se puede cobrar si la caja no fue abierta (por admin al iniciar turno)

7. **Cierre de caja** — Calcula automáticamente: balance inicial + ventas - gastos = balance esperado vs real

8. **Delivery** — Órdenes delivery no tienen mesa. Se asigna motorista + zona de entrega + tarifa.

9. **Productos agotados** — Si un producto tiene stock=0, se deshabilita automáticamente del POS.

10. **Roles y permisos granulares** — Definir en seed qué puede hacer cada rol. SUPERADMIN=acceso global (restaurantId=null), gestiona restaurantes y suscripciones. ADMIN=admin de UN restaurante (CRUD productos, usuarios, reportes). CASHIER=solo POS + caja (filtrado por restaurantId). COOK=solo KDS (filtrado por restaurantId). WAITER=solo panel mesero (filtrado por restaurantId). DELIVERY=solo delivery (filtrado por restaurantId).

11. **Aislamiento multi-tenant obligatorio** — Toda query de usuarios no-SUPERADMIN debe filtrar por `restaurantId` del JWT. Si el JWT no tiene restaurantId (es SUPERADMIN), ve todo. Middleware que inyecta `req.restaurantId` en cada request. Las rutas de admin/operativas usan ese valor para filtrar los datos.

12. **Límites por plan de suscripción** — El backend debe validar que el restaurante no exceda los límites de su plan (máx usuarios, máx productos, features habilitadas). Si excede → 403 con mensaje "Límite de tu plan alcanzado. Actualiza a {siguiente plan}."

---

## 6. UX/UI — Principios de diseño

**Estilo general:**
- Tema oscuro por defecto (cocinas, POS)
- Modo claro opcional para admin
- Paleta: fondo oscuro (#0f172a slate-900), acentos en emerald/amber según sección, tarjetas en slate-800
- Tipografía: Inter (UI) + mono espaciada para tiempos
- Iconografía: Lucide React (gratuito, completo)
- Animaciones: transiciones suaves (150-200ms), sin exagerar
- Responsive: mobile-first, pero optimizado para landscape en tablets

**Principios clave:**
- **Velocidad ante todo** — el POS debe ser instantáneo, sin loading visible
- **Legibilidad a distancia** — KDS debe poder leerse a 2 metros
- **Touch-friendly** — botones grandes (mín 44px), sin hover-dependencia
- **Sonido con moderación** — solo para alertas importantes, con toggle
- **Sin scroll infinito** — categorías con tabs, productos en grid paginado

---

## 7. ESTRUCTURA DEL PROYECTO

```
comanda/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── index.ts          # Express + bootstrap
│   │   ├── dbSync.ts         # Schema sync
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT auth + role check
│   │   │   ├── tenant.ts     # Aislamiento multi-tenant (extrae restaurantId del JWT, lo inyecta en req)
│   │   │   ├── subscription.ts # Validación de límites del plan
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── menu.ts       # categorías, productos, modificadores
│   │   │   ├── combos.ts
│   │   │   ├── orders.ts     # CRUD + cambio de estados
│   │   │   ├── kitchen.ts    # endpoints KDS
│   │   │   ├── cashRegister.ts
│   │   │   ├── inventory.ts
│   │   │   ├── reports.ts
│   │   │   ├── delivery.ts
│   │   │   ├── customers.ts  # CRM
│   │   │   ├── restaurant.ts # settings
│   │   │   ├── subscriptions.ts
│   │   │   └── superadmin.ts # SUPERADMIN global
│   │   ├── controllers/
│   │   └── services/
│   ├── public/               # Frontend build (commiteado)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── POSLayout.tsx     # Layout del punto de venta
│   │   │   ├── KDSLayout.tsx     # Layout de cocina
│   │   │   ├── AdminLayout.tsx   # Layout admin con sidebar
│   │   │   ├── ProductCard.tsx   # Tarjeta de producto para POS
│   │   │   ├── ComboModal.tsx    # Modal de selección de combo
│   │   │   ├── OrderPanel.tsx    # Panel derecho del POS
│   │   │   ├── KDSTicket.tsx     # Tarjeta de orden en cocina
│   │   │   ├── Numpad.tsx        # Teclado numérico rápido
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterRestaurantPage.tsx   # Registro público de nuevo restaurante
│   │   │   ├── pos/
│   │   │   │   └── POSPage.tsx       # La pantalla principal de caja
│   │   │   ├── kitchen/
│   │   │   │   └── KDSPage.tsx       # Pantalla de cocina
│   │   │   ├── waiter/
│   │   │   │   └── WaiterPage.tsx    # Panel mesero
│   │   │   ├── admin/
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── MenuPage.tsx
│   │   │   │   ├── OrdersPage.tsx
│   │   │   │   ├── InventoryPage.tsx
│   │   │   │   ├── ReportsPage.tsx
│   │   │   │   ├── CashRegisterPage.tsx
│   │   │   │   ├── UsersPage.tsx
│   │   │   │   ├── DeliveryPage.tsx
│   │   │   │   ├── CustomersPage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   └── delivery/
│   │   │       └── DeliveryPage.tsx
│   │   ├── pages/
│   │   │   ├── superadmin/
│   │   │   │   ├── SuperDashboardPage.tsx
│   │   │   │   ├── RestaurantsPage.tsx
│   │   │   │   ├── RestaurantDetailPage.tsx
│   │   │   │   ├── SubscriptionsPage.tsx
│   │   │   │   └── ActivityLogPage.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── usePOS.ts
│   │   │   ├── useKDS.ts
│   │   │   └── usePolling.ts   # Polling eficiente para KDS
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── config.ts
│   │   └── styles/
│   │       └── index.css       # Tailwind imports
│   ├── vite.config.ts
│   └── package.json
├── railway.json
└── package.json (root con scripts de build)
```

---

## 8. API ENDPOINTS (mínimo necesario)

```
Auth:
POST   /api/auth/login
POST   /api/auth/register   (solo SUPERADMIN/ADMIN)
GET    /api/auth/me
PUT    /api/auth/change-password

Usuarios:
GET    /api/users            (admin)
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
PATCH  /api/users/:id/toggle-active

Menú:
GET    /api/categories
POST   /api/categories       (admin)
PUT    /api/categories/:id
DELETE /api/categories/:id
GET    /api/products?category=X&active=true
POST   /api/products         (admin)
PUT    /api/products/:id
DELETE /api/products/:id
PATCH  /api/products/:id/toggle-active
GET    /api/products/:id/modifiers
POST   /api/products/:id/modifiers
PUT    /api/modifiers/:id
DELETE /api/modifiers/:id

Combos:
GET    /api/combos?category=X
POST   /api/combos           (admin)
PUT    /api/combos/:id
DELETE /api/combos/:id

Órdenes:
POST   /api/orders            # Crear (desde caja)
GET    /api/orders?status=X&date=Y  # Listar con filtros
GET    /api/orders/:id
PATCH  /api/orders/:id/status # Cambiar estado
POST   /api/orders/:id/pay    # Registrar pago
GET    /api/orders/:id/ticket # Datos para ticket/KDS

Cocina KDS:
GET    /api/kitchen/orders?kitchen=1&status=PENDING,IN_PROGRESS
PATCH  /api/kitchen/items/:id/status  # PREPARING → READY

Mesero:
GET    /api/waiter/pending    # Órdenes listas para entregar
PATCH  /api/orders/:id/deliver

Caja:
POST   /api/cash-register/open
POST   /api/cash-register/close
GET    /api/cash-register/current
GET    /api/cash-register/history?from=X&to=Y

Delivery:
POST   /api/delivery/assign
PATCH  /api/delivery/:id/status
GET    /api/delivery/active
GET    /api/delivery/history

Reportes:
GET    /api/reports/sales?from=X&to=Y
GET    /api/reports/top-products?from=X&to=Y
GET    /api/reports/hourly?date=X
GET    /api/reports/summary?date=X

Inventario:
GET    /api/inventory
POST   /api/inventory
PUT    /api/inventory/:id
POST   /api/inventory/:id/restock

Clientes CRM:
GET    /api/customers
POST   /api/customers
PUT    /api/customers/:id
GET    /api/customers/:id/history

Settings:
GET    /api/restaurant/settings
PUT    /api/restaurant/settings
GET    /api/restaurant/tables
POST   /api/restaurant/tables
DELETE /api/restaurant/tables/:id

SUPERADMIN (solo restaurantId=null):
GET    /api/superadmin/restaurants          # Lista todos los restaurantes
POST   /api/superadmin/restaurants          # Crear nuevo restaurante + admin + subscription
PUT    /api/superadmin/restaurants/:id      # Editar datos
PATCH  /api/superadmin/restaurants/:id/suspend
PATCH  /api/superadmin/restaurants/:id/reactivate
GET    /api/superadmin/restaurants/:id      # Detalle con métricas
GET    /api/superadmin/subscriptions
PUT    /api/superadmin/subscriptions/:id    # Cambiar plan
GET    /api/superadmin/metrics              # Métricas consolidadas
GET    /api/superadmin/activity-log         # Log de eventos globales

Registro público:
POST   /api/register                        # Crear restaurante + admin + trial
GET    /api/plans                           # Planes disponibles (público)
```

---

## 9. SEED DATA

Crear seed data realista para desarrollo:

**Restaurante:** "Comanda Demo"
**Categorías:** Desayunos, Almuerzos, Meriendas, A la Carta, Asados, Bebidas, Postres
**Productos mínimos:** 20-30 productos entre proteínas, acompañantes, bebidas
**Combos mínimos:** 3 combos (Desayuno Americano, Almuerzo Ejecutivo, Asado Parrillero)
**Usuarios seed:**
- superadmin@comanda.app / Admin123! (SUPERADMIN, restaurantId=null)
- admin@comanda.app / Admin123! (ADMIN, restaurantId=restaurante-demo)
- caja@comanda.app / Caja123! (CASHIER, restaurantId=restaurante-demo)
- cocina1@comanda.app / Cocina123! (COOK_1, restaurantId=restaurante-demo)
- cocina2@comanda.app / Cocina123! (COOK_2, restaurantId=restaurante-demo)
- mesero1@comanda.app / Mesero123! (WAITER, restaurantId=restaurante-demo)
- mesero2@comanda.app / Mesero123! (WAITER, restaurantId=restaurante-demo)
- delivery@comanda.app / Delivery123! (DELIVERY, restaurantId=restaurante-demo)

**Suscripción seed:**
- restaurante-demo: plan PRO, status ACTIVE (para desarrollo sin restricciones)

**Planes predefinidos:**
- FREE: 1 caja, 1 cocina, 1 mesero, 50 productos, sin delivery, sin reportes avanzados
- TRIAL: 14 días gratis con funcionalidad PRO completa
- BASIC: $29/mes — 2 cajas, 2 cocinas, 3 meseros, 200 productos, delivery básico
- PRO: $59/mes — 5 cajas, 5 cocinas, 10 meseros, productos ilimitados, delivery avanzado, reportes
- ENTERPRISE: $99/mes — ilimitado + WhatsApp IA + Kiosco autoservicio + API + soporte prioritario

---

## 10. ASPECTOS TÉCNICOS OBLIGATORIOS

1. **Real-time con polling** — No usar WebSockets por ahora (Railway puede ser problemático). Polling cada 5s en KDS y waiter con `setInterval` + cleanup.

2. **Optimistic UI en POS** — Al agregar producto a la orden, reflejarlo inmediatamente en UI. No esperar respuesta del servidor.

3. **Modo offline básico** — La app debe seguir funcionando si hay pérdida breve de conexión (local state). Sincronizar al reconectar.

4. **PWA** — Service worker para cache de assets. Installable en tablet/teléfono. Manifest.json con íconos.

5. **Código limpio** — TypeScript estricto. Nada de `any`. Componentes pequeños y reutilizables. Comentarios solo donde realmente aporten.

6. **Seguridad** — JWT en localStorage solo para admin. Para usuarios operativos (cajero, cocina), JWT con expiración de turno (12h). Nunca exponer service keys en frontend.

7. **Railway deploy** — `railway.json` con buildCommand (solo install backend) y startCommand. Frontend compilado commiteado en `backend/public/`.

---

## 11. FASES DE IMPLEMENTACIÓN

**Fase 1 — Core MVP (hoy):**
- [x] Schema Prisma completo + migración
- [x] Seed data
- [x] Auth (login + JWT + roles)
- [x] POS (menú, categorías, orden, cobro)
- [x] KDS Cocina (ambas pantallas)
- [x] Panel Mesero (entregas)
- [x] Dashboard Admin básico (ventas del día)

**Fase 2 — Admin completo:**
- [ ] CRUD de menú, combos, modificadores
- [ ] Reportes y gráficos
- [ ] Gestión de usuarios y permisos
- [ ] Caja (apertura/cierre)
- [ ] Inventario básico
- [ ] CRM clientes

**Fase 3 — Delivery + Avanzado:**
- [ ] Delivery tracking
- [ ] Integración WhatsApp (notificaciones)
- [ ] Exportación reportes
- [ ] Encuestas de satisfacción
- [ ] Programa de fidelización

---

## 12. REFERENCIA COMPETITIVA — restaurant.pe

Funcionalidades de restaurant.pe que debemos igualar o superar:
- ✅ Punto de Venta (facturación y caja)
- ✅ Tomador de Pedidos (carta digital)
- ✅ Logística (insumos, bodega, recetas, compras)
- ✅ Costos y Gastos
- ✅ Integración Apps Delivery
- ✅ Restaurant BI (business intelligence)
- ✅ Encuestas
- ✅ Delivery Pro
- ✅ CRM y Fidelización
- ✅ Kiosco de Autoservicio (futuro)
- ✅ WhatsApp IA para pedidos (futuro)
- ✅ App Manager (supervisión operativa)
- ✅ App Repartidores

Nuestra ventaja: Más rápido, mejor UX, mobile-first real, PWA sin instalar apps nativas, open source para el cliente, sin licencias mensuales abusivas.

---

## 13. INSTRUCCIONES PARA CLAUDE

1. **Leer este prompt completo antes de escribir una línea de código**
2. **Crear el proyecto desde cero** con la estructura indicada
3. **Empezar por el schema de Prisma** — es la base de todo
4. **Fase 1 completa** — POS + KDS + Mesero + Auth + Dashboard básico
5. **Usar TypeScript estricto**
6. **No usar librerías innecesarias** — solo lo esencial: React, Vite, Tailwind, Prisma, Express, JWT, bcrypt, Lucide React
7. **Testear que compile** antes de entregar
8. **Si hay ambigüedad, tomar la decisión más pragmática y documentarla**

---

*Prompt generado por Timmy ⚡ para el proyecto Comanda — 2026-05-27*
