"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const register_1 = __importDefault(require("./routes/register"));
const users_1 = __importDefault(require("./routes/users"));
const categories_1 = __importDefault(require("./routes/categories"));
const products_1 = __importDefault(require("./routes/products"));
const combos_1 = __importDefault(require("./routes/combos"));
const orders_1 = __importDefault(require("./routes/orders"));
const kitchen_1 = __importDefault(require("./routes/kitchen"));
const waiter_1 = __importDefault(require("./routes/waiter"));
const cashRegister_1 = __importDefault(require("./routes/cashRegister"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const customers_1 = __importDefault(require("./routes/customers"));
const reports_1 = __importDefault(require("./routes/reports"));
const delivery_1 = __importDefault(require("./routes/delivery"));
const settings_1 = __importDefault(require("./routes/settings"));
const superadmin_1 = __importDefault(require("./routes/superadmin"));
const plans_1 = __importDefault(require("./routes/plans"));
const leads_1 = __importDefault(require("./routes/leads"));
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || "3000", 10);
// ─── Global Middleware ──────────────────────────────────────
app.set("trust proxy", 1); // Railway uses reverse proxy
// ─── S2 — Helmet (security headers + HSTS) ──────────────────
// CSP se define por separado más abajo (S6) para controlar las directivas.
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    hsts: { maxAge: 15552000, includeSubDomains: true },
}));
// ─── S6 — Content Security Policy ───────────────────────────
// 'unsafe-inline' en styleSrc es necesario para Tailwind.
app.use(helmet_1.default.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
    },
}));
// ─── S4 — CORS whitelist ────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS ?? "https://comanda.one").split(",");
app.use((0, cors_1.default)({
    origin: (o, cb) => {
        if (!o || allowedOrigins.includes(o))
            return cb(null, true);
        cb(new Error("CORS not allowed"));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
// Rate limiting: 300 requests/min per IP
app.use((0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
}));
// ─── S3 — Rate-limit dedicado para login (fuerza bruta) ─────
// 10 intentos / 15 min por IP+username. Va después de express.json
// (para leer req.body.username) y antes de montar las rutas de auth.
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `${req.ip}:${req.body?.username ?? ""}`,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera 15 minutos." },
});
app.use("/api/auth/login", loginLimiter);
// ─── API Routes ─────────────────────────────────────────────
app.use("/api/auth", auth_1.default);
app.use("/api/register", register_1.default);
app.use("/api/plans", plans_1.default);
app.use("/api/users", users_1.default);
app.use("/api/categories", categories_1.default);
app.use("/api/products", products_1.default);
app.use("/api/combos", combos_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/kitchen", kitchen_1.default);
app.use("/api/waiter", waiter_1.default);
app.use("/api/cash-register", cashRegister_1.default);
app.use("/api/inventory", inventory_1.default);
app.use("/api/customers", customers_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/delivery", delivery_1.default);
app.use("/api/restaurant", settings_1.default);
app.use("/api/superadmin", superadmin_1.default);
app.use("/api/leads", leads_1.default);
// ─── Static paths ─────────────────────────────────────────
const publicPath = path_1.default.join(__dirname, "..", "..", "public");
// ─── Landing Pages ────────────────────────────────────────
app.get(["/", "/do"], (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, "index.html"));
});
// ─── App — React SPA under /app ───────────────────────────
const appPath = path_1.default.join(publicPath, "app");
app.use("/app", express_1.default.static(appPath, {
    maxAge: "1y",
    immutable: true,
    index: false,
}));
app.get("/app/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path_1.default.join(appPath, "index.html"));
});
// ─── Static Assets & legacy redirect to /app ───────────────
app.use(express_1.default.static(publicPath, { maxAge: "1y", immutable: true, index: false }));
// ─── Legacy catch-all redirect to landing ──────────────────
app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/")
        return next();
    res.redirect("/app/");
});
// ─── Error Handler ──────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ─── Start ──────────────────────────────────────────────────
async function main() {
    await exports.prisma.$connect();
    console.log("✅ Database connected");
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🍽️  Comanda running on port ${PORT}`);
    });
}
main().catch((err) => {
    console.error("❌ Failed to start:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map