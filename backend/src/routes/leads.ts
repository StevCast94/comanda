import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../index";

const router = Router();

const leadSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  restaurant: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

// POST /api/leads — Public landing page form
router.post("/", async (req: Request, res: Response) => {
  try {
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
