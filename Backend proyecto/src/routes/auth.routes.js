import { Router } from "express";

import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import {
  asyncHandler,
  cleanOptional,
  HttpError,
  publicUser,
} from "../utils/http.js";
import {
  createToken,
  hashPassword,
  verifyPassword,
} from "../utils/security.js";

export const authRouter = Router();

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function registrationRole(value) {
  return String(value || "").toLowerCase() === "profesor"
    ? "Profesor"
    : "Estudiante";
}

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const correo = normalizedEmail(req.body.correo);
    const contrasena = String(
      req.body.contrasena || req.body["contraseña"] || req.body.password || "",
    );

    if (!correo || !contrasena) {
      throw new HttpError(400, "Correo y contraseña son obligatorios.");
    }

    const usuario = await prisma.user.findUnique({ where: { correo } });

    if (!usuario || !verifyPassword(contrasena, usuario.contrasena)) {
      throw new HttpError(401, "Credenciales incorrectas.");
    }

    if (!usuario.activo) {
      throw new HttpError(403, "Esta cuenta está desactivada.");
    }

    const actualizado = await prisma.user.update({
      where: { id: usuario.id },
      data: { ultimoIngreso: new Date().toISOString() },
    });

    return res.json({
      ok: true,
      data: publicUser(actualizado),
      rol: actualizado.rol,
      token: createToken(actualizado, config.authSecret),
    });
  }),
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const nombres = String(req.body.nombres || "").trim();
    const apellidos = String(req.body.apellidos || "").trim();
    const correo = normalizedEmail(req.body.correo);
    const contrasena = String(
      req.body.contrasena || req.body["contraseña"] || req.body.password || "",
    );

    if (!nombres || !apellidos || !correo || !contrasena) {
      throw new HttpError(
        400,
        "Nombres, apellidos, correo y contraseña son obligatorios.",
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      throw new HttpError(400, "El formato del correo no es válido.");
    }

    if (contrasena.length < 8) {
      throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
    }

    const edad =
      req.body.edad === undefined || req.body.edad === null || req.body.edad === ""
        ? null
        : Number(req.body.edad);

    if (edad !== null && (!Number.isInteger(edad) || edad < 14 || edad > 100)) {
      throw new HttpError(400, "La edad no es válida.");
    }

    const carreraRecomendada = cleanOptional(req.body.carreraRecomendada) ?? null;
    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      const usuario = await tx.user.create({
        data: {
          nombres,
          apellidos,
          correo,
          contrasena: hashPassword(contrasena),
          rol: registrationRole(req.body.rol),
          ciudad: cleanOptional(req.body.ciudad) ?? null,
          tipoColegio: cleanOptional(req.body.tipoColegio) ?? null,
          telefono: cleanOptional(req.body.telefono) ?? null,
          edad,
          sexo: cleanOptional(req.body.sexo) ?? null,
          carreraRecomendada,
          especialidad: cleanOptional(req.body.especialidad) ?? null,
          gradoAcademico: cleanOptional(req.body.gradoAcademico) ?? null,
        },
      });

      if (carreraRecomendada) {
        await tx.historialTest.create({
          data: { userId: usuario.id, resultado: carreraRecomendada },
        });
      }

      return usuario;
    });

    return res.status(201).json({
      ok: true,
      data: publicUser(nuevoUsuario),
      token: createToken(nuevoUsuario, config.authSecret),
    });
  }),
);
