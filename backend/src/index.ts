import express from "express";
import cors from "cors";
import path from "path";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import registerRoutes from "./routes/register";
import userRoutes from "./routes/users";
import categoryRoutes from "./routes/categories";
import productRoutes from "./routes/products";
import comboRoutes from "./routes/combos";
import orderRoutes from "./routes/orders";
import kitchenRoutes from "./routes/kitchen";
import waiterRoutes from "./routes/waiter";
import cashRegisterRoutes from "./routes/cashRegister";
import inventoryRoutes from "./routes/inventory";
import customerRoutes from "./routes/customers";
import reportRoutes from "./routes/reports";
import deliveryRoutes from "./routes/delivery";
import settingsRoutes from "./routes/settings";
import superadminRoutes from "./routes/superadmin";
import plansRoutes from "./routes/plans";

export const prisma = new PrismaClient();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Global Middleware ──────────────────────────────────────
app.set("trust proxy", 1); // Railway uses reverse proxy
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Rate limiting: 300 requests/min per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
}));

// ─── API Routes ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/register", registerRoutes);
app.use("/api/plans", plansRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/combos", comboRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/waiter", waiterRoutes);
app.use("/api/cash-register", cashRegisterRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/restaurant", settingsRoutes);
app.use("/api/superadmin", superadminRoutes);

// ─── Static Files (Frontend Build) ─────────────────────────
const publicPath = path.join(__dirname, "..", "..", "public");
app.use(express.static(publicPath, {
  maxAge: "1y",
  immutable: true,
  index: false,
}));

// index.html — no cache (Express 5 compatible catch-all)
app.get("/{*path}", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(publicPath, "index.html"));
});

// ─── Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────
async function main() {
  await prisma.$connect();
  console.log("✅ Database connected");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🍽️  Comanda running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});
