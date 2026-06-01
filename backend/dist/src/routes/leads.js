"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const router = (0, express_1.Router)();
const leadSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nombre requerido"),
    email: zod_1.z.string().email("Email inválido"),
    restaurant: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
// POST /api/leads — Public landing page form
router.post("/", async (req, res) => {
    try {
        const data = leadSchema.parse(req.body);
        const lead = await index_1.prisma.lead.create({ data });
        res.status(201).json({ message: "Recibido! Te contactaremos pronto.", lead });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: "Datos inválidos", details: err.errors });
            return;
        }
        console.error("Lead error:", err);
        res.status(500).json({ error: "Error" });
    }
});
exports.default = router;
//# sourceMappingURL=leads.js.map