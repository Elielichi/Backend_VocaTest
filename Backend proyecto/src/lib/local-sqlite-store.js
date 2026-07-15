import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  areasVocacionales,
  preguntasTest,
} from "../../data/test-config.js";

const dataDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../data",
);

const seedDatabasePath = resolve(dataDirectory, "db.json");
export const localDatabasePath = resolve(dataDirectory, "local-prisma.db");

const arrayKeys = [
  "universidad",
  "carreras",
  "escalas",
  "logos",
  "users",
  "universidad_users",
  "historial_tests",
  "favoritos",
  "salas",
  "resultados_sala",
  "preguntas_test",
  "areas_vocacionales",
];

function openDatabase() {
  const database = new DatabaseSync(localDatabasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS "User" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "nombres" TEXT NOT NULL,
      "apellidos" TEXT NOT NULL,
      "correo" TEXT NOT NULL UNIQUE,
      "contrasena" TEXT NOT NULL,
      "rol" TEXT NOT NULL DEFAULT 'Estudiante',
      "ciudad" TEXT,
      "tipoColegio" TEXT,
      "telefono" TEXT,
      "edad" INTEGER,
      "sexo" TEXT,
      "carreraRecomendada" TEXT,
      "ultimoIngreso" TEXT,
      "activo" BOOLEAN NOT NULL DEFAULT 1,
      "especialidad" TEXT,
      "gradoAcademico" TEXT,
      "notificacionesEmail" BOOLEAN NOT NULL DEFAULT 1,
      "recordatorios" BOOLEAN NOT NULL DEFAULT 1,
      "perfilPublico" BOOLEAN NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS "Universidad" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "nombre" TEXT NOT NULL,
      "tipo" TEXT NOT NULL,
      "ubicacion" TEXT,
      "costoMatricula" TEXT,
      "webOficial" TEXT
    );

    CREATE TABLE IF NOT EXISTS "Carrera" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "universidad_id" INTEGER NOT NULL,
      "nombre" TEXT NOT NULL,
      "facultad" TEXT,
      "duracion" TEXT,
      "creditos" INTEGER,
      "descripcion" TEXT,
      "planEstudios" TEXT,
      FOREIGN KEY ("universidad_id") REFERENCES "Universidad"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Escala" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "universidad_id" INTEGER NOT NULL,
      "escala" TEXT NOT NULL,
      "rango" TEXT,
      FOREIGN KEY ("universidad_id") REFERENCES "Universidad"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Logo" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "universidad_id" INTEGER NOT NULL,
      "url" TEXT NOT NULL,
      "descripcion" TEXT,
      FOREIGN KEY ("universidad_id") REFERENCES "Universidad"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "UniversidadUser" (
      "userId" INTEGER NOT NULL,
      "universidadId" INTEGER NOT NULL,
      "fechaAgregado" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("userId", "universidadId"),
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      FOREIGN KEY ("universidadId") REFERENCES "Universidad"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "HistorialTest" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "resultado" TEXT NOT NULL,
      "fecha" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Favorito" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "userId" INTEGER NOT NULL,
      "universidadId" INTEGER NOT NULL,
      "fecha" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("userId", "universidadId"),
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      FOREIGN KEY ("universidadId") REFERENCES "Universidad"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Sala" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "nombre" TEXT NOT NULL,
      "codigo" TEXT NOT NULL UNIQUE,
      "pinHash" TEXT NOT NULL,
      "activa" BOOLEAN NOT NULL DEFAULT 1,
      "creadoEn" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "cerradoEn" TEXT,
      "creadorId" INTEGER NOT NULL,
      FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "ResultadoSala" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "salaId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      "resultado" TEXT NOT NULL,
      "fecha" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("salaId", "userId"),
      FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "PreguntaTest" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "orden" INTEGER NOT NULL UNIQUE,
      "pregunta" TEXT NOT NULL,
      "bloque" TEXT NOT NULL,
      "opciones" TEXT NOT NULL,
      "activa" BOOLEAN NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS "AreaVocacional" (
      "codigo" TEXT PRIMARY KEY,
      "carreraRecomendada" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "Carrera_universidad_id_idx"
      ON "Carrera"("universidad_id");
    CREATE INDEX IF NOT EXISTS "Sala_creadorId_idx" ON "Sala"("creadorId");
    CREATE INDEX IF NOT EXISTS "ResultadoSala_salaId_idx"
      ON "ResultadoSala"("salaId");
  `);

  return database;
}

function normalizeDatabase(database) {
  for (const key of arrayKeys) {
    if (!Array.isArray(database[key])) database[key] = [];
  }

  if (!database.preguntas_test.length) {
    database.preguntas_test = preguntasTest.map((question) => ({
      id: question.id,
      orden: question.id,
      pregunta: question.pregunta,
      bloque: question.bloque,
      opciones: question.opciones,
      activa: true,
    }));
  }

  if (!database.areas_vocacionales.length) {
    database.areas_vocacionales = areasVocacionales.map((area) => ({ ...area }));
  }

  return database;
}

function dateValue(value) {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

function booleanValue(value, fallback = true) {
  return (value ?? fallback) ? 1 : 0;
}

function insertMany(database, sql, rows, values) {
  if (!rows.length) return;
  const statement = database.prepare(sql);
  for (const row of rows) statement.run(...values(row));
}

function writeDatabase(sqlite, source) {
  const database = normalizeDatabase(source);

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    for (const table of [
      "ResultadoSala",
      "Sala",
      "HistorialTest",
      "UniversidadUser",
      "Favorito",
      "Carrera",
      "Escala",
      "Logo",
      "PreguntaTest",
      "AreaVocacional",
      "User",
      "Universidad",
    ]) {
      sqlite.exec(`DELETE FROM "${table}"`);
    }

    insertMany(
      sqlite,
      `INSERT INTO "User" (
        "id", "nombres", "apellidos", "correo", "contrasena", "rol",
        "ciudad", "tipoColegio", "telefono", "edad", "sexo",
        "carreraRecomendada", "ultimoIngreso", "activo", "especialidad",
        "gradoAcademico", "notificacionesEmail", "recordatorios", "perfilPublico"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      database.users,
      (user) => [
        user.id,
        user.nombres,
        user.apellidos,
        user.correo,
        user.contrasena,
        user.rol || "Estudiante",
        user.ciudad ?? null,
        user.tipoColegio ?? null,
        user.telefono ?? null,
        user.edad ?? null,
        user.sexo ?? null,
        user.carreraRecomendada ?? null,
        dateValue(user.ultimoIngreso),
        booleanValue(user.activo),
        user.especialidad ?? null,
        user.gradoAcademico ?? null,
        booleanValue(user.notificacionesEmail),
        booleanValue(user.recordatorios),
        booleanValue(user.perfilPublico),
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "Universidad"
        ("id", "nombre", "tipo", "ubicacion", "costoMatricula", "webOficial")
       VALUES (?, ?, ?, ?, ?, ?)`,
      database.universidad,
      (university) => [
        university.id,
        university.nombre,
        university.tipo,
        university.ubicacion ?? null,
        university.costoMatricula ?? null,
        university.webOficial ?? null,
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "Carrera"
        ("id", "universidad_id", "nombre", "facultad", "duracion", "creditos", "descripcion", "planEstudios")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      database.carreras,
      (career) => [
        career.id,
        career.universidad_id,
        career.nombre,
        career.facultad ?? null,
        career.duracion ?? null,
        career.creditos ?? null,
        career.descripcion ?? null,
        career.planEstudios ?? null,
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "Escala" ("id", "universidad_id", "escala", "rango")
       VALUES (?, ?, ?, ?)`,
      database.escalas,
      (scale) => [scale.id, scale.universidad_id, scale.escala, scale.rango ?? null],
    );

    insertMany(
      sqlite,
      `INSERT INTO "Logo" ("id", "universidad_id", "url", "descripcion")
       VALUES (?, ?, ?, ?)`,
      database.logos,
      (logo) => [logo.id, logo.universidad_id, logo.url, logo.descripcion ?? null],
    );

    insertMany(
      sqlite,
      `INSERT INTO "UniversidadUser"
        ("userId", "universidadId", "fechaAgregado") VALUES (?, ?, ?)`,
      database.universidad_users,
      (favorite) => [
        favorite.userId,
        favorite.universidadId,
        dateValue(favorite.fechaAgregado) || new Date().toISOString(),
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "HistorialTest" ("id", "userId", "resultado", "fecha")
       VALUES (?, ?, ?, ?)`,
      database.historial_tests,
      (entry) => [entry.id, entry.userId, entry.resultado, dateValue(entry.fecha)],
    );

    insertMany(
      sqlite,
      `INSERT INTO "Favorito" ("id", "userId", "universidadId", "fecha")
       VALUES (?, ?, ?, ?)`,
      database.favoritos,
      (favorite) => [
        favorite.id,
        favorite.userId,
        favorite.universidadId,
        dateValue(favorite.fecha),
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "Sala"
        ("id", "nombre", "codigo", "pinHash", "activa", "creadoEn", "cerradoEn", "creadorId")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      database.salas,
      (room) => [
        room.id,
        room.nombre,
        room.codigo,
        room.pinHash,
        booleanValue(room.activa),
        dateValue(room.creadoEn),
        dateValue(room.cerradoEn),
        room.creadorId,
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "ResultadoSala"
        ("id", "salaId", "userId", "resultado", "fecha") VALUES (?, ?, ?, ?, ?)`,
      database.resultados_sala,
      (result) => [
        result.id,
        result.salaId,
        result.userId,
        result.resultado,
        dateValue(result.fecha),
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "PreguntaTest"
        ("id", "orden", "pregunta", "bloque", "opciones", "activa")
       VALUES (?, ?, ?, ?, ?, ?)`,
      database.preguntas_test,
      (question) => [
        question.id,
        question.orden,
        question.pregunta,
        question.bloque,
        JSON.stringify(question.opciones),
        booleanValue(question.activa),
      ],
    );

    insertMany(
      sqlite,
      `INSERT INTO "AreaVocacional" ("codigo", "carreraRecomendada")
       VALUES (?, ?)`,
      database.areas_vocacionales,
      (area) => [area.codigo, area.carreraRecomendada],
    );

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function readInitialDatabase() {
  return normalizeDatabase(JSON.parse(readFileSync(seedDatabasePath, "utf8")));
}

function tableRows(sqlite, table) {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all().map((row) => ({ ...row }));
}

export function initializeLocalDatabase() {
  const databaseAlreadyExisted = existsSync(localDatabasePath);
  const sqlite = openDatabase();

  try {
    if (!databaseAlreadyExisted) writeDatabase(sqlite, readInitialDatabase());

    return {
      path: localDatabasePath,
      users: Number(sqlite.prepare('SELECT COUNT(*) AS count FROM "User"').get().count),
      universities: Number(
        sqlite.prepare('SELECT COUNT(*) AS count FROM "Universidad"').get().count,
      ),
      careers: Number(
        sqlite.prepare('SELECT COUNT(*) AS count FROM "Carrera"').get().count,
      ),
    };
  } finally {
    sqlite.close();
  }
}

export function loadDatabase() {
  initializeLocalDatabase();
  const sqlite = openDatabase();

  try {
    const users = tableRows(sqlite, "User").map((user) => ({
      ...user,
      activo: Boolean(user.activo),
      notificacionesEmail: Boolean(user.notificacionesEmail),
      recordatorios: Boolean(user.recordatorios),
      perfilPublico: Boolean(user.perfilPublico),
    }));
    const salas = tableRows(sqlite, "Sala").map((room) => ({
      ...room,
      activa: Boolean(room.activa),
    }));
    const preguntas = tableRows(sqlite, "PreguntaTest").map((question) => ({
      ...question,
      opciones: JSON.parse(question.opciones),
      activa: Boolean(question.activa),
    }));

    return {
      users,
      universidad: tableRows(sqlite, "Universidad"),
      carreras: tableRows(sqlite, "Carrera"),
      escalas: tableRows(sqlite, "Escala"),
      logos: tableRows(sqlite, "Logo"),
      universidad_users: tableRows(sqlite, "UniversidadUser"),
      historial_tests: tableRows(sqlite, "HistorialTest"),
      favoritos: tableRows(sqlite, "Favorito"),
      salas,
      resultados_sala: tableRows(sqlite, "ResultadoSala"),
      preguntas_test: preguntas,
      areas_vocacionales: tableRows(sqlite, "AreaVocacional"),
    };
  } finally {
    sqlite.close();
  }
}

export function saveDatabase(database) {
  initializeLocalDatabase();
  const sqlite = openDatabase();
  try {
    writeDatabase(sqlite, database);
  } finally {
    sqlite.close();
  }
}
