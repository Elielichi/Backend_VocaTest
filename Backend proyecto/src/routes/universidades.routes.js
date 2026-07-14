import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  asyncHandler,
  cleanOptional,
  HttpError,
  parseId,
} from "../utils/http.js";

export const universidadesRouter = Router();
export const carrerasRouter = Router();

const fullUniversityInclude = {
  carreras: { orderBy: { id: "asc" } },
  escalas: { orderBy: { id: "asc" } },
  logos: { orderBy: { id: "asc" } },
};

function basicUniversityData(body) {
  const nombre = String(body.nombre || "").trim();
  const tipo = String(body.tipo || "").trim();

  if (!nombre || !tipo) {
    throw new HttpError(400, "Nombre y tipo de universidad son obligatorios.");
  }

  return {
    nombre,
    tipo,
    ubicacion: cleanOptional(body.ubicacion) ?? null,
    costoMatricula: cleanOptional(body.costoMatricula) ?? null,
    webOficial: cleanOptional(body.webOficial) ?? null,
  };
}

function careerData(career) {
  const nombre = String(career.nombre || "").trim();

  if (!nombre) throw new HttpError(400, "Toda carrera necesita un nombre.");

  const credits =
    career.creditos === undefined ||
    career.creditos === null ||
    career.creditos === ""
      ? null
      : Number(career.creditos);

  if (credits !== null && (!Number.isInteger(credits) || credits <= 0)) {
    throw new HttpError(400, `Los créditos de ${nombre} no son válidos.`);
  }

  return {
    nombre,
    facultad: cleanOptional(career.facultad) ?? null,
    duracion: cleanOptional(career.duracion) ?? null,
    creditos: credits,
    descripcion: cleanOptional(career.descripcion) ?? null,
    planEstudios: cleanOptional(career.planEstudios) ?? null,
  };
}

universidadesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const universidades = await prisma.universidad.findMany({
      include: fullUniversityInclude,
      orderBy: { id: "asc" },
    });

    return res.json({ ok: true, data: universidades });
  }),
);

universidadesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de universidad");
    const universidad = await prisma.universidad.findUnique({
      where: { id },
      include: fullUniversityInclude,
    });

    if (!universidad) throw new HttpError(404, "Universidad no encontrada.");

    return res.json({ ok: true, data: universidad });
  }),
);

universidadesRouter.post(
  "/",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const data = basicUniversityData(req.body);
    const carreras = Array.isArray(req.body.carreras)
      ? req.body.carreras.map(careerData)
      : [];
    const logo = cleanOptional(req.body.logo);

    const universidad = await prisma.universidad.create({
      data: {
        ...data,
        carreras: carreras.length ? { create: carreras } : undefined,
        logos: logo
          ? { create: [{ url: logo, descripcion: `Logo de ${data.nombre}` }] }
          : undefined,
      },
      include: fullUniversityInclude,
    });

    return res.status(201).json({ ok: true, data: universidad });
  }),
);

universidadesRouter.put(
  "/:id",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de universidad");
    const data = basicUniversityData(req.body);

    await prisma.$transaction(async (tx) => {
      await tx.universidad.update({ where: { id }, data });

      if (Array.isArray(req.body.carreras)) {
        const existingCareers = await tx.carrera.findMany({
          where: { universidad_id: id },
          select: { id: true },
        });
        const existingIds = new Set(existingCareers.map((career) => career.id));
        const submittedIds = req.body.carreras
          .filter((career) => career.id !== undefined && career.id !== null)
          .map((career) => parseId(career.id, "ID de carrera"));

        if (submittedIds.some((careerId) => !existingIds.has(careerId))) {
          throw new HttpError(400, "Una carrera no pertenece a esta universidad.");
        }

        await tx.carrera.deleteMany({
          where: {
            universidad_id: id,
            ...(submittedIds.length ? { id: { notIn: submittedIds } } : {}),
          },
        });

        for (const career of req.body.carreras) {
          const normalized = careerData(career);

          if (career.id !== undefined && career.id !== null) {
            await tx.carrera.update({
              where: { id: parseId(career.id, "ID de carrera") },
              data: normalized,
            });
          } else {
            await tx.carrera.create({
              data: { ...normalized, universidad_id: id },
            });
          }
        }
      }

      if (Object.hasOwn(req.body, "logo")) {
        await tx.logo.deleteMany({ where: { universidad_id: id } });
        const logo = cleanOptional(req.body.logo);

        if (logo) {
          await tx.logo.create({
            data: {
              universidad_id: id,
              url: logo,
              descripcion: `Logo de ${data.nombre}`,
            },
          });
        }
      }
    });

    const universidad = await prisma.universidad.findUnique({
      where: { id },
      include: fullUniversityInclude,
    });

    return res.json({ ok: true, data: universidad });
  }),
);

universidadesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de universidad");
    await prisma.universidad.delete({ where: { id } });
    return res.json({ ok: true, mensaje: "Universidad eliminada." });
  }),
);

carrerasRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const carreras = await prisma.carrera.findMany({
      include: { universidad: true },
      orderBy: { id: "asc" },
    });
    return res.json({ ok: true, data: carreras });
  }),
);

carrerasRouter.delete(
  "/:id",
  requireAuth,
  requireRole("Administrador"),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "ID de carrera");
    await prisma.carrera.delete({ where: { id } });
    return res.json({ ok: true, mensaje: "Carrera eliminada." });
  }),
);
