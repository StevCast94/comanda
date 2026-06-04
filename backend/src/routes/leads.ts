import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../index";

const router = Router();

// S8 — rate-limit dedicado: 5 leads / 15 min por IP.
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos." },
});

const leadSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  restaurant: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

// POST /api/leads — Public landing page form
router.post("/", leadLimiter, async (req: Request, res: Response) => {
  try {
    // S8 — honeypot: si el campo oculto viene relleno, es un bot.
    // TODO: anti-bot más fuerte → Cloudflare Turnstile.
    if (typeof req.body?.honeypot === "string" && req.body.honeypot.trim() !== "") {
      res.status(201).json({ message: "Recibido! Te contactaremos pronto." });
      return;
    }

    const data = leadSchema.parse(req.body);
    const lead = await prisma.lead.create({ data });
    res.status(201).json({ message: "Recibido! Te contactaremos pronto.", lead });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error("Lead error:", err);
    res.status(500).json({ error: "Error" });
  }
});

export default router;
