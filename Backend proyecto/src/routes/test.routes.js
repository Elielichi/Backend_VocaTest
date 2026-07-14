import { Router } from "express";

import {
  areasVocacionales,
  preguntasTest,
} from "../../data/test-config.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const testRouter = Router();

const preguntasLocales = preguntasTest.map((pregunta) => ({
  id: pregunta.id,
  orden: pregunta.id,
  pregunta: pregunta.pregunta,
  bloque: pregunta.bloque,
  opciones: pregunta.opciones,
  activa: true,
}));

async function obtenerPreguntas() {
  try {
    const preguntas = await prisma.preguntaTest.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
    });

    return preguntas.length ? preguntas : preguntasLocales;
  } catch (error) {
    console.warn(
      `Banco de preguntas remoto no disponible (${error.code || "sin código"}); se usará el respaldo local.`,
    );
    return preguntasLocales;
  }
}

async function obtenerAreaVocacional(codigo) {
  try {
    const area = await prisma.areaVocacional.findUnique({
      where: { codigo },
    });

    if (area) return area;
  } catch (error) {
    console.warn(
      `Áreas vocacionales remotas no disponibles (${error.code || "sin código"}); se usará el respaldo local.`,
    );
  }

  return areasVocacionales.find((area) => area.codigo === codigo) || null;
}

testRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const preguntas = await obtenerPreguntas();

    return res.json({
      ok: true,
      data: preguntas.map((pregunta) => ({
        id: pregunta.id,
        orden: pregunta.orden,
        pregunta: pregunta.pregunta,
        bloque: pregunta.bloque,
        opciones: pregunta.opciones,
      })),
    });
  }),
);

testRouter.post(
  "/calcular",
  asyncHandler(async (req, res) => {
    const respuestas = Array.isArray(req.body.respuestas)
      ? req.body.respuestas.map(String)
      : [];
    const preguntas = await obtenerPreguntas();

    if (!preguntas.length) {
      throw new HttpError(503, "El test todavía no ha sido inicializado.");
    }

    if (respuestas.length !== preguntas.length) {
      throw new HttpError(400, "Debes responder todas las preguntas del test.");
    }

    respuestas.forEach((categoria, index) => {
      const opciones = Array.isArray(preguntas[index].opciones)
        ? preguntas[index].opciones
        : [];

      if (!opciones.some((opcion) => opcion.categoria === categoria)) {
        throw new HttpError(400, `La respuesta ${index + 1} no es válida.`);
      }
    });

    const conteo = respuestas.reduce((accumulator, categoria) => {
      accumulator[categoria] = (accumulator[categoria] || 0) + 1;
      return accumulator;
    }, {});
    const areaGanadora = respuestas.reduce((ganadora, categoria) =>
      !ganadora || conteo[categoria] > conteo[ganadora] ? categoria : ganadora,
    "");
    const area = await obtenerAreaVocacional(areaGanadora);

    if (!area) {
      throw new HttpError(503, "Las áreas vocacionales no están configuradas.");
    }

    return res.json({
      ok: true,
      data: {
        area: area.codigo,
        carrera: area.carreraRecomendada,
        puntajes: conteo,
      },
    });
  }),
);
