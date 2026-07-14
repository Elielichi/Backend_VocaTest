import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../../generated/prisma/index.js";
import { config } from "../config.js";

if (!config.databaseUrl) {
  throw new Error(
    "Falta DATABASE_URL. Copia .env.example como .env y coloca la URL de PostgreSQL.",
  );
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.useSsl ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export async function closeDatabase() {
  await prisma.$disconnect();
  await pool.end();
}
