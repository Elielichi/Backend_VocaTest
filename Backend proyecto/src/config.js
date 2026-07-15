import "dotenv/config";

const defaultAuthSecret = "vocatest-desarrollo-cambia-esta-clave";

function parseOrigins(value) {
  return String(value || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || "",
  authSecret: process.env.AUTH_SECRET || defaultAuthSecret,
  frontendOrigins: parseOrigins(process.env.FRONTEND_URL),
  isProduction: process.env.NODE_ENV === "production",
  localDbFallback:
    process.env.LOCAL_DB_FALLBACK !== "false" &&
    process.env.NODE_ENV !== "production",
  useSsl:
    process.env.PGSSL === "true" ||
    /sslmode=require|render\.com/i.test(process.env.DATABASE_URL || ""),
};

if (config.isProduction && config.authSecret === defaultAuthSecret) {
  throw new Error("AUTH_SECRET es obligatorio en producción.");
}
