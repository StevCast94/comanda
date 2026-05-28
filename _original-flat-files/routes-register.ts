import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../index";

const router = Router();

const registerSchema = z.object({
  restaurantName: z.string().min(2, "Nombre del restaurante requerido"),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  address: z.string().optional(),
  phone: z.string().optional(),
  adminName: z.string().min(2, "Nombre del administrador requerido"),
  adminEmail: z.string().email("Email inválido"),
  adminPassword: z.string().min(6, "Mínimo 6 caracteres"),
});

// POST /api/register — Public registration of a new restaurant
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check unique slug
    const existingSlug = await prisma.restaurant.findUnique({ where: { slug: data.slug } });
    if (existingSlug) {
      res.status(409).json({ error: "Ese slug ya está en uso. Prueba otro." });
      return;
    }

    // Check unique email
    const existingEmail = await prisma.user.findUnique({ where: { email: data.adminEmail } });
    if (existingEmail) {
      res.status(409).json({ error: "Ese email ya está registrado." });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Transaction: Restaurant + Admin User + Trial Subscription
    const result = await prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.restaurantName,
          slug: data.slug,
          address: data.address,
          phone: data.phone,
          settings: { taxRate: 0.15, serviceRate: 0.10, defaultTip: 0 },
        },
      });

      const admin = await tx.user.create({
        data: {
          email: data.adminEmail,
          username: data.slug + "-admin",
          password: hashedPassword,
          name: data.adminName,
          role: "ADMIN",
          restaurantId: restaurant.id,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          plan: "TRIAL",
          status: "TRIAL",
          trialEndsAt,
          price: 0,
          maxUsers: 20,
          maxProducts: 9999,
          maxCombos: 9999,
          features: { delivery: true, advancedReports: true, whatsapp: false },
        },
      });

      // Create default tables (6 tables)
      await tx.table.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          restaurantId: restaurant.id,
          number: i + 1,
          floor: "Piso 1",
          capacity: 4,
        })),
      });

      return { restaurant, admin, subscription };
    });

    res.status(201).json({
      message: "¡Restaurante registrado! Tu prueba gratuita de 14 días ha comenzado.",
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
      },
      admin: {
        email: result.admin.email,
        name: result.admin.name,
      },
      trialEndsAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
