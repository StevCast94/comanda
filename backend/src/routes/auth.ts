import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../index";
import { authenticate, signToken } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Mínimo 6 caracteres"),
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

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

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    res.json({ message: "Contraseña actualizada" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
