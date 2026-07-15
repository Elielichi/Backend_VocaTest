import { Router } from "express";

import {
  requireAuth,
  requireRole,
  requireSelfOrAdmin,
} from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  asyncHandler,
  HttpError,
  parseId,
  publicUser,
} from "../utils/http.js";
import { hashPassword, verifyPassword } from "../utils/security.js";

export const usersRouter = Router();

const favoriteUniversityInclude = {
  carreras: true,
  escalas: true,
  logos: true,
};

function normalizedRole(value) {
  const role = String(value || "").toLowerCase();

  if (role === "admin" || role === "administrador") return "Administrador";
  if (role === "profesor") return "Profesor";
  if (role === "estudiante") return "Estudiante";

  throw new HttpError(400, "El rol no es válido.");
}

usersRouter.get(
  "/",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (_req, res) => {
    const usuarios = await prisma.user.findMany({ orderBy: { id: "asc" } });
    return res.json({ ok: true, data: usuarios.map(publicUser) });
  }),
);

usersRouter.put(
  "/:id",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de usuario");
    const data = {};

    if (req.body.nombres !== undefined) {
      data.nombres = String(req.body.nombres).trim();
    }
    if (req.body.apellidos !== undefined) {
      data.apellidos = String(req.body.apellidos).trim();
    }
    if (req.body.correo !== undefined) {
      data.correo = String(req.body.correo).trim().toLowerCase();
    }
    if (req.body.rol !== undefined) data.rol = normalizedRole(req.body.rol);
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);
    if (req.body.contrasena) data.contrasena = hashPassword(req.body.contrasena);

    if (!Object.keys(data).length) {
      throw new HttpError(400, "No se enviaron campos para actualizar.");
    }

    if (data.nombres === "" || data.apellidos === "" || data.correo === "") {
      throw new HttpError(400, "Nombre, apellido y correo no pueden quedar vacíos.");
    }

    const actualizado = await prisma.user.update({ where: { id }, data });
    return res.json({ ok: true, data: publicUser(actualizado) });
  }),
);

usersRouter.patch(
  "/:id/preferences",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de usuario");
    const allowedFields = [
      "notificacionesEmail",
      "recordatorios",
      "perfilPublico",
    ];
    const data = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "boolean") {
          throw new HttpError(400, `La preferencia ${field} debe ser booleana.`);
        }
        data[field] = req.body[field];
      }
    }

    if (!Object.keys(data).length) {
      throw new HttpError(400, "No se enviaron preferencias válidas.");
    }

    const actualizado = await prisma.user.update({ where: { id }, data });
    return res.json({ ok: true, data: publicUser(actualizado) });
  }),
);

usersRouter.put(
  "/:id/profile",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de usuario");
    const usuario = await prisma.user.findUnique({ where: { id } });

    if (!usuario) throw new HttpError(404, "Usuario no encontrado.");

    const passwordActual = String(req.body.passwordActual || "");

    if (!passwordActual || !verifyPassword(passwordActual, usuario.contrasena)) {
      throw new HttpError(401, "La contraseña actual es incorrecta.");
    }

    const data = {};

    if (req.body.nombres !== undefined) {
      data.nombres = String(req.body.nombres).trim();
    }
    if (req.body.apellidos !== undefined) {
      data.apellidos = String(req.body.apellidos).trim();
    }
    if (req.body.correo !== undefined) {
      const correo = String(req.body.correo).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new HttpError(400, "El formato del correo no es válido.");
      }
      data.correo = correo;
    }
    if (req.body.nuevaContrasena !== undefined) {
      const nuevaContrasena = String(req.body.nuevaContrasena);
      if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(nuevaContrasena)) {
        throw new HttpError(
          400,
          "La nueva contraseña necesita 8 caracteres, una mayúscula y un número.",
        );
      }
      data.contrasena = hashPassword(nuevaContrasena);
    }

    if (!Object.keys(data).length) {
      throw new HttpError(400, "No se enviaron cambios de perfil.");
    }

    if (data.nombres === "" || data.apellidos === "") {
      throw new HttpError(400, "Los nombres y apellidos son obligatorios.");
    }

    const actualizado = await prisma.user.update({ where: { id }, data });
    return res.json({ ok: true, data: publicUser(actualizado) });
  }),
);

usersRouter.delete(
  "/:id",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de usuario");

    if (id === req.auth.id) {
      throw new HttpError(400, "No puedes eliminar tu propia cuenta administrativa.");
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ ok: true, mensaje: "Usuario eliminado." });
  }),
);

usersRouter.get(
  "/:id/favoritos",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id, "ID de usuario");
    const favoritos = await prisma.universidadUser.findMany({
      where: { userId },
      include: { universidad: { include: favoriteUniversityInclude } },
      orderBy: { fechaAgregado: "desc" },
    });

    return res.json({
      ok: true,
      data: favoritos.map((item) => item.universidad),
    });
  }),
);

usersRouter.post(
  "/:id/favoritos/:universidadId",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id, "ID de usuario");
    const universidadId = parseId(
      req.params.universidadId,
      "ID de universidad",
    );

    const favorito = await prisma.universidadUser.upsert({
      where: { userId_universidadId: { userId, universidadId } },
      update: {},
      create: { userId, universidadId },
      include: { universidad: true },
    });

    return res.status(201).json({ ok: true, data: favorito.universidad });
  }),
);

usersRouter.delete(
  "/:id/favoritos/:universidadId",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id, "ID de usuario");
    const universidadId = parseId(
      req.params.universidadId,
      "ID de universidad",
    );

    await prisma.universidadUser.deleteMany({ where: { userId, universidadId } });
    return res.json({ ok: true, mensaje: "Universidad retirada de favoritos." });
  }),
);

usersRouter.get(
  "/:id/historial",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id, "ID de usuario");
    const historial = await prisma.historialTest.findMany({
      where: { userId },
      orderBy: { fecha: "desc" },
      take: 20,
    });

    return res.json({ ok: true, data: historial });
  }),
);

usersRouter.post(
  "/:id/historial",
  requireAuth,
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id, "ID de usuario");
    const resultado = String(req.body.resultado || "").trim();

    if (!resultado || resultado.length > 200) {
      throw new HttpError(400, "El resultado del test no es válido.");
    }

    const entrada = await prisma.$transaction(async (tx) => {
      const historial = await tx.historialTest.create({
        data: { userId, resultado },
      });

      await tx.user.update({
        where: { id: userId },
        data: { carreraRecomendada: resultado },
      });

      return historial;
    });

    return res.status(201).json({ ok: true, data: entrada });
  }),
);
