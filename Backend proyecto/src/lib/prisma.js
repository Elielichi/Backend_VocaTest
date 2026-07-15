import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../../generated/prisma/index.js";
import { config } from "../config.js";
import { localPrisma } from "./local-prisma.js";

if (!config.databaseUrl && !config.localDbFallback) {
  throw new Error(
    "Falta DATABASE_URL. Copia .env.example como .env y coloca la URL de PostgreSQL.",
  );
}

export const pool = new Pool({
  ...(config.databaseUrl ? { connectionString: config.databaseUrl } : {}),
  ssl: config.useSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);
const remotePrisma = new PrismaClient({ adapter });
let localFallbackActive = !config.databaseUrl && config.localDbFallback;

const modelNames = [
  "user",
  "universidad",
  "carrera",
  "logo",
  "universidadUser",
  "historialTest",
  "sala",
  "resultadoSala",
  "preguntaTest",
  "areaVocacional",
];

function isConnectionError(error) {
  const details = [
    error?.code,
    error?.message,
    error?.cause?.code,
    error?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ");

  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|P1001|P1002|P1017|ConnectionClosed|closed the connection|connection terminated|Can't reach database/i.test(
    details,
  );
}

function activateLocalFallback(error) {
  if (!config.localDbFallback || !isConnectionError(error)) return false;

  if (!localFallbackActive) {
    console.warn(
      `PostgreSQL no estÃ¡ disponible (${error.code || "conexiÃ³n cerrada"}). ` +
        "El backend continuarÃ¡ con data/db.json.",
    );
  }

  localFallbackActive = true;
  return true;
}

pool.on("error", (error) => {
  if (!activateLocalFallback(error)) {
    console.error("Error inesperado en PostgreSQL:", error);
  }
});

async function runModelMethod(modelName, methodName, args) {
  if (localFallbackActive) {
    return localPrisma[modelName][methodName](...args);
  }

  try {
    return await remotePrisma[modelName][methodName](...args);
  } catch (error) {
    if (!activateLocalFallback(error)) throw error;
    return localPrisma[modelName][methodName](...args);
  }
}

function modelProxy(modelName) {
  return new Proxy(
    {},
    {
      get(_target, methodName) {
        return (...args) => runModelMethod(modelName, methodName, args);
      },
    },
  );
}

export const prisma = Object.fromEntries(
  modelNames.map((modelName) => [modelName, modelProxy(modelName)]),
);

prisma.$queryRaw = async (...args) => {
  if (localFallbackActive) return localPrisma.$queryRaw(...args);

  try {
    return await remotePrisma.$queryRaw(...args);
  } catch (error) {
    if (!activateLocalFallback(error)) throw error;
    return localPrisma.$queryRaw(...args);
  }
};

prisma.$transaction = async (callback) => {
  if (localFallbackActive) return localPrisma.$transaction(callback);

  try {
    return await remotePrisma.$transaction((transaction) => callback(transaction));
  } catch (error) {
    if (!activateLocalFallback(error)) throw error;
    return localPrisma.$transaction(callback);
  }
};

prisma.$disconnect = () => remotePrisma.$disconnect();

export function getDatabaseMode() {
  return localFallbackActive ? "local" : "postgresql";
}

export async function closeDatabase() {
  await remotePrisma.$disconnect();
  await pool.end();
}
