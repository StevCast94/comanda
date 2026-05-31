"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
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
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || "3000", 10);
// ─── Global Middleware ──────────────────────────────────────
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json({ limit: "10mb" }));
// Rate limiting: 300 requests/min per IP
app.use((0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
}));
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
// ─── Static Files (Frontend Build) ─────────────────────────
app.use(express_1.default.static(path_1.default.join(__dirname, "..", "public"), {
    maxAge: "1y",
    immutable: true,
    index: false,
}));
// index.html — no cache (Express 5 compatible catch-all)
app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path_1.default.join(__dirname, "..", "public", "index.html"));
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