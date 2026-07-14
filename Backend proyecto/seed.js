/**
 * Este archivo se utiliza únicamente para cargar los datos iniciales del
 * proyecto desde el archivo data/db.json hacia la base de datos PostgreSQL
 * alojada en Render utilizando Prisma.
 *
 * ¿Cuándo se usa?
 * - La primera vez que se configura la base de datos.
 * - Cuando se desea volver a poblar la base de datos con la información
 *   original del proyecto.
 *
 * ¿Cómo se ejecuta?
 *      node seed.js
 *
 * IMPORTANTE:
 * Este script elimina previamente los registros existentes de las tablas
 * antes de insertar nuevamente los datos de db.json. Por ello, no debe
 * ejecutarse si se desea conservar la información almacenada en la base
 * de datos.
 * ============================================================================
 */

// Este archivo no forma parte de la ejecución normal del backend.
// Solo debe ejecutarse manualmente cuando sea necesario inicializar o restaurar los datos de la base de datos.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/index.js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const dbPath = path.join(__dirname, "data", "db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

async function main() {
  console.log("Eliminando datos anteriores...");

  await prisma.logo.deleteMany();
  await prisma.escala.deleteMany();
  await prisma.carrera.deleteMany();
  await prisma.universidad.deleteMany();
  await prisma.user.deleteMany();

  console.log("Insertando usuarios...");

  await prisma.user.createMany({
    data: db.users.map((user) => ({
      id: user.id,
      nombres: user.nombres,
      apellidos: user.apellidos,
      correo: user.correo,
      contrasena: user.contrasena,
      rol: user.rol,
      ciudad: user.ciudad || null,
      tipoColegio: user.tipoColegio || null,
      telefono: user.telefono || null,
      edad:
        user.edad === "" || user.edad == null
          ? null
          : Number(user.edad),
      sexo: user.sexo || null,
      carreraRecomendada:
        user.carreraRecomendada || null,
      ultimoIngreso: user.ultimoIngreso || null,
      activo:
        typeof user.activo === "boolean"
          ? user.activo
          : true,
      especialidad: user.especialidad || null,
      gradoAcademico: user.gradoAcademico || null,
    })),
  });

  console.log("Insertando universidades...");

  await prisma.universidad.createMany({
    data: db.universidad.map((uni) => ({
      id: uni.id,
      nombre: uni.nombre,
      tipo: uni.tipo,
      ubicacion: uni.ubicacion || null,
      costoMatricula: uni.costoMatricula || null,
      webOficial: uni.webOficial || null,
    })),
  });

  console.log("Insertando carreras...");

  await prisma.carrera.createMany({
    data: db.carreras.map((carrera) => ({
      id: carrera.id,
      universidad_id: carrera.universidad_id,
      nombre: carrera.nombre,
      facultad: carrera.facultad || null,
      duracion: carrera.duracion || null,
      creditos:
        carrera.creditos === "" ||
        carrera.creditos == null
          ? null
          : Number(carrera.creditos),
      descripcion: carrera.descripcion || null,
      planEstudios: carrera.planEstudios || null,
    })),
  });

  console.log("Insertando escalas...");

  await prisma.escala.createMany({
    data: db.escalas.map((escala) => ({
      id: escala.id,
      universidad_id: escala.universidad_id,
      escala: escala.escala,
      rango: escala.rango || null,
    })),
  });

  console.log("Insertando logos...");

  await prisma.logo.createMany({
    data: db.logos.map((logo) => ({
      id: logo.id,
      universidad_id: logo.universidad_id,
      url: logo.url,
      descripcion: logo.descripcion || null,
    })),
  });

  console.log("Datos importados correctamente.");
}

main()
  .catch((error) => {
    console.error("Error importando datos:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });