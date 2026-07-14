import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import {
  generateRoomCode,
  hashPassword,
  verifyPassword,
} from "../utils/security.js";

export const salasRouter = Router();

const roomInclude = {
  creador: {
    select: { id: true, nombres: true, apellidos: true, correo: true, rol: true },
  },
  resultados: {
    include: {
      user: {
        select: { id: true, nombres: true, apellidos: true, correo: true },
      },
    },
    orderBy: { fecha: "desc" },
  },
};

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function formatResult(item) {
  return {
    id: item.id,
    userId: item.userId,
    nombre: `${item.user.nombres} ${item.user.apellidos}`.trim(),
    correo: item.user.correo,
    resultado: item.resultado,
    fecha: new Date(item.fecha).toLocaleTimeString("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
    }),
    fechaISO: item.fecha,
  };
}

function formatRoom(room) {
  return {
    id: room.id,
    nombre: room.nombre,
    codigo: room.codigo,
    activa: room.activa,
    creadorId: room.creadorId,
    creador: room.creador.correo,
    creadorUsuario: room.creador,
    creadoEn: room.creadoEn,
    cerradoEn: room.cerradoEn,
    resultados: room.resultados.map(formatResult),
  };
}

async function managedRoom(req, code) {
  const room = await prisma.sala.findUnique({
    where: { codigo: code },
    include: roomInclude,
  });

  if (!room) throw new HttpError(404, "Sala no encontrada.");

  if (req.auth.rol !== "Administrador" && room.creadorId !== req.auth.id) {
    throw new HttpError(403, "Solo el creador o un administrador puede gestionar la sala.");
  }

  return room;
}

salasRouter.use(requireAuth);

salasRouter.get(
  "/",
  requireRole("Administrador", "Profesor"),
  asyncHandler(async (req, res) => {
    const rooms = await prisma.sala.findMany({
      where: req.auth.rol === "Administrador" ? {} : { creadorId: req.auth.id },
      include: roomInclude,
      orderBy: { creadoEn: "desc" },
    });

    return res.json({ ok: true, data: rooms.map(formatRoom) });
  }),
);

salasRouter.post(
  "/",
  requireRole("Administrador", "Profesor"),
  asyncHandler(async (req, res) => {
    const nombre = String(req.body.nombre || "").trim();
    const pin = String(req.body.pin || "").trim();
    const requestedCode = normalizeCode(req.body.codigo);

    if (!nombre) throw new HttpError(400, "El nombre de la sala es obligatorio.");
    if (!/^\d{4}$/.test(pin)) {
      throw new HttpError(400, "El PIN debe tener exactamente 4 dígitos.");
    }
    if (requestedCode && !/^[A-Z0-9]{8}$/.test(requestedCode)) {
      throw new HttpError(400, "El código debe tener 8 letras o números.");
    }

    const attempts = requestedCode ? 1 : 5;
    let room;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const codigo = requestedCode || generateRoomCode();

      try {
        room = await prisma.sala.create({
          data: {
            nombre,
            codigo,
            pinHash: hashPassword(pin),
            creadorId: req.auth.id,
          },
          include: roomInclude,
        });
        break;
      } catch (error) {
        if (error.code !== "P2002") throw error;
        if (requestedCode) {
          throw new HttpError(409, "Ese código ya pertenece a otra sala.");
        }
      }
    }

    if (!room) throw new HttpError(500, "No se pudo generar un código de sala.");

    return res.status(201).json({ ok: true, data: formatRoom(room) });
  }),
);

salasRouter.post(
  "/:codigo/unirse",
  requireRole("Estudiante"),
  asyncHandler(async (req, res) => {
    const codigo = normalizeCode(req.params.codigo);
    const room = await prisma.sala.findUnique({
      where: { codigo },
      include: roomInclude,
    });

    if (!room || !room.activa) {
      throw new HttpError(404, "Código inválido o la sala ya fue cerrada.");
    }

    return res.json({ ok: true, data: formatRoom(room) });
  }),
);

salasRouter.post(
  "/:codigo/resultados",
  requireRole("Estudiante"),
  asyncHandler(async (req, res) => {
    const codigo = normalizeCode(req.params.codigo);
    const resultado = String(req.body.resultado || "").trim();

    if (!resultado || resultado.length > 200) {
      throw new HttpError(400, "El resultado de la evaluación no es válido.");
    }

    const room = await prisma.sala.findUnique({ where: { codigo } });

    if (!room || !room.activa) {
      throw new HttpError(409, "La sala ya no está disponible para recibir resultados.");
    }

    const saved = await prisma.resultadoSala.upsert({
      where: { salaId_userId: { salaId: room.id, userId: req.auth.id } },
      update: { resultado, fecha: new Date() },
      create: { salaId: room.id, userId: req.auth.id, resultado },
      include: {
        user: {
          select: { id: true, nombres: true, apellidos: true, correo: true },
        },
      },
    });

    return res.status(201).json({ ok: true, data: formatResult(saved) });
  }),
);

salasRouter.get(
  "/:codigo/resultados",
  requireRole("Administrador", "Profesor"),
  asyncHandler(async (req, res) => {
    const room = await managedRoom(req, normalizeCode(req.params.codigo));
    return res.json({ ok: true, data: room.resultados.map(formatResult) });
  }),
);

salasRouter.patch(
  "/:codigo/estado",
  requireRole("Administrador", "Profesor"),
  asyncHandler(async (req, res) => {
    const codigo = normalizeCode(req.params.codigo);
    await managedRoom(req, codigo);

    if (typeof req.body.activa !== "boolean") {
      throw new HttpError(400, "El estado activa debe ser verdadero o falso.");
    }

    const room = await prisma.sala.update({
      where: { codigo },
      data: {
        activa: req.body.activa,
        cerradoEn: req.body.activa ? null : new Date(),
      },
      include: roomInclude,
    });

    return res.json({ ok: true, data: formatRoom(room) });
  }),
);

salasRouter.delete(
  "/:codigo",
  requireRole("Administrador", "Profesor"),
  asyncHandler(async (req, res) => {
    const codigo = normalizeCode(req.params.codigo);
    const room = await managedRoom(req, codigo);

    if (
      req.auth.rol !== "Administrador" &&
      !verifyPassword(String(req.body.pin || ""), room.pinHash)
    ) {
      throw new HttpError(401, "PIN incorrecto.");
    }

    await prisma.sala.delete({ where: { id: room.id } });
    return res.json({ ok: true, mensaje: "Sala eliminada." });
  }),
);

salasRouter.get(
  "/:codigo",
  asyncHandler(async (req, res) => {
    const codigo = normalizeCode(req.params.codigo);
    const room = await prisma.sala.findUnique({
      where: { codigo },
      include: roomInclude,
    });

    if (!room) throw new HttpError(404, "Sala no encontrada.");

    const canView =
      req.auth.rol === "Administrador" ||
      room.creadorId === req.auth.id ||
      (req.auth.rol === "Estudiante" && room.activa);

    if (!canView) throw new HttpError(403, "No tienes acceso a esta sala.");

    return res.json({ ok: true, data: formatRoom(room) });
  }),
);
