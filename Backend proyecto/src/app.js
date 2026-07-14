import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.routes.js";
import { salasRouter } from "./routes/salas.routes.js";
import { testRouter } from "./routes/test.routes.js";
import {
  carrerasRouter,
  universidadesRouter,
} from "./routes/universidades.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { asyncHandler, HttpError } from "./utils/http.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        !config.isProduction ||
        config.frontendOrigins.includes("*") ||
        config.frontendOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new HttpError(403, "Origen no permitido por CORS."));
    },
  }),
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    mensaje: "Backend VocaTest funcionando.",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      users: "/api/db/users",
      universidades: "/api/db/universidades",
      carreras: "/api/db/carreras",
      salas: "/api/db/salas",
      test: "/api/db/test",
    },
  });
});

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, servicio: "vocatest-api", database: "connected" });
  }),
);

app.use("/api/auth", authRouter);
app.use("/api/db/users", usersRouter);
app.use("/api/db/universidades", universidadesRouter);
app.use("/api/db/carreras", carrerasRouter);
app.use("/api/db/salas", salasRouter);
app.use("/api/db/test", testRouter);

app.use((_req, _res, next) => {
  next(new HttpError(404, "Ruta no encontrada."));
});

app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ ok: false, mensaje: error.message });
  }

  if (error.code === "P2002") {
    return res.status(409).json({
      ok: false,
      mensaje: "Ya existe un registro con esos datos únicos.",
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({ ok: false, mensaje: "Registro no encontrado." });
  }

  if (error.code === "P2003") {
    return res.status(409).json({
      ok: false,
      mensaje: "La operación afecta registros relacionados y no se puede completar.",
    });
  }

  console.error("Error no controlado:", error);

  return res.status(500).json({
    ok: false,
    mensaje: "Ocurrió un error interno en el servidor.",
    ...(config.isProduction ? {} : { detalle: error.message }),
  });
});
