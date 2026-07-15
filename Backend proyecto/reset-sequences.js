import "dotenv/config";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en el archivo .env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const tablas = [
  "User",
  "Universidad",
  "Carrera",
  "Escala",
  "Logo",
  "HistorialTest",
  "Favorito",
  "Sala",
  "ResultadoSala",
  "PreguntaTest",
];

async function main() {
  for (const tabla of tablas) {
    const consulta = `
      SELECT setval(
        pg_get_serial_sequence('"${tabla}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${tabla}"), 0) + 1,
        false
      );
    `;

    await pool.query(consulta);
    console.log(`Secuencia actualizada: ${tabla}`);
  }

  console.log("Todas las secuencias fueron corregidas.");
}

main()
  .catch((error) => {
    console.error("Error actualizando secuencias:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });