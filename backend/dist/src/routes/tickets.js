"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const zod_1 = require("zod");
const tktRouter = (0, express_1.Router)();
exports.default = tktRouter;
tktRouter.use(auth_1.authenticate, tenant_1.tenantIsolation);
const ticketListInclude = {
    restaurant: { select: { id: true, name: true, slug: true } },
    user: { select: { id: true, name: true } },
    _count: { select: { messages: true } },
};
const ticketDetailInclude = {
    restaurant: { select: { id: true, name: true, slug: true } },
    user: { select: { id: true, name: true } },
    messages: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
    },
};
// POST /api/tickets — ADMIN crea un ticket (con el primer mensaje)
const createSchema = zod_1.z.object({
    subject: zod_1.z.string().min(3).max(150),
    body: zod_1.z.string().min(1).max(4000),
});
tktRouter.post("/", (0, auth_1.authorize)("ADMIN"), async (req, res) => {
    try {
        const data = createSchema.parse(req.body);
        const ticket = await index_1.prisma.ticket.create({
            data: {
                restaurantId: req.restaurantId,
                userId: req.user.userId,
                subject: data.subject,
                messages: { create: { userId: req.user.userId, body: data.body } },
            },
            include: ticketDetailInclude,
        });
        res.status(201).json({ ticket });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error creando ticket" });
    }
});
// GET /api/tickets — ADMIN ve los de su restaurante, SUPERADMIN ve todos
tktRouter.get("/", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    try {
        const where = {};
        if (req.user.role === "ADMIN")
            where.restaurantId = req.restaurantId;
        const status = req.query.status;
        if (status)
            where.status = status;
        const tickets = await index_1.prisma.ticket.findMany({
            where,
            include: ticketListInclude,
            orderBy: { updatedAt: "desc" },
        });
        res.json({ tickets });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando tickets" });
    }
});
// GET /api/tickets/:id
tktRouter.get("/:id", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    try {
        const ticket = await index_1.prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: ticketDetailInclude,
        });
        if (!ticket) {
            res.status(404).json({ error: "Ticket no encontrado" });
            return;
        }
        if (req.user.role === "ADMIN" && ticket.restaurantId !== req.restaurantId) {
            res.status(403).json({ error: "No puedes ver este ticket" });
            return;
        }
        res.json({ ticket });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando ticket" });
    }
});
// POST /api/tickets/:id/messages — responder
const messageSchema = zod_1.z.object({ body: zod_1.z.string().min(1).max(4000) });
tktRouter.post("/:id/messages", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    try {
        const data = messageSchema.parse(req.body);
        const ticket = await index_1.prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) {
            res.status(404).json({ error: "Ticket no encontrado" });
            return;
        }
        if (req.user.role === "ADMIN" && ticket.restaurantId !== req.restaurantId) {
            res.status(403).json({ error: "No puedes responder este ticket" });
            return;
        }
        if (ticket.status === "CLOSED") {
            res.status(400).json({ error: "El ticket está cerrado" });
            return;
        }
        await index_1.prisma.ticketMessage.create({
            data: { ticketId: ticket.id, userId: req.user.userId, body: data.body },
        });
        const updated = await index_1.prisma.ticket.update({
            where: { id: ticket.id },
            data: {
                // SUPERADMIN responde → pasa a IN_PROGRESS si estaba OPEN
                status: req.user.role === "SUPERADMIN" && ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
            },
            include: ticketDetailInclude,
        });
        res.status(201).json({ ticket: updated });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos" });
            return;
        }
        console.error(err);
        res.status(500).json({ error: "Error enviando mensaje" });
    }
});
// PATCH /api/tickets/:id/close
tktRouter.patch("/:id/close", (0, auth_1.authorize)("ADMIN", "SUPERADMIN"), async (req, res) => {
    try {
        const ticket = await index_1.prisma.ticket.findUnique({ where: { id: req.params.id } });
        if (!ticket) {
            res.status(404).json({ error: "Ticket no encontrado" });
            return;
        }
        if (req.user.role === "ADMIN" && ticket.restaurantId !== req.restaurantId) {
            res.status(403).json({ error: "No puedes cerrar este ticket" });
            return;
        }
        const updated = await index_1.prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: "CLOSED", closedAt: new Date() },
            include: ticketDetailInclude,
        });
        res.json({ ticket: updated });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cerrando ticket" });
    }
});
//# sourceMappingURL=tickets.js.map