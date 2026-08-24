import { Router as TktRouter, Request as TktReq, Response as TktRes } from "express";
import { prisma as tktPrisma } from "../index";
import { authenticate as tktAuth, authorize as tktAuthz } from "../middleware/auth";
import { tenantIsolation as tktTenant } from "../middleware/tenant";
import { z as tktZ } from "zod";

const tktRouter = TktRouter();
tktRouter.use(tktAuth, tktTenant);

const ticketListInclude = {
  restaurant: { select: { id: true, name: true, slug: true } },
  user: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} as const;

const ticketDetailInclude = {
  restaurant: { select: { id: true, name: true, slug: true } },
  user: { select: { id: true, name: true } },
  messages: {
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

// POST /api/tickets — ADMIN crea un ticket (con el primer mensaje)
const createSchema = tktZ.object({
  subject: tktZ.string().min(3).max(150),
  body: tktZ.string().min(1).max(4000),
});

tktRouter.post("/", tktAuthz("ADMIN"), async (req: TktReq, res: TktRes) => {
  try {
    const data = createSchema.parse(req.body);
    const ticket = await tktPrisma.ticket.create({
      data: {
        restaurantId: req.restaurantId!,
        userId: req.user!.userId,
        subject: data.subject,
        messages: { create: { userId: req.user!.userId, body: data.body } },
      },
      include: ticketDetailInclude,
    });
    res.status(201).json({ ticket });
  } catch (err) {
    if (err instanceof tktZ.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Error creando ticket" });
  }
});

// GET /api/tickets — ADMIN ve los de su restaurante, SUPERADMIN ve todos
tktRouter.get("/", tktAuthz("ADMIN", "SUPERADMIN"), async (req: TktReq, res: TktRes) => {
  try {
    const where: Record<string, unknown> = {};
    if (req.user!.role === "ADMIN") where.restaurantId = req.restaurantId!;
    const status = req.query.status as string | undefined;
    if (status) where.status = status;

    const tickets = await tktPrisma.ticket.findMany({
      where,
      include: ticketListInclude,
      orderBy: { updatedAt: "desc" },
    });
    res.json({ tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando tickets" });
  }
});

// GET /api/tickets/:id
tktRouter.get("/:id", tktAuthz("ADMIN", "SUPERADMIN"), async (req: TktReq, res: TktRes) => {
  try {
    const ticket = await tktPrisma.ticket.findUnique({
      where: { id: req.params.id as string },
      include: ticketDetailInclude,
    });
    if (!ticket) { res.status(404).json({ error: "Ticket no encontrado" }); return; }
    if (req.user!.role === "ADMIN" && ticket.restaurantId !== req.restaurantId) {
      res.status(403).json({ error: "No puedes ver este ticket" });
      return;
    }
    res.json({ ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando ticket" });
  }
});

// POST /api/tickets/:id/messages — responder
const messageSchema = tktZ.object({ body: tktZ.string().min(1).max(4000) });

tktRouter.post("/:id/messages", tktAuthz("ADMIN", "SUPERADMIN"), async (req: TktReq, res: TktRes) => {
  try {
    const data = messageSchema.parse(req.body);
    const ticket = await tktPrisma.ticket.findUnique({ where: { id: req.params.id as string } });
    if (!ticket) { res.status(404).json({ error: "Ticket no encontrado" }); return; }
    if (req.user!.role === "ADMIN" && ticket.restaurantId !== req.restaurantId) {
      res.status(403).json({ error: "No puedes responder este ticket" });
      return;
    }
    if (ticket.status === "CLOSED") {
      res.status(400).json({ error: "El ticket está cerrado" });
      return;
    }

    await tktPrisma.ticketMessage.create({
      data: { ticketId: ticket.id, userId: req.user!.userId, body: data.body },
    });

    const updated = await tktPrisma.ticket.update({
      where: { id: ticket.id },
      data: {
        // SUPERADMIN responde → pasa a IN_PROGRESS si estaba OPEN
        status: req.user!.role === "SUPERADMIN" && ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
      },
      include: ticketDetailInclude,
    });
    res.status(201).json({ ticket: updated });
  } catch (err) {
    if (err instanceof tktZ.ZodError) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Error enviando mensaje" });
  }
});

// PATCH /api/tickets/:id/close
tktRouter.patch("/:id/close", tktAuthz("ADMIN", "SUPERADMIN"), async (req: TktReq, res: TktRes) => {
  try {
    const ticket = await tktPrisma.ticket.findUnique({ where: { id: req.params.id as string } });
    if (!ticket) { res.status(404).json({ error: "Ticket no encontrado" }); return; }
    if (req.user!.role === "ADMIN" && ticket.restaurantId !== req.restaurantId) {
      res.status(403).json({ error: "No puedes cerrar este ticket" });
      return;
    }
    const updated = await tktPrisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: ticketDetailInclude,
    });
    res.json({ ticket: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cerrando ticket" });
  }
});

export { tktRouter as default };
