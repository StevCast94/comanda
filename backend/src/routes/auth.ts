import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, signToken } from "../middleware/auth";
import { isCommonPassword } from "../lib/commonPasswords";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .refine((p) => !isCommonPassword(p), "Contraseña demasiado común, elige otra"),
});

/**
 * S7 — Registra cada intento de login (éxito o fallo) en AuthLog.
 * Si hay ≥10 fallos para el mismo username en los últimos 15 min, alerta
 * por consola (futura notificación al SUPERADMIN). No bloquea el flujo:
 * cualquier error de logging se traga para no romper el login.
 */
async function recordAuthAttempt(
  req: Request,
  username: string | undefined,
  success: boolean,
  userId?: string
): Promise<void> {
  try {
    await prisma.authLog.create({
      data: {
        userId: userId ?? null,
        username: username ?? null,
        ip: req.ip ?? null,
        userAgent: req.headers["user-agent"]?.slice(0, 255) ?? null,
        success,
      },
    });

    if (!success && username) {
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const fails = await prisma.authLog.count({
        where: { username, success: false, createdAt: { gte: since } },
      });
      if (fails >= 10) {
        console.error(
          `[AUTH ALERT] ${fails} intentos fallidos para "${username}" en 15min (IP ${req.ip})`
        );
      }
    }
  } catch (err) {
    console.error("AuthLog error:", err);
  }
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      await recordAuthAttempt(req, username, false, user?.id);
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await recordAuthAttempt(req, username, false, user.id);
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    await recordAuthAttempt(req, username, true, user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Set expiration based on role
    const expiresIn = user.role === "ADMIN" || user.role === "SUPERADMIN" ? "24h" : "12h";

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      tokenVersion: user.tokenVersion,
    }, expiresIn);

    // Include restaurant data so frontend has settings immediately
    let restaurant = null;
    if (user.restaurantId) {
      restaurant = await prisma.restaurant.findUnique({
        where: { id: user.restaurantId },
        select: { id: true, name: true, slug: true, logo: true, settings: true, currency: true },
      });
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        restaurantId: user.restaurantId,
        avatar: user.avatar,
        restaurant,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, name: true, username: true,
        role: true, restaurantId: true, avatar: true, phone: true,
        restaurant: { select: { id: true, name: true, slug: true, logo: true, settings: true, currency: true } },
      },
    });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// PUT /api/auth/change-password
router.put("/change-password", authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(400).json({ error: "Contraseña actual incorrecta" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      // S5 — incrementar tokenVersion invalida todos los JWT emitidos antes
      // (incluido el actual): el usuario deberá iniciar sesión de nuevo.
      data: { password: hashed, tokenVersion: { increment: 1 } },
    });

    res.json({ message: "Contraseña actualizada. Inicia sesión de nuevo." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
