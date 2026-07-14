import { createServer } from "node:http";

import { app } from "./src/app.js";
import { config } from "./src/config.js";
import { closeDatabase } from "./src/lib/prisma.js";

const server = createServer(app);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Backend VocaTest disponible en http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`\n${signal}: cerrando el servidor...`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
